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
        ("payment_mode", "wompi_pse")
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
