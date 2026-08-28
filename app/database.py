import sqlite3
import os
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "alice_brand.db"

def get_db_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Users table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        full_name TEXT NOT NULL,
        phone TEXT,
        password_hash TEXT,
        role TEXT DEFAULT 'customer',
        auth_provider TEXT DEFAULT 'local',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Categories table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        image_url TEXT
    );
    """)

    # Products table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL,
        price_cop REAL NOT NULL,
        category_id INTEGER,
        sizes TEXT NOT NULL, -- JSON array of sizes ["S", "M", "L"]
        colors TEXT NOT NULL, -- JSON array of colors [{"name": "Oliva", "hex": "#4D6E12"}]
        images TEXT NOT NULL, -- JSON array of image URLs
        stock INTEGER DEFAULT 10,
        featured INTEGER DEFAULT 0,
        is_new INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
    );
    """)

    # Orders table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        user_id INTEGER,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        department TEXT NOT NULL,
        city TEXT NOT NULL,
        address TEXT NOT NULL,
        address_details TEXT,
        subtotal_cop REAL NOT NULL,
        shipping_cop REAL DEFAULT 0,
        discount_cop REAL DEFAULT 0,
        total_cop REAL NOT NULL,
        payment_method TEXT DEFAULT 'PSE',
        payment_status TEXT DEFAULT 'pending',
        pse_bank TEXT,
        pse_transaction_id TEXT,
        order_status TEXT DEFAULT 'Pendiente', -- Pendiente, Pagado, En Preparación, Enviado, Entregado
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    );
    """)

    # Order Items table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        product_image TEXT,
        size TEXT,
        color TEXT,
        quantity INTEGER NOT NULL,
        unit_price_cop REAL NOT NULL,
        subtotal_cop REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
    );
    """)

    # OTP codes table for phone auth simulation
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS otp_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        verified INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Sections table (secciones de la pagina de inicio, gestionables desde el admin)
    # - is_custom = 0 -> seccion fija del sitio: se puede ocultar y reordenar, no borrar.
    # - is_custom = 1 -> seccion creada desde el panel: se puede editar y borrar.
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section_key TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        subtitle TEXT,
        body TEXT,
        image_url TEXT,
        cta_text TEXT,
        cta_link TEXT,
        position INTEGER DEFAULT 0,
        enabled INTEGER DEFAULT 1,
        is_custom INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Secciones fijas que ya existen en el HTML de la portada
    builtin_sections = [
        ("hero", "Portada Principal (Hero)", "Banner de bienvenida con el titulo y el boton principal", 1),
        ("categories", "Comprar por Categoria", "Cuadricula con las lineas de producto", 2),
        ("featured", "Productos Destacados", "Los productos marcados como destacados", 3),
        ("whatsapp", "Banner de Asesoria por WhatsApp", "Invitacion a escribir por WhatsApp", 4),
    ]
    for key, title, subtitle, pos in builtin_sections:
        cursor.execute(
            """INSERT OR IGNORE INTO sections
               (section_key, title, subtitle, position, enabled, is_custom)
               VALUES (?, ?, ?, ?, 1, 0)""",
            (key, title, subtitle, pos)
        )

    # Store Settings table (Logo, Brand, Payment Keys, Google Client ID)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    """)

    # Insert default settings if empty
    default_settings = [
        ("logo_url", "/static/images/logo-ab.svg"),
        ("brand_name", "Alice Brand"),
        ("brand_slogan", "SWIMWEAR & RESORT WEAR · COLOMBIA"),
        ("primary_color", "#4D0E12"),
        ("secondary_color", "#A5BCD6"),
        ("whatsapp_number", "+573023949733"),
        ("instagram_url", "https://www.instagram.com/alicee_brand?igsi=bmtvbXQzbHhlaWZx"),
        ("instagram_handle", "@alicee_brand"),
        ("google_client_id", "459207869152-sampleclientid.apps.googleusercontent.com"),
        ("wompi_public_key", "pub_test_Q5yDA9xoKdePzhSGeVe9HAUr1jiY25Er"),
        ("wompi_integrity_secret", "test_integrity_45KjhD837shd82jshd9238"),
        ("bold_api_key", ""),
        ("payment_mode", "wompi_pse"),
        # Typography settings
        ("font_heading", "Cormorant Garamond"),
        ("font_body", "Plus Jakarta Sans"),
        # Editable Page Texts (CMS)
        ("announcement_bar_text", "✨ ENVÍOS GRATIS a toda Colombia por compras superiores a $200.000 COP | Usa el cupón ALICE10 para 10% OFF"),
        ("hero_tag", "Colección Costera 2026 · Hecho en Colombia 🇨🇴"),
        ("hero_title", "Elegancia, Comodidad & Siluetas para una Mujer Real"),
        ("hero_subtitle", "Descubre trajes de baño de autor, kimonos en seda vaporosa y accesorios artesanales. Confección colombiana de lujo con protección UPF 50+ y detalles en baño de oro de 24k."),
        ("hero_cta_text", "Comprar Colección"),
        ("about_title", "Sobre Alice Brand"),
        ("about_subtitle", "Nacida en Colombia con la misión de resaltar la belleza y autenticidad de cada mujer a través de prendas de playa elegantes, versátiles y duraderas."),
        ("about_story_heading", "Confección Consciente & Amor por los Detalles"),
        ("about_story_p1", "En Alice Brand fusionamos la tradición textil colombiana con siluetas de alta moda. Cada prenda es elaborada con amor en talleres locales por mujeres cabeza de hogar."),
        ("about_story_p2", "Nuestros tejidos incorporan tecnologías de secado ultra rápido y protección solar UPF 50+, combinados con nuestra icónica paleta Vinotinto (#4D0E12) y Azul Cielo (#A5BCD6)."),
        ("about_image_url", "https://images.unsplash.com/photo-1582639510494-c80b5de9f148?auto=format&fit=crop&w=1000&q=85"),
        ("whatsapp_assistance_title", "¿Dudas con tu talla? Te asesoramos en tiempo real por WhatsApp"),
        ("whatsapp_assistance_desc", "Nuestras asesoras de moda te guían para encontrar la prenda perfecta para tu cuerpo antes de comprar."),
        ("footer_about", "Boutique colombiana de trajes de baño, pareos y complementos de lujo costero. Diseños atemporales confeccionados con pasión y materiales de alta durabilidad.")
    ]

    for k, v in default_settings:
        cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, v))

    conn.commit()

    conn.close()

def query_db(query, args=(), one=False):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(query, args)
    rv = cur.fetchall()
    conn.commit()
    conn.close()
    if not rv:
        return None if one else []
    
    result = [dict(row) for row in rv]
    return result[0] if one else result

def execute_db(query, args=()):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(query, args)
    last_id = cur.lastrowid
    conn.commit()
    conn.close()
    return last_id
