import os
import json
import uuid
from typing import List, Optional
from pathlib import Path
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, status

from app.models import (
    ProductCreate, ProductUpdate, ProductOut, OrderOut, OrderStatusUpdate,
    SectionCreate, SectionUpdate, SectionOut, SectionReorder,
    CategoryOut, CategoryUpdate, CategoryCreate,
    HeroSlideCreate, HeroSlideUpdate, HeroSlideOut, HeroSlideReorder
)
from app.database import query_db, execute_db
from app.auth import get_current_admin
from app.routers.product_routes import format_product_row, format_section_row

router = APIRouter(prefix="/api/admin", tags=["Panel de Administración"])

from app.database import UPLOAD_DIR

@router.get("/stats")
def get_admin_stats(admin: dict = Depends(get_current_admin)):
    # 1. Total revenue
    rev_row = query_db("SELECT SUM(total_cop) as total FROM orders WHERE payment_status = 'completed'", one=True)
    total_revenue = rev_row["total"] if rev_row and rev_row["total"] else 0.0

    # 2. Total orders count
    orders_count_row = query_db("SELECT COUNT(*) as count FROM orders", one=True)
    total_orders = orders_count_row["count"] if orders_count_row else 0

    # 3. Orders by status
    status_counts = query_db("SELECT order_status, COUNT(*) as count FROM orders GROUP BY order_status")
    status_dict = {row["order_status"]: row["count"] for row in status_counts}

    # 4. Products count & low stock
    prod_count_row = query_db("SELECT COUNT(*) as count FROM products", one=True)
    total_products = prod_count_row["count"] if prod_count_row else 0
    
    low_stock = query_db("SELECT id, name, stock, price_cop FROM products WHERE stock <= 5 ORDER BY stock ASC")

    # 5. Total customers
    cust_count_row = query_db("SELECT COUNT(*) as count FROM users WHERE role = 'customer'", one=True)
    total_customers = cust_count_row["count"] if cust_count_row else 0

    # 6. Recent orders
    recent_orders = query_db("SELECT * FROM orders ORDER BY id DESC LIMIT 5")

    return {
        "total_revenue_cop": total_revenue,
        "total_orders": total_orders,
        "orders_by_status": status_dict,
        "total_products": total_products,
        "total_customers": total_customers,
        "low_stock_products": low_stock,
        "recent_orders": recent_orders
    }

@router.get("/orders", response_model=List[OrderOut])
def get_admin_orders(
    status: Optional[str] = None,
    search: Optional[str] = None,
    admin: dict = Depends(get_current_admin)
):
    sql = "SELECT * FROM orders WHERE 1=1"
    params = []

    if status:
        sql += " AND order_status = ?"
        params.append(status)

    if search:
        s = f"%{search.strip().lower()}%"
        sql += " AND (LOWER(order_number) LIKE ? OR LOWER(customer_name) LIKE ? OR LOWER(customer_email) LIKE ? OR LOWER(customer_phone) LIKE ?)"
        params.extend([s, s, s, s])

    sql += " ORDER BY id DESC"
    orders = query_db(sql, params)
    
    result = []
    for o in orders:
        items = query_db("SELECT * FROM order_items WHERE order_id = ?", (o["id"],))
        o_dict = dict(o)
        o_dict["items"] = items or []
        result.append(o_dict)
    return result

@router.put("/orders/{order_id}/status")
def update_order_status(
    order_id: int,
    status_in: OrderStatusUpdate,
    admin: dict = Depends(get_current_admin)
):
    order = query_db("SELECT * FROM orders WHERE id = ?", (order_id,), one=True)
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada.")

    sql = "UPDATE orders SET order_status = ?"
    params = [status_in.order_status]

    if status_in.payment_status:
        sql += ", payment_status = ?"
        params.append(status_in.payment_status)

    sql += " WHERE id = ?"
    params.append(order_id)

    execute_db(sql, params)
    return {"success": True, "message": f"Orden {order['order_number']} actualizada a estado: {status_in.order_status}"}

@router.delete("/orders/{order_id}")
def delete_order(order_id: int, admin: dict = Depends(get_current_admin)):
    """Elimina un pedido y sus articulos. Util para limpiar pedidos de prueba."""
    existing = query_db("SELECT * FROM orders WHERE id = ?", (order_id,), one=True)
    if not existing:
        raise HTTPException(status_code=404, detail="Orden no encontrada.")

    execute_db("DELETE FROM order_items WHERE order_id = ?", (order_id,))
    execute_db("DELETE FROM orders WHERE id = ?", (order_id,))
    return {"success": True, "message": f"Pedido {existing['order_number']} eliminado del historial."}


