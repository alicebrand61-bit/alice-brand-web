from fastapi import APIRouter, HTTPException, status, Depends
from app.models import UserRegister, UserLogin, UserOut, TokenResponse, PhoneOtpRequest, PhoneOtpVerify, GoogleAuthRequest
from app.database import query_db, execute_db
from app.auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, generate_otp_code, verify_otp_code
)

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])

@router.post("/register", response_model=TokenResponse)
def register(user_in: UserRegister):
    # Check if email exists
    existing = query_db("SELECT id FROM users WHERE email = ?", (user_in.email.lower(),), one=True)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo electrónico ya se encuentra registrado."
        )

    # Hash password
    pwd_hash = hash_password(user_in.password)
    user_id = execute_db(
        "INSERT INTO users (email, full_name, phone, password_hash, role, auth_provider) VALUES (?, ?, ?, ?, 'customer', 'local')",
        (user_in.email.lower(), user_in.full_name, user_in.phone, pwd_hash)
    )

    user_record = query_db("SELECT id, email, full_name, phone, role, auth_provider, created_at FROM users WHERE id = ?", (user_id,), one=True)
    token = create_access_token({"sub": str(user_id), "email": user_record["email"], "role": user_record["role"]})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_record
    }

@router.post("/login", response_model=TokenResponse)
def login(creds: UserLogin):
    user = query_db("SELECT * FROM users WHERE email = ?", (creds.email.lower(),), one=True)
    if not user or not verify_password(creds.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo electrónico o contraseña incorrectos."
        )

    user_out = {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "phone": user["phone"],
        "role": user["role"],
        "auth_provider": user["auth_provider"],
        "created_at": user["created_at"]
    }
    token = create_access_token({"sub": str(user["id"]), "email": user["email"], "role": user["role"]})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_out
    }

@router.post("/phone-otp-request")
def request_phone_otp(req: PhoneOtpRequest):
    phone_clean = req.phone.strip().replace(" ", "").replace("-", "")
    if len(phone_clean) < 7:
        raise HTTPException(status_code=400, detail="Por favor ingresa un número de celular válido.")
    
    code = generate_otp_code(phone_clean)
    
    return {
        "success": True,
        "message": f"Código de verificación de 6 dígitos enviado por SMS al celular {phone_clean}.",
        "expires_in_minutes": 10
    }


@router.post("/phone-otp-verify", response_model=TokenResponse)
def verify_phone_otp(req: PhoneOtpVerify):
    phone_clean = req.phone.strip().replace(" ", "").replace("-", "")
    is_valid = verify_otp_code(phone_clean, req.code.strip())
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Código de verificación incorrecto o expirado.")

    # Find or create user by phone
    user = query_db("SELECT * FROM users WHERE phone = ?", (phone_clean,), one=True)
    if not user:
        name = req.full_name or f"Cliente ({phone_clean[-4:]})"
        temp_email = f"user_{phone_clean[-6:]}@alicebrand.com"
        user_id = execute_db(
            "INSERT INTO users (email, full_name, phone, role, auth_provider) VALUES (?, ?, ?, 'customer', 'phone')",
            (temp_email, name, phone_clean)
        )
        user = query_db("SELECT * FROM users WHERE id = ?", (user_id,), one=True)

    user_out = {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "phone": user["phone"],
        "role": user["role"],
        "auth_provider": user["auth_provider"],
        "created_at": user["created_at"]
    }
    token = create_access_token({"sub": str(user["id"]), "email": user["email"], "role": user["role"]})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_out
    }

@router.post("/google", response_model=TokenResponse)
def google_auth(req: GoogleAuthRequest):
    email = None
    full_name = None
    google_sub = None

    # 1. If Google ID Token credential was sent from Google GSI
    if req.credential:
        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests as google_requests
            
            # Fetch Google client ID from settings
            setting_row = query_db("SELECT value FROM settings WHERE key = 'google_client_id'", one=True)
            configured_client_id = setting_row["value"] if setting_row and setting_row["value"] else None

            # Verify the token with Google servers
            idinfo = id_token.verify_oauth2_token(
                req.credential,
                google_requests.Request(),
                configured_client_id if (configured_client_id and "sample" not in configured_client_id) else None
            )

            email = idinfo.get("email")
            full_name = idinfo.get("name") or idinfo.get("given_name") or "Usuario Google"
            google_sub = idinfo.get("sub")
        except Exception as e:
            # If token verification fails and no direct email provided, raise error
            if not req.email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Token de Google inválido: {str(e)}"
                )

    if not email:
        email = req.email.lower().strip()
        full_name = req.full_name or email.split("@")[0]

    email_clean = email.lower().strip()
    user = query_db("SELECT * FROM users WHERE email = ?", (email_clean,), one=True)
    
    if not user:
        # Create Google authenticated user
        user_id = execute_db(
            "INSERT INTO users (email, full_name, role, auth_provider) VALUES (?, ?, 'customer', 'google')",
            (email_clean, full_name)
        )
        user = query_db("SELECT * FROM users WHERE id = ?", (user_id,), one=True)
    
    user_out = {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "phone": user["phone"],
        "role": user["role"],
        "auth_provider": user["auth_provider"],
        "created_at": user["created_at"]
    }
    token = create_access_token({"sub": str(user["id"]), "email": user["email"], "role": user["role"]})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user_out
    }

@router.get("/me", response_model=UserOut)
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

