import json
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from app.models import ProductOut, CategoryOut
from app.database import query_db

router = APIRouter(prefix="/api", tags=["Productos y Categorías"])

def format_product_row(row: dict) -> dict:
    if not row:
        return None
    data = dict(row)
    try:
        data["sizes"] = json.loads(data["sizes"]) if isinstance(data["sizes"], str) else (data["sizes"] or [])
    except Exception:
        data["sizes"] = ["S", "M", "L"]
        
    try:
        data["colors"] = json.loads(data["colors"]) if isinstance(data["colors"], str) else (data["colors"] or [])
    except Exception:
        data["colors"] = []
        
    try:
        data["images"] = json.loads(data["images"]) if isinstance(data["images"], str) else (data["images"] or [])
    except Exception:
        data["images"] = []

    data["featured"] = bool(data.get("featured", 0))
    data["is_new"] = bool(data.get("is_new", 0))
    return data

@router.get("/settings")
def get_public_settings():
    rows = query_db("SELECT key, value FROM settings")
    settings_dict = {r["key"]: r["value"] for r in rows}
    # Exclude sensitive secrets from public endpoint
    safe_settings = {
        "logo_url": settings_dict.get("logo_url", "/static/images/logo-ab.svg"),
        "brand_name": settings_dict.get("brand_name", "Alice Brand"),
        "brand_slogan": settings_dict.get("brand_slogan", "SWIMWEAR & RESORT WEAR · COLOMBIA"),
        "primary_color": settings_dict.get("primary_color", "#4D0E12"),
        "secondary_color": settings_dict.get("secondary_color", "#A5BCD6"),
        "whatsapp_number": settings_dict.get("whatsapp_number", "+573023949733"),
        "instagram_url": settings_dict.get("instagram_url", "https://www.instagram.com/alicee_brand?igsi=bmtvbXQzbHhlaWZx"),
        "instagram_handle": settings_dict.get("instagram_handle", "@alicee_brand"),
        "google_client_id": settings_dict.get("google_client_id", ""),
        "wompi_public_key": settings_dict.get("wompi_public_key", "pub_test_Q5yDA9xoKdePzhSGeVe9HAUr1jiY25Er"),
        "payment_mode": settings_dict.get("payment_mode", "wompi_pse"),
        # Typography (editable desde el panel de administracion)
        "font_heading": settings_dict.get("font_heading", "Cormorant Garamond"),
        "font_body": settings_dict.get("font_body", "Plus Jakarta Sans"),
    }

    # Textos editables de la pagina (CMS). Se exponen todos los que comiencen
    # con alguno de estos prefijos, para no tener que tocar el backend cada vez
    # que se agregue un texto nuevo en el frontend.
    CMS_PREFIXES = (
        "announcement_", "hero_", "about_", "whatsapp_assistance_", "footer_"
    )
    for key, value in settings_dict.items():
        if key.startswith(CMS_PREFIXES):
            safe_settings[key] = value

    return safe_settings

@router.get("/categories", response_model=List[CategoryOut])
def get_categories():
    categories = query_db("SELECT id, name, slug, description, image_url FROM categories ORDER BY id ASC")
    return categories

@router.get("/products", response_model=List[ProductOut])
def get_products(
    category: Optional[str] = Query(None, description="Slug de la categoría"),
    category_id: Optional[int] = Query(None, description="ID de la categoría"),
    search: Optional[str] = Query(None, description="Texto de búsqueda"),
    min_price: Optional[float] = Query(None, description="Precio mínimo en COP"),
    max_price: Optional[float] = Query(None, description="Precio máximo en COP"),
    featured: Optional[bool] = Query(None, description="Solo destacados"),
    is_new: Optional[bool] = Query(None, description="Solo novedades"),
    sort: Optional[str] = Query("newest", description="Orden: newest, price_asc, price_desc, name_asc, featured")
):
    sql = """
        SELECT p.*, c.name as category_name, c.slug as category_slug
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE 1=1
    """
    params = []

    if category:
        sql += " AND c.slug = ?"
        params.append(category)
    
    if category_id:
        sql += " AND p.category_id = ?"
        params.append(category_id)

    if search:
        search_term = f"%{search.strip().lower()}%"
        sql += " AND (LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(c.name) LIKE ?)"
        params.extend([search_term, search_term, search_term])

    if min_price is not None:
        sql += " AND p.price_cop >= ?"
        params.append(min_price)

    if max_price is not None:
        sql += " AND p.price_cop <= ?"
        params.append(max_price)

    if featured is not None:
        sql += " AND p.featured = ?"
        params.append(1 if featured else 0)

    if is_new is not None:
        sql += " AND p.is_new = ?"
        params.append(1 if is_new else 0)

    # Sorting
    if sort == "price_asc":
        sql += " ORDER BY p.price_cop ASC"
    elif sort == "price_desc":
        sql += " ORDER BY p.price_cop DESC"
    elif sort == "name_asc":
        sql += " ORDER BY p.name ASC"
    elif sort == "featured":
        sql += " ORDER BY p.featured DESC, p.id DESC"
    else: # newest
        sql += " ORDER BY p.id DESC"

    rows = query_db(sql, params)
    return [format_product_row(row) for row in rows]

@router.get("/products/{product_id}", response_model=ProductOut)
def get_product(product_id: int):
    row = query_db(
        """
        SELECT p.*, c.name as category_name, c.slug as category_slug
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
        """,
        (product_id,),
        one=True
    )
    if not row:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    return format_product_row(row)

@router.get("/products/slug/{slug}", response_model=ProductOut)
def get_product_by_slug(slug: str):
    row = query_db(
        """
        SELECT p.*, c.name as category_name, c.slug as category_slug
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.slug = ?
        """,
        (slug,),
        one=True
    )
    if not row:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")
    return format_product_row(row)