@router.post("/products", response_model=ProductOut)
def create_product(product_in: ProductCreate, admin: dict = Depends(get_current_admin)):
    # Generate unique slug if not provided
    base_slug = product_in.name.lower().replace(" ", "-").replace("ñ", "n").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    clean_slug = "".join(c for c in base_slug if c.isalnum() or c == "-")
    slug = clean_slug
    
    # Check slug collision
    existing = query_db("SELECT id FROM products WHERE slug = ?", (slug,), one=True)
    if existing:
        slug = f"{clean_slug}-{uuid.uuid4().hex[:4]}"

    colors_data = [c.model_dump() for c in product_in.colors]

    product_id = execute_db(
        """
        INSERT INTO products (
            name, slug, description, price_cop, category_id, sizes,
            colors, images, stock, featured, is_new
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            product_in.name,
            slug,
            product_in.description,
            product_in.price_cop,
            product_in.category_id,
            json.dumps(product_in.sizes),
            json.dumps(colors_data),
            json.dumps(product_in.images),
            product_in.stock,
            1 if product_in.featured else 0,
            1 if product_in.is_new else 0
        )
    )

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
    return format_product_row(row)

@router.put("/products/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    product_in: ProductUpdate,
    admin: dict = Depends(get_current_admin)
):
    existing = query_db("SELECT * FROM products WHERE id = ?", (product_id,), one=True)
    if not existing:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    updates = []
    params = []

    if product_in.name is not None:
        updates.append("name = ?")
        params.append(product_in.name)

    if product_in.description is not None:
        updates.append("description = ?")
        params.append(product_in.description)

    if product_in.price_cop is not None:
        updates.append("price_cop = ?")
        params.append(product_in.price_cop)

    if product_in.category_id is not None:
        updates.append("category_id = ?")
        params.append(product_in.category_id)

    if product_in.sizes is not None:
        updates.append("sizes = ?")
        params.append(json.dumps(product_in.sizes))

    if product_in.colors is not None:
        updates.append("colors = ?")
        params.append(json.dumps([c.model_dump() for c in product_in.colors]))

    if product_in.images is not None:
        updates.append("images = ?")
        params.append(json.dumps(product_in.images))

    if product_in.stock is not None:
        updates.append("stock = ?")
        params.append(product_in.stock)

    if product_in.featured is not None:
        updates.append("featured = ?")
        params.append(1 if product_in.featured else 0)

    if product_in.is_new is not None:
        updates.append("is_new = ?")
        params.append(1 if product_in.is_new else 0)

    if updates:
        sql = f"UPDATE products SET {', '.join(updates)} WHERE id = ?"
        params.append(product_id)
        execute_db(sql, params)

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
    return format_product_row(row)

@router.delete("/products/{product_id}")
def delete_product(product_id: int, admin: dict = Depends(get_current_admin)):
    existing = query_db("SELECT id, name FROM products WHERE id = ?", (product_id,), one=True)
    if not existing:
        raise HTTPException(status_code=404, detail="Producto no encontrado.")

    execute_db("DELETE FROM products WHERE id = ?", (product_id,))
    return {"success": True, "message": f"Producto '{existing['name']}' eliminado correctamente."}

@router.post("/products/clear-images")
def clear_catalog_images(admin: dict = Depends(get_current_admin)):
    """Deja sin fotos todos los productos, conservando el resto de los datos.

    Sirve para partir de un catalogo limpio y subir las imagenes propias.
    """
    total_row = query_db("SELECT COUNT(*) as c FROM products", one=True)
    total = total_row["c"] if total_row else 0

    execute_db("UPDATE products SET images = ?", (json.dumps([]),))

    return {
        "success": True,
        "cleared": total,
        "message": f"Se quitaron las imagenes de {total} productos. Ya puedes subir las tuyas."
    }


# ----------------------------------------------------------------------
# CATEGORIAS (las tarjetas de la portada: imagen, titulo y descripcion)
# ----------------------------------------------------------------------

@router.get("/categories", response_model=List[CategoryOut])
def get_admin_categories(admin: dict = Depends(get_current_admin)):
    return query_db(
        "SELECT id, name, slug, description, image_url, tagline FROM categories ORDER BY id ASC"
    )


@router.put("/categories/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    category_in: CategoryUpdate,
    admin: dict = Depends(get_current_admin)
):
    """Actualiza una categoria. Un image_url vacio deja la tarjeta sin foto."""
    existing = query_db("SELECT * FROM categories WHERE id = ?", (category_id,), one=True)
    if not existing:
        raise HTTPException(status_code=404, detail="Categoria no encontrada.")

    updates, params = [], []
    for field in ("name", "description", "image_url", "tagline"):
        value = getattr(category_in, field, None)
        if value is None:
            continue
        if field == "name" and not value.strip():
            raise HTTPException(status_code=400, detail="La categoria debe tener un nombre.")
        updates.append(f"{field} = ?")
        params.append(value.strip())

    if updates:
        params.append(category_id)
        execute_db(f"UPDATE categories SET {', '.join(updates)} WHERE id = ?", params)

    return query_db(
        "SELECT id, name, slug, description, image_url, tagline FROM categories WHERE id = ?",
        (category_id,),
        one=True
    )


@router.post("/categories/clear-images")
def clear_category_images(admin: dict = Depends(get_current_admin)):
    """Deja sin foto las tarjetas de categoria de la portada."""
    total_row = query_db("SELECT COUNT(*) as c FROM categories", one=True)
    total = total_row["c"] if total_row else 0

    execute_db("UPDATE categories SET image_url = ''")

    return {
        "success": True,
        "cleared": total,
        "message": f"Se quitaron las imagenes de {total} categorias. Ya puedes subir las tuyas."
    }


# ----------------------------------------------------------------------
# CARRUSEL DE LA PORTADA
# ----------------------------------------------------------------------

LINK_TYPES = {"none", "catalog", "category", "section", "url"}


def format_slide_row(row):
    data = dict(row)
    data["enabled"] = bool(data.get("enabled", 1))
    return data


@router.get("/hero-slides", response_model=List[HeroSlideOut])
def get_admin_hero_slides(admin: dict = Depends(get_current_admin)):
    rows = query_db("SELECT * FROM hero_slides ORDER BY position ASC, id ASC")
    return [format_slide_row(r) for r in rows]


@router.post("/hero-slides", response_model=HeroSlideOut)
def create_hero_slide(slide_in: HeroSlideCreate, admin: dict = Depends(get_current_admin)):
    if slide_in.link_type not in LINK_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de enlace no valido.")

    pos_row = query_db("SELECT MAX(position) as m FROM hero_slides", one=True)
    next_pos = (pos_row["m"] or 0) + 1

    slide_id = execute_db(
        """INSERT INTO hero_slides
           (image_url, title, subtitle, cta_text, link_type, link_value, position, enabled)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            slide_in.image_url or "", slide_in.title or "", slide_in.subtitle or "",
            slide_in.cta_text or "", slide_in.link_type, slide_in.link_value or "",
            next_pos, 1 if slide_in.enabled else 0
        )
    )
    return format_slide_row(query_db("SELECT * FROM hero_slides WHERE id = ?", (slide_id,), one=True))


