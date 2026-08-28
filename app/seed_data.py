import json
from app.database import query_db, execute_db, init_db
from app.auth import hash_password

def seed_database():
    init_db()

    # Check if already seeded
    existing_users = query_db("SELECT count(*) as count FROM users", one=True)
    if existing_users and existing_users["count"] > 0:
        return

    print("[+] Sembrando base de datos con informacion inicial de Alice Brand...")

    # 1. Seed Users (Admin & Customer)
    admin_pass = hash_password("admin123")
    customer_pass = hash_password("cliente123")

    execute_db(
        "INSERT INTO users (email, full_name, phone, password_hash, role, auth_provider) VALUES (?, ?, ?, ?, ?, ?)",
        ("admin@alicebrand.com", "Admin Alice Brand", "+573023949733", admin_pass, "admin", "local")
    )
    execute_db(
        "INSERT INTO users (email, full_name, phone, password_hash, role, auth_provider) VALUES (?, ?, ?, ?, ?, ?)",
        ("cliente@alicebrand.com", "Camila Restrepo", "+573105559876", customer_pass, "customer", "local")
    )

    # 2. Seed Categories
    categories = [
        {
            "name": "Vestidos de Baño",
            "slug": "vestidos-de-bano",
            "description": "Bikinis, enterizos y trikinis elaborados con textiles sostenibles de alta durabilidad y protección solar UPF 50+.",
            "image_url": "https://images.unsplash.com/photo-1576426863848-c21f53c60b19?auto=format&fit=crop&w=800&q=80"
        },
        {
            "name": "Accesorios de Playa",
            "slug": "accesorios",
            "description": "Pareos de seda, sombreros en fibra de caña flecha, bolsos playeros y complementos de lujo costero.",
            "image_url": "https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=800&q=80"
        },
        {
            "name": "Colección Caribe Esmeralda",
            "slug": "colecciones",
            "description": "Línea exclusiva inspirada en los tonos verde oliva y dorados de las costas colombianas y el mar caribe.",
            "image_url": "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=800&q=80"
        }
    ]

    cat_ids = {}
    for cat in categories:
        cid = execute_db(
            "INSERT INTO categories (name, slug, description, image_url) VALUES (?, ?, ?, ?)",
            (cat["name"], cat["slug"], cat["description"], cat["image_url"])
        )
        cat_ids[cat["slug"]] = cid

    # 3. Seed Products (6+ realistic Colombian luxury boutique swimwear & beachwear products)
    products = [
        {
            "name": "Bikini Triángulo Caribe Esmeralda",
            "slug": "bikini-triangulo-caribe-esmeralda",
            "description": "Bikini clásico de corte triangular en tono Verde Oliva distintivo de Alice Brand. Confeccionado con tejido ecológico reciclado y detalles metálicos en baño de oro de 24k resistentes al agua salada y cloro.",
            "price_cop": 185000.0,
            "category_id": cat_ids["vestidos-de-bano"],
            "sizes": ["S", "M", "L"],
            "colors": [
                {"name": "Verde Oliva", "hex": "#4D6E12"},
                {"name": "Arena Suave", "hex": "#F5EFC6"},
                {"name": "Negro Clásico", "hex": "#231815"}
            ],
            "images": [
                "https://images.unsplash.com/photo-1576426863848-c21f53c60b19?auto=format&fit=crop&w=1000&q=85",
                "https://images.unsplash.com/photo-1582639510494-c80b5de9f148?auto=format&fit=crop&w=1000&q=85",
                "https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=1000&q=85"
            ],
            "stock": 18,
            "featured": 1,
            "is_new": 1
        },
        {
            "name": "Enterizo Asimétrico Barú",
            "slug": "enterizo-asimetrico-baru",
            "description": "Enterizo de un solo hombro con diseño estructurado que estiliza la silueta. Ofrece forro de compresión suave, copas removibles y un drapeado sofisticado en tono Azul Cielo y Arena.",
            "price_cop": 230000.0,
            "category_id": cat_ids["vestidos-de-bano"],
            "sizes": ["S", "M", "L", "XL"],
            "colors": [
                {"name": "Azul Cielo", "hex": "#A5BCD6"},
                {"name": "Café Cálido", "hex": "#4A2E27"},
                {"name": "Verde Oliva", "hex": "#4D6E12"}
            ],
            "images": [
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=85",
                "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=85",
                "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=1000&q=85"
            ],
            "stock": 12,
            "featured": 1,
            "is_new": 1
        },
        {
            "name": "Bikini High-Waist Tayrona Glow",
            "slug": "bikini-high-waist-tayrona-glow",
            "description": "Conjunto de bikini de tiro alto estilo retro chic con escote balconette que realza el busto. Fabricado con tela texturizada acanalada de secado ultra rápido en color Arena Dorada.",
            "price_cop": 195000.0,
            "category_id": cat_ids["vestidos-de-bano"],
            "sizes": ["S", "M", "L"],
            "colors": [
                {"name": "Arena Suave", "hex": "#F5EFC6"},
                {"name": "Café Cálido", "hex": "#4A2E27"}
            ],
            "images": [
                "https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=1000&q=85",
                "https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1000&q=85"
            ],
            "stock": 25,
            "featured": 0,
            "is_new": 1
        },
        {
            "name": "Kimono Salida de Baño Seda Costera",
            "slug": "kimono-salida-de-bano-seda-costera",
            "description": "Salida de baño tipo kimono maxi en chifón de seda ligero y vaporoso. Estampado botánico sutil inspirado en los manglares colombianos y remates con flecos artesanales.",
            "price_cop": 160000.0,
            "category_id": cat_ids["accesorios"],
            "sizes": ["Talla Única"],
            "colors": [
                {"name": "Verde Oliva & Arena", "hex": "#4D6E12"},
                {"name": "Azul Agua", "hex": "#A5BCD6"}
            ],
            "images": [
                "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=85",
                "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1000&q=85"
            ],
            "stock": 15,
            "featured": 1,
            "is_new": 0
        },
        {
            "name": "Sombrero Playero Palma Real & Cinta AB",
            "slug": "sombrero-playero-palma-real-cinta-ab",
            "description": "Sombrero de ala ancha tejido a mano por maestras artesanas colombianas en palma natural. Cuenta con cinta de tela intercambiable bordada con el monograma dorado de Alice Brand.",
            "price_cop": 140000.0,
            "category_id": cat_ids["accesorios"],
            "sizes": ["Ajustable"],
            "colors": [
                {"name": "Palma Natural", "hex": "#F5EFC6"},
                {"name": "Café Tostado", "hex": "#4A2E27"}
            ],
            "images": [
                "https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=1000&q=85",
                "https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=1000&q=85"
            ],
            "stock": 20,
            "featured": 0,
            "is_new": 1
        },
        {
            "name": "Bolso Tote Macramé & Cuero Café",
            "slug": "bolso-tote-macrame-cuero-cafe",
            "description": "Bolso espacioso para playa y piscina elaborado en tejido macramé de algodón orgánico con asas reforzadas en cuero café genuino colombiano y forro impermeable interior.",
            "price_cop": 175000.0,
            "category_id": cat_ids["accesorios"],
            "sizes": ["Talla Única"],
            "colors": [
                {"name": "Arena & Cuero Café", "hex": "#4A2E27"},
                {"name": "Verde Oliva Natural", "hex": "#4D6E12"}
            ],
            "images": [
                "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=1000&q=85",
                "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=85"
            ],
            "stock": 10,
            "featured": 1,
            "is_new": 0
        },
        {
            "name": "Triquini Escote Cruzado Cartagena Luxe",
            "slug": "triquini-escote-cruzado-cartagena-luxe",
            "description": "Diseño vanguardista de triquini con cortes frontales favorecedores, anilla central en acabado carey y tiras ajustables multidireccionales para un bronceado personalizado.",
            "price_cop": 245000.0,
            "category_id": cat_ids["colecciones"],
            "sizes": ["S", "M", "L"],
            "colors": [
                {"name": "Verde Oliva", "hex": "#4D6E12"},
                {"name": "Azul Profundo", "hex": "#231815"}
            ],
            "images": [
                "https://images.unsplash.com/photo-1574015974293-817f0ebebb74?auto=format&fit=crop&w=1000&q=85",
                "https://images.unsplash.com/photo-1576426863848-c21f53c60b19?auto=format&fit=crop&w=1000&q=85"
            ],
            "stock": 8,
            "featured": 1,
            "is_new": 1
        }
    ]

    for p in products:
        execute_db(
            """
            INSERT INTO products (name, slug, description, price_cop, category_id, sizes, colors, images, stock, featured, is_new)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                p["name"],
                p["slug"],
                p["description"],
                p["price_cop"],
                p["category_id"],
                json.dumps(p["sizes"]),
                json.dumps(p["colors"]),
                json.dumps(p["images"]),
                p["stock"],
                p["featured"],
                p["is_new"]
            )
        )

    # 4. Seed an initial sample order for testing admin view
    order_id = execute_db(
        """
        INSERT INTO orders (
            order_number, user_id, customer_name, customer_email, customer_phone,
            department, city, address, address_details, subtotal_cop, shipping_cop,
            discount_cop, total_cop, payment_method, payment_status, pse_bank,
            pse_transaction_id, order_status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "ALICE-2026-0089",
            2,
            "Camila Restrepo",
            "cliente@alicebrand.com",
            "+573105559876",
            "Antioquia",
            "Medellín",
            "Cra 43A # 1-50, El Poblado",
            "Apto 802, Edificio Palma",
            415000.0,
            0.0,
            0.0,
            415000.0,
            "PSE",
            "completed",
            "Bancolombia",
            "PSE-TX-88492019",
            "En Preparación",
            "Enviar empacado para regalo con bolsa Alice Brand"
        )
    )

    execute_db(
        """
        INSERT INTO order_items (order_id, product_id, product_name, product_image, size, color, quantity, unit_price_cop, subtotal_cop)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            order_id,
            1,
            "Bikini Triángulo Caribe Esmeralda",
            "https://images.unsplash.com/photo-1576426863848-c21f53c60b19?auto=format&fit=crop&w=1000&q=85",
            "M",
            "Verde Oliva",
            1,
            185000.0,
            185000.0
        )
    )

    execute_db(
        """
        INSERT INTO order_items (order_id, product_id, product_name, product_image, size, color, quantity, unit_price_cop, subtotal_cop)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            order_id,
            2,
            "Enterizo Asimétrico Barú",
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=85",
            "S",
            "Azul Cielo",
            1,
            230000.0,
            230000.0
        )
    )

    print("[OK] Base de datos inicializada exitosamente con productos y usuarios de prueba.")

if __name__ == "__main__":
    seed_database()
