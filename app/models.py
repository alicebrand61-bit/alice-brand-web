from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Any, Dict
from datetime import datetime

# --- Auth Models ---
class UserRegister(BaseModel):
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class PhoneOtpRequest(BaseModel):
    phone: str

class PhoneOtpVerify(BaseModel):
    phone: str
    code: str
    full_name: Optional[str] = None

class GoogleAuthRequest(BaseModel):
    credential: Optional[str] = None
    email: EmailStr
    full_name: str
    google_id: Optional[str] = None
    avatar_url: Optional[str] = None

class UserOut(BaseModel):
    id: int
    email: Optional[str] = None
    full_name: str
    phone: Optional[str] = None
    role: str
    auth_provider: str
    created_at: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# --- Category Models ---
class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    tagline: Optional[str] = None

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    tagline: Optional[str] = None

# --- Product Models ---
class ColorOption(BaseModel):
    name: str
    hex: str

class ProductCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    description: str
    price_cop: float
    category_id: int
    sizes: List[str] = ["S", "M", "L"]
    colors: List[ColorOption] = []
    images: List[str] = []
    stock: int = 10
    featured: bool = False
    is_new: bool = True

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price_cop: Optional[float] = None
    category_id: Optional[int] = None
    sizes: Optional[List[str]] = None
    colors: Optional[List[ColorOption]] = None
    images: Optional[List[str]] = None
    stock: Optional[int] = None
    featured: Optional[bool] = None
    is_new: Optional[bool] = None

class ProductOut(BaseModel):
    id: int
    name: str
    slug: str
    description: str
    price_cop: float
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    category_slug: Optional[str] = None
    sizes: List[str]
    colors: List[Dict[str, str]]
    images: List[str]
    stock: int
    featured: bool
    is_new: bool
    created_at: Optional[str] = None

# --- Section Models (secciones editables de la portada) ---
class SectionCreate(BaseModel):
    title: str
    subtitle: Optional[str] = ""
    body: Optional[str] = ""
    image_url: Optional[str] = ""
    cta_text: Optional[str] = ""
    cta_link: Optional[str] = ""
    enabled: bool = True

class SectionUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    body: Optional[str] = None
    image_url: Optional[str] = None
    cta_text: Optional[str] = None
    cta_link: Optional[str] = None
    enabled: Optional[bool] = None
    position: Optional[int] = None

class SectionOut(BaseModel):
    id: int
    section_key: str
    title: str
    subtitle: Optional[str] = None
    body: Optional[str] = None
    image_url: Optional[str] = None
    cta_text: Optional[str] = None
    cta_link: Optional[str] = None
    position: int
    enabled: bool
    is_custom: bool

class SectionReorder(BaseModel):
    ordered_ids: List[int]

# --- Order & Checkout Models ---
class OrderItemCreate(BaseModel):
    product_id: int
    product_name: str
    product_image: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    quantity: int = 1
    unit_price_cop: float

class OrderCreate(BaseModel):
    customer_name: str
    customer_email: EmailStr
    customer_phone: str
    department: str
    city: str
    address: str
    address_details: Optional[str] = ""
    items: List[OrderItemCreate]
    subtotal_cop: float
    shipping_cop: float = 0.0
    discount_cop: float = 0.0
    total_cop: float
    payment_method: str = "PSE"
    pse_bank: Optional[str] = None
    notes: Optional[str] = ""

class OrderItemOut(BaseModel):
    id: int
    order_id: int
    product_id: Optional[int] = None
    product_name: str
    product_image: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    quantity: int
    unit_price_cop: float
    subtotal_cop: float

class OrderOut(BaseModel):
    id: int
    order_number: str
    user_id: Optional[int] = None
    customer_name: str
    customer_email: str
    customer_phone: str
    department: str
    city: str
    address: str
    address_details: Optional[str] = None
    subtotal_cop: float
    shipping_cop: float
    discount_cop: float
    total_cop: float
    payment_method: str
    payment_status: str
    pse_bank: Optional[str] = None
    pse_transaction_id: Optional[str] = None
    order_status: str
    notes: Optional[str] = None
    created_at: Optional[str] = None
    items: Optional[List[OrderItemOut]] = []

class OrderStatusUpdate(BaseModel):
    order_status: str
    payment_status: Optional[str] = None

# --- PSE Payment Models ---
class PseBank(BaseModel):
    code: str
    name: str
    logo_url: Optional[str] = None

class PseInitiateRequest(BaseModel):
    order_number: str
    bank_code: str
    person_type: str = "NATURAL" # NATURAL or JURIDICA
    document_type: str = "CC" # CC, CE, NIT, PP
    document_number: str
    payer_name: str
    payer_email: EmailStr
    payer_phone: str

class PsePaymentConfirm(BaseModel):
    transaction_id: str
    status: str # APPROVED, REJECTED, PENDING