@router.put("/hero-slides/{slide_id}", response_model=HeroSlideOut)
def update_hero_slide(
    slide_id: int,
    slide_in: HeroSlideUpdate,
    admin: dict = Depends(get_current_admin)
):
    existing = query_db("SELECT * FROM hero_slides WHERE id = ?", (slide_id,), one=True)
    if not existing:
        raise HTTPException(status_code=404, detail="Diapositiva no encontrada.")

    if slide_in.link_type is not None and slide_in.link_type not in LINK_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de enlace no valido.")

    updates, params = [], []
    for field in ("image_url", "title", "subtitle", "cta_text",
                  "link_type", "link_value", "enabled", "position"):
        value = getattr(slide_in, field, None)
        if value is None:
            continue
        if field == "enabled":
            value = 1 if value else 0
        updates.append(f"{field} = ?")
        params.append(value)

    if updates:
        params.append(slide_id)
        execute_db(f"UPDATE hero_slides SET {', '.join(updates)} WHERE id = ?", params)

    return format_slide_row(query_db("SELECT * FROM hero_slides WHERE id = ?", (slide_id,), one=True))


@router.post("/hero-slides/reorder")
def reorder_hero_slides(payload: HeroSlideReorder, admin: dict = Depends(get_current_admin)):
    for index, slide_id in enumerate(payload.ordered_ids, start=1):
        execute_db("UPDATE hero_slides SET position = ? WHERE id = ?", (index, slide_id))
    return {"success": True, "message": "Orden del carrusel actualizado."}


