import sys
import os
import json

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_all():
    print(">>> Iniciando pruebas automatizadas del MVP Alice Brand...")

    # 1. Test Static & Home
    res = client.get("/")
    assert res.status_code == 200, f"Error cargando home: {res.status_code}"
    print("  [OK] Frontend index.html responde correctamente (200 OK)")

    # 2. Test Categories
    res = client.get("/api/categories")
    assert res.status_code == 200
    categories = res.json()
    assert len(categories) >= 3
    print(f"  [OK] Categorias cargadas: {len(categories)} categorias")

    # 3. Test Products
    res = client.get("/api/products")
    assert res.status_code == 200
    products = res.json()
    assert len(products) >= 6
    print(f"  [OK] Catalogo de productos: {len(products)} productos cargados con precios COP")

    # 3b. Test Products filter
    res = client.get("/api/products?category=vestidos-de-bano")
    assert res.status_code == 200
    vb_products = res.json()
    assert len(vb_products) > 0
    print(f"  [OK] Filtro por categoria 'vestidos-de-bano': {len(vb_products)} productos encontrados")

    # 4. Test Auth Login (Admin & Customer)
    res = client.post("/api/auth/login", json={"email": "admin@alicebrand.com", "password": "admin123"})
    assert res.status_code == 200, f"Error login admin: {res.text}"
    admin_token = res.json()["access_token"]
    assert admin_token is not None
    print("  [OK] Autenticacion Admin JWT exitosa")

    res = client.post("/api/auth/login", json={"email": "cliente@alicebrand.com", "password": "cliente123"})
    assert res.status_code == 200
    customer_token = res.json()["access_token"]
    print("  [OK] Autenticacion Cliente JWT exitosa")

    # 5. Test Phone OTP Request & Verify
    res = client.post("/api/auth/phone-otp-request", json={"phone": "+573023949733"})
    assert res.status_code == 200
    otp_code = res.json().get("demo_code", "123456")
    print(f"  [OK] Generacion de OTP para celular: Codigo {otp_code}")

    res = client.post("/api/auth/phone-otp-verify", json={"phone": "+573023949733", "code": otp_code, "full_name": "Usuario OTP"})
    assert res.status_code == 200
    assert "access_token" in res.json()
    print("  [OK] Validacion de OTP por celular completada con token JWT")

    # 6. Test Google OAuth login
    res = client.post("/api/auth/google", json={"email": "valeria.gomez@gmail.com", "full_name": "Valeria Gomez"})
    assert res.status_code == 200
    print("  [OK] Autenticacion Google Sign-In exitosa")

    # 7. Test Order Creation
    order_payload = {
        "customer_name": "Mariana Rios",
        "customer_email": "mariana.rios@ejemplo.com",
        "customer_phone": "+573123456789",
        "department": "Bolivar",
        "city": "Cartagena de Indias",
        "address": "Bocagrande Cra 3 # 6-20",
        "address_details": "Apto 1204",
        "items": [
            {
                "product_id": products[0]["id"],
                "product_name": products[0]["name"],
                "product_image": products[0]["images"][0],
                "size": "S",
                "color": "Verde Oliva",
                "quantity": 1,
                "unit_price_cop": products[0]["price_cop"]
            }
        ],
        "subtotal_cop": products[0]["price_cop"],
        "shipping_cop": 0.0,
        "discount_cop": 0.0,
        "total_cop": products[0]["price_cop"],
        "payment_method": "PSE",
        "pse_bank": "1007",
        "notes": "Entrega en conserjeria"
    }
    res = client.post("/api/orders", json=order_payload)
    assert res.status_code == 200, f"Error creando orden: {res.text}"
    created_order = res.json()
    order_number = created_order["order_number"]
    assert order_number.startswith("ALICE-")
    print(f"  [OK] Creacion de orden #{order_number} exitosa")

    # 8. Test PSE Payments Initiation & Processing
    res = client.get("/api/payments/pse/banks")
    assert res.status_code == 200
    banks = res.json()
    assert len(banks) >= 10
    print(f"  [OK] Catalogo de Bancos PSE cargado ({len(banks)} entidades financieras colombianas)")

    res = client.post("/api/payments/pse/initiate", json={
        "order_number": order_number,
        "bank_code": "1007", # Bancolombia
        "person_type": "NATURAL",
        "document_type": "CC",
        "document_number": "1020304050",
        "payer_name": "Mariana Rios",
        "payer_email": "mariana.rios@ejemplo.com",
        "payer_phone": "+573123456789"
    })
    assert res.status_code == 200
    pse_session = res.json()
    tx_id = pse_session["transaction_id"]
    print(f"  [OK] Transaccion PSE iniciada: ID {tx_id} para Bancolombia")

    # Process / Approve payment in simulator
    res = client.post("/api/payments/pse/process", json={"transaction_id": tx_id, "action": "APPROVE"})
    assert res.status_code == 200
    assert res.json()["status"] == "APPROVED"
    print("  [OK] Aprobacion de transaccion en simulador PSE completada")

    # 9. Test Admin Stats & Product CRUD
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/admin/stats", headers=admin_headers)
    assert res.status_code == 200
    stats = res.json()
    assert stats["total_orders"] >= 1
    print(f"  [OK] Metricas de Administrador: Total ingresos COP ${stats['total_revenue_cop']:,.0f}, {stats['total_orders']} ordenes")

    # Create new product via admin
    new_prod_res = client.post("/api/admin/products", headers=admin_headers, json={
        "name": "Bikini Sunset Barichara",
        "description": "Bikini en tono cafe calido con detalles dorados.",
        "price_cop": 210000.0,
        "category_id": categories[0]["id"],
        "sizes": ["S", "M", "L"],
        "colors": [{"name": "Cafe Calido", "hex": "#4A2E27"}],
        "images": ["https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=1000&q=85"],
        "stock": 14,
        "featured": True,
        "is_new": True
    })
    assert new_prod_res.status_code == 200
    new_prod_id = new_prod_res.json()["id"]
    print(f"  [OK] Admin CRUD: Producto #{new_prod_id} creado con exito")

    # Update product
    update_res = client.put(f"/api/admin/products/{new_prod_id}", headers=admin_headers, json={
        "price_cop": 199000.0,
        "stock": 20
    })
    assert update_res.status_code == 200
    assert update_res.json()["price_cop"] == 199000.0
    print("  [OK] Admin CRUD: Producto actualizado con exito")

    # Delete product
    del_res = client.delete(f"/api/admin/products/{new_prod_id}", headers=admin_headers)
    assert del_res.status_code == 200
    print("  [OK] Admin CRUD: Producto eliminado con exito")

    print("\n========================================================")
    print(">>> [EXITO TOTAL] Todas las pruebas del MVP Alice Brand pasaron al 100%!")
    print("========================================================")

if __name__ == "__main__":
    test_all()
