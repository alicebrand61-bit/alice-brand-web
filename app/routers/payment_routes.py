import uuid
import datetime
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from app.models import PseBank, PseInitiateRequest
from app.database import query_db, execute_db

router = APIRouter(prefix="/api/payments/pse", tags=["Pasarela PSE Colombia"])

# Official Colombian Financial Entities (ACH Colombia PSE)
COLOMBIAN_BANKS = [
    {"code": "1007", "name": "Bancolombia", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/e/eb/Bancolombia_logo.svg"},
    {"code": "1507", "name": "Nequi", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/3/30/Nequi_logo.svg"},
    {"code": "1051", "name": "Davivienda", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/7/7b/Davivienda_logo.svg"},
    {"code": "1551", "name": "Daviplata", "logo_url": "https://seeklogo.com/images/D/daviplata-logo-B13978BD72-seeklogo.com.png"},
    {"code": "1001", "name": "Banco de Bogotá", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/7/77/Banco_de_Bogot%C3%A1_logo.svg"},
    {"code": "1013", "name": "BBVA Colombia", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/0/05/BBVA_2019.svg"},
    {"code": "1023", "name": "Banco de Occidente", "logo_url": "https://seeklogo.com/images/B/banco-de-occidente-logo-CAEB590833-seeklogo.com.png"},
    {"code": "1002", "name": "Banco Popular", "logo_url": "https://seeklogo.com/images/B/banco-popular-logo-8A1C50422B-seeklogo.com.png"},
    {"code": "1052", "name": "Banco AV Villas", "logo_url": "https://seeklogo.com/images/B/banco-av-villas-logo-2780709FF6-seeklogo.com.png"},
    {"code": "1019", "name": "Scotiabank Colpatria", "logo_url": "https://seeklogo.com/images/S/scotiabank-colpatria-logo-4A88E52A7D-seeklogo.com.png"},
    {"code": "1032", "name": "Banco Caja Social", "logo_url": "https://seeklogo.com/images/B/banco-caja-social-logo-19A71122CA-seeklogo.com.png"},
    {"code": "1006", "name": "Banco Itaú", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/2/25/Itau_Unibanco_logo.svg"},
    {"code": "1508", "name": "Nu Colombia (Cuenta Nu)", "logo_url": "https://upload.wikimedia.org/wikipedia/commons/f/f7/Nubank_logo_2021.svg"},
    {"code": "1509", "name": "Lulo Bank", "logo_url": "https://seeklogo.com/images/L/lulo-bank-logo-F472BDB443-seeklogo.com.png"},
    {"code": "1062", "name": "Banco Falabella", "logo_url": "https://seeklogo.com/images/B/banco-falabella-logo-1C97A1EBEA-seeklogo.com.png"}
]

class PseProcessRequest(BaseModel):
    transaction_id: str
    action: str = "APPROVE" # APPROVE, REJECT, CANCEL

@router.get("/banks", response_model=List[PseBank])
def get_banks():
    return COLOMBIAN_BANKS

@router.post("/initiate")
def initiate_pse_payment(req: PseInitiateRequest):
    order = query_db("SELECT * FROM orders WHERE order_number = ?", (req.order_number,), one=True)
    if not order:
        raise HTTPException(status_code=404, detail="No se encontró la orden especificada.")

    # Find bank name
    bank_info = next((b for b in COLOMBIAN_BANKS if b["code"] == req.bank_code), None)
    bank_name = bank_info["name"] if bank_info else "Banco ACH PSE"

    # Generate PSE Transaction ID
    tx_id = f"PSE-TX-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"

    # Update order with transaction ID and bank
    execute_db(
        """
        UPDATE orders 
        SET pse_transaction_id = ?, pse_bank = ?, payment_status = 'processing'
        WHERE order_number = ?
        """,
        (tx_id, bank_name, req.order_number)
    )

    # Return redirect URL and transaction details
    return {
        "success": True,
        "transaction_id": tx_id,
        "order_number": req.order_number,
        "amount_cop": order["total_cop"],
        "bank_name": bank_name,
        "bank_code": req.bank_code,
        "payer_name": req.payer_name,
        "payer_email": req.payer_email,
        "redirect_url": f"/pse-simulator?tx={tx_id}&bank={req.bank_code}&order={req.order_number}&amount={order['total_cop']}"
    }

@router.post("/process")
def process_pse_transaction(req: PseProcessRequest):
    order = query_db("SELECT * FROM orders WHERE pse_transaction_id = ?", (req.transaction_id,), one=True)
    if not order:
        raise HTTPException(status_code=404, detail="Transacción PSE no encontrada.")

    if req.action == "APPROVE":
        execute_db(
            """
            UPDATE orders 
            SET payment_status = 'completed', order_status = 'Pagado'
            WHERE pse_transaction_id = ?
            """,
            (req.transaction_id,)
        )
        return {
            "status": "APPROVED",
            "message": "Pago aprobado exitosamente por la entidad bancaria.",
            "order_number": order["order_number"],
            "authorization_code": f"AUTH-{uuid.uuid4().hex[:8].upper()}",
            "processed_at": datetime.datetime.now().isoformat()
        }
    else:
        execute_db(
            """
            UPDATE orders 
            SET payment_status = 'failed', order_status = 'Pendiente'
            WHERE pse_transaction_id = ?
            """,
            (req.transaction_id,)
        )
        return {
            "status": "REJECTED",
            "message": "La transacción fue rechazada o cancelada por el usuario en la entidad bancaria.",
            "order_number": order["order_number"]
        }

@router.get("/status/{transaction_id}")
def get_pse_status(transaction_id: str):
    order = query_db("SELECT * FROM orders WHERE pse_transaction_id = ?", (transaction_id,), one=True)
    if not order:
        raise HTTPException(status_code=404, detail="Transacción no encontrada.")

    return {
        "transaction_id": transaction_id,
        "order_number": order["order_number"],
        "payment_status": order["payment_status"],
        "order_status": order["order_status"],
        "total_cop": order["total_cop"],
        "pse_bank": order["pse_bank"]
    }

# --- REAL WOMPI CHECKOUT SIGNATURE GENERATOR ---
import hashlib

class WompiCheckoutRequest(BaseModel):
    order_number: str

@router.post("/wompi/signature")
def get_wompi_checkout_signature(req: WompiCheckoutRequest):
    order = query_db("SELECT * FROM orders WHERE order_number = ?", (req.order_number,), one=True)
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    # Load store settings for Wompi keys
    settings_rows = query_db("SELECT key, value FROM settings WHERE key IN ('wompi_public_key', 'wompi_integrity_secret')")
    settings = {r["key"]: r["value"] for r in settings_rows}

    public_key = settings.get("wompi_public_key", "pub_test_Q5yDA9xoKdePzhSGeVe9HAUr1jiY25Er")
    integrity_secret = settings.get("wompi_integrity_secret", "test_integrity_45KjhD837shd82jshd9238")

    amount_in_cents = int(round(order["total_cop"] * 100))
    currency = "COP"
    reference = order["order_number"]

    # Official Wompi Signature formula: SHA256(reference + amount_in_cents + currency + integrity_secret)
    raw_signature_str = f"{reference}{amount_in_cents}{currency}{integrity_secret}"
    signature = hashlib.sha256(raw_signature_str.encode('utf-8')).hexdigest()

    return {
        "public_key": public_key,
        "currency": currency,
        "amount_in_cents": amount_in_cents,
        "reference": reference,
        "signature": signature,
        "customer_email": order["customer_email"],
        "customer_name": order["customer_name"],
        "customer_phone": order["customer_phone"],
        "redirect_url": f"/order-confirmed?order={order['order_number']}"
    }

@router.post("/wompi/webhook")
async def wompi_webhook(event_data: dict):
    # Wompi automated event callback
    event_type = event_data.get("event")
    data = event_data.get("data", {}).get("transaction", {})
    reference = data.get("reference")
    status = data.get("status") # APPROVED, DECLINED, VOIDED, ERROR

    if reference and status == "APPROVED":
        execute_db(
            "UPDATE orders SET payment_status = 'completed', order_status = 'Pagado', pse_transaction_id = ? WHERE order_number = ?",
            (data.get("id", "WOMPI-TX"), reference)
        )
    elif reference and status in ["DECLINED", "ERROR"]:
        execute_db(
            "UPDATE orders SET payment_status = 'failed' WHERE order_number = ?",
            (reference,)
        )

    return {"status": "ok"}