@router.delete("/hero-slides/{slide_id}")
def delete_hero_slide(slide_id: int, admin: dict = Depends(get_current_admin)):
    existing = query_db("SELECT * FROM hero_slides WHERE id = ?", (slide_id,), one=True)
    if not existing:
        raise HTTPException(status_code=404, detail="Diapositiva no encontrada.")

    execute_db("DELETE FROM hero_slides WHERE id = ?", (slide_id,))
    return {"success": True, "message": "Diapositiva eliminada del carrusel."}


@router.post("/categories", response_model=CategoryOut)
def create_category(category_in: CategoryCreate, admin: dict = Depends(get_current_admin)):
    """Crea una categoria nueva; aparece de una vez en la portada y en los enlaces."""
    name = category_in.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="La categoria debe tener un nombre.")

    base = name.lower()
    for a, b in (("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"), ("ñ", "n"), (" ", "-")):
        base = base.replace(a, b)
    slug = "".join(c for c in base if c.isalnum() or c == "-").strip("-") or "categoria"
    if query_db("SELECT id FROM categories WHERE slug = ?", (slug,), one=True):
        slug = f"{slug}-{uuid.uuid4().hex[:4]}"

    category_id = execute_db(
        "INSERT INTO categories (name, slug, description, image_url, tagline) VALUES (?, ?, ?, ?, ?)",
        (name, slug, category_in.description or "", category_in.image_url or "", category_in.tagline or "")
    )
    return query_db(
        "SELECT id, name, slug, description, image_url, tagline FROM categories WHERE id = ?",
        (category_id,), one=True
    )


@router.delete("/categories/{category_id}")
def delete_category(category_id: int, admin: dict = Depends(get_current_admin)):
    """Elimina una categoria. Sus productos se conservan y quedan sin categoria."""
    existing = query_db("SELECT * FROM categories WHERE id = ?", (category_id,), one=True)
    if not existing:
        raise HTTPException(status_code=404, detail="Categoria no encontrada.")

    count_row = query_db(
        "SELECT COUNT(*) as c FROM products WHERE category_id = ?", (category_id,), one=True
    )
    afectados = count_row["c"] if count_row else 0

    execute_db("DELETE FROM categories WHERE id = ?", (category_id,))

    # Las diapositivas que apuntaban a esta categoria quedan sin enlace.
    execute_db(
        "UPDATE hero_slides SET link_type = 'none', link_value = '' "
        "WHERE link_type = 'category' AND link_value = ?",
        (existing["slug"],)
    )

    return {
        "success": True,
        "affected_products": afectados,
        "message": (
            f"Categoria '{existing['name']}' eliminada. "
            f"{afectados} producto(s) quedaron sin categoria."
        )
    }


@router.post("/upload")
async def upload_image(file: UploadFile = File(...), admin: dict = Depends(get_current_admin)):
    # Validate extension
    allowed = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Formato de imagen no soportado. Usa JPG, PNG o WebP.")

    filename = f"prod_{uuid.uuid4().hex[:10]}{ext}"
    file_path = UPLOAD_DIR / filename

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    return {
        "success": True,
        "filename": filename,
        "url": f"/uploads/{filename}"
    }

# ----------------------------------------------------------------------
# SECCIONES DE LA PORTADA (crear / ocultar / reordenar / eliminar)
# ----------------------------------------------------------------------

@router.get("/sections", response_model=List[SectionOut])
def get_admin_sections(admin: dict = Depends(get_current_admin)):
    """Todas las secciones, incluidas las ocultas, para gestionarlas."""
    rows = query_db("SELECT * FROM sections ORDER BY position ASC, id ASC")
    return [format_section_row(r) for r in rows]


@router.post("/sections", response_model=SectionOut)
def create_section(section_in: SectionCreate, admin: dict = Depends(get_current_admin)):
    """Crea una seccion personalizada nueva al final de la portada."""
    title = section_in.title.strip()
    if not title:
        raise HTTPException(status_code=400, detail="La seccion debe tener un titulo.")

    # Clave unica legible a partir del titulo
    base = title.lower().strip()
    for a, b in (("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"), ("ñ", "n"), (" ", "-")):
        base = base.replace(a, b)
    clean = "".join(c for c in base if c.isalnum() or c == "-").strip("-") or "seccion"
    key = f"custom-{clean}"
    if query_db("SELECT id FROM sections WHERE section_key = ?", (key,), one=True):
        key = f"{key}-{uuid.uuid4().hex[:4]}"

    pos_row = query_db("SELECT MAX(position) as m FROM sections", one=True)
    next_pos = (pos_row["m"] or 0) + 1

    section_id = execute_db(
        """INSERT INTO sections
           (section_key, title, subtitle, body, image_url, cta_text, cta_link,
            position, enabled, is_custom)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)""",
        (
            key, title, section_in.subtitle or "", section_in.body or "",
            section_in.image_url or "", section_in.cta_text or "",
            section_in.cta_link or "", next_pos, 1 if section_in.enabled else 0
        )
    )

    row = query_db("SELECT * FROM sections WHERE id = ?", (section_id,), one=True)
    return format_section_row(row)


