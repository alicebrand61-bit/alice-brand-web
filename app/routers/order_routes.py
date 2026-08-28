import uuid
import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, status
from app.models import OrderCreate, OrderOut, OrderItemOut
from app.database import query_db, execute_db
from app.auth import get_current_user, security, decode_token

router = APIRouter(prefix="/api/orders", tags=["Órdenes"])

def generate_order_number() -> str:
    year = datetime.datetime.now().year
    random_part = uuid.uuid4().hex[:6].upper()
    return f"ALICE-{year}-{random_part}"

def get_order_with_items(order_id: int) -> dict:
    order = query_db("SELECT * FROM orders WHERE id = ?", (order_id,), one=True)
    if not order:
        return None
    items = query_db("SELECT * FROM order_items WHERE order_id = ?", (order_id,))
    order_dict = dict(order)
    order_dict["items"] = items or []
    return order_dict

@router.post("", response_model=OrderOut)
def create_order(order_in: OrderCreate):
    if not order_in.items:
        raise HTTPException(status_code=400, detail="El carrito está vacío. Agrega productos para ordenar.")

    order_number = generate_order_number()
    
    # Try to extract user if authorization header exists
    user_id = None
    # Calculate subtotal verification
    calculated_subtotal = 0.0
    for item in order_in.items:
        calculated_subtotal += item.unit_price_cop * item.quantity

    subtotal = calculated_subtotal
    shipping = order_in.shipping_cop
    discount = order_in.discount_cop
    total = max(0.0, subtotal + shipping - discount)

    # Insert order
    order_id = execute_db(
        """
        INSERT INTO orders (
            order_number, user_id, customer_name, customer_email, customer_phone,
            department, city, address, address_details, subtotal_cop, shipping_cop,
            discount_cop, total_cop, payment_method, payment_status, pse_bank,
            order_status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            order_number,
            user_id,
            order_in.customer_name,
            order_in.customer_email.lower(),
            order_in.customer_phone,
            order_in.department,
            order_in.city,
            order_in.address,
            order_in.address_details,
            subtotal,
            shipping,
            discount,
            total,
            order_in.payment_method,
            "pending",
            order_in.pse_bank,
            "Pendiente",
            order_in.notes
        )
    )

    # Insert items & decrease product stock
    for item in order_in.items:
        item_subtotal = item.unit_price_cop * item.quantity
        execute_db(
            """
            INSERT INTO order_items (
                order_id, product_id, product_name, product_image, size, color,
                quantity, unit_price_cop, subtotal_cop
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                order_id,
                item.product_id,
                item.product_name,
                item.product_image,
                item.size,
                item.color,
                item.quantity,
                item.unit_price_cop,
                item_subtotal
            )
        )
        # Update product stock
        if item.product_id:
            execute_db(
                "UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?",
                (item.quantity, item.product_id)
            )

    return get_order_with_items(order_id)

@router.get("/number/{order_number}", response_model=OrderOut)
def get_order_by_number(order_number: str):
    order = query_db("SELECT * FROM orders WHERE order_number = ?", (order_number,), one=True)
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada.")
    items = query_db("SELECT * FROM order_items WHERE order_id = ?", (order["id"],))
    order_dict = dict(order)
    order_dict["items"] = items or []
    return order_dict

@router.get("/user/my-orders", response_model=List[OrderOut])
def get_my_orders(current_user: dict = Depends(get_current_user)):
    orders = query_db(
        "SELECT * FROM orders WHERE user_id = ? OR customer_email = ? ORDER BY id DESC",
        (current_user["id"], current_user["email"])
    )
    result = []
    for o in orders:
        items = query_db("SELECT * FROM order_items WHERE order_id = ?", (o["id"],))
        o_dict = dict(o)
        o_dict["items"] = items or []
        result.append(o_dict)
    return result