@router.put("/sections/{section_id}", response_model=SectionOut)
def update_section(
    section_id: int,
    section_in: SectionUpdate,
    admin: dict = Depends(get_current_admin)
):
    """Actualiza una seccion. Las secciones fijas solo aceptan enabled/position."""
    existing = query_db("SELECT * FROM sections WHERE id = ?", (section_id,), one=True)
    if not existing:
        raise HTTPException(status_code=404, detail="Seccion no encontrada.")

    is_custom = bool(existing["is_custom"])
    editable = ["enabled", "position"]
    if is_custom:
        editable += ["title", "subtitle", "body", "image_url", "cta_text", "cta_link"]

    updates, params = [], []
    for field in editable:
        value = getattr(section_in, field, None)
        if value is None:
            continue
        if field == "enabled":
            value = 1 if value else 0
        updates.append(f"{field} = ?")
        params.append(value)

    if updates:
        params.append(section_id)
        execute_db(f"UPDATE sections SET {', '.join(updates)} WHERE id = ?", params)

    row = query_db("SELECT * FROM sections WHERE id = ?", (section_id,), one=True)
    return format_section_row(row)


@router.post("/sections/reorder")
def reorder_sections(payload: SectionReorder, admin: dict = Depends(get_current_admin)):
    """Guarda el nuevo orden de las secciones de la portada."""
    for index, section_id in enumerate(payload.ordered_ids, start=1):
        execute_db("UPDATE sections SET position = ? WHERE id = ?", (index, section_id))
    return {"success": True, "message": "Orden de las secciones actualizado."}


@router.delete("/sections/{section_id}")
def delete_section(section_id: int, admin: dict = Depends(get_current_admin)):
    """Elimina una seccion personalizada. Las fijas solo se pueden ocultar."""
    existing = query_db("SELECT * FROM sections WHERE id = ?", (section_id,), one=True)
    if not existing:
        raise HTTPException(status_code=404, detail="Seccion no encontrada.")

    if not existing["is_custom"]:
        raise HTTPException(
            status_code=400,
            detail="Las secciones fijas del sitio no se pueden eliminar, solo desactivar."
        )

    execute_db("DELETE FROM sections WHERE id = ?", (section_id,))
    return {"success": True, "message": f"Seccion '{existing['title']}' eliminada."}


@router.get("/settings")
def get_admin_settings(admin: dict = Depends(get_current_admin)):
    rows = query_db("SELECT key, value FROM settings")
    settings_dict = {r["key"]: r["value"] for r in rows}
    return settings_dict

@router.post("/settings")
def update_admin_settings(settings_data: dict, admin: dict = Depends(get_current_admin)):
    for key, value in settings_data.items():
        execute_db(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, str(value))
        )
    return {"success": True, "message": "Configuración guardada correctamente."}

@router.post("/logo-upload")
async def upload_logo(file: UploadFile = File(...), admin: dict = Depends(get_current_admin)):
    allowed = {".jpg", ".jpeg", ".png", ".webp", ".svg"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="Formato no válido. Usa JPG, PNG, WebP o SVG.")

    filename = f"logo_{uuid.uuid4().hex[:8]}{ext}"
    file_path = UPLOAD_DIR / filename

    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    logo_url = f"/uploads/{filename}"
    execute_db(
        "INSERT INTO settings (key, value) VALUES ('logo_url', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (logo_url,)
    )

class AdminPasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/change-password")
def change_admin_password(
    req: AdminPasswordChangeRequest,
    admin: dict = Depends(get_current_admin)
):
    from app.auth import verify_password, hash_password
    
    # Retrieve current admin record with password hash
    admin_row = query_db("SELECT * FROM users WHERE id = ?", (admin["id"],), one=True)
    if not admin_row or not verify_password(req.current_password, admin_row["password_hash"]):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta.")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 6 caracteres.")

    new_hash = hash_password(req.new_password)
    execute_db("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, admin["id"]))

    return {"success": True, "message": "¡Contraseña de Administrador actualizada correctamente!"}


