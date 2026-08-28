# 🌺 Alice Brand — Boutique E-Commerce MVP (Colombia)

Plataforma e-commerce Fullstack completa diseñada para **Alice Brand**, boutique colombiana de moda costera, trajes de baño (bikinis, enterizos, trikinis), salidas de baño y accesorios artesanales.

---

## 🎨 Identidad de Marca y Paleta Corporativa

- **Verde Oliva / Hoja**: `#4D6E12` (Acentos principales, botones primarios, badges de éxito)
- **Amarillo / Arena Suave**: `#F5EFC6` (Tarjetas destacadas, contrastes cálidos)
- **Azul Cielo / Agua**: `#A5BCD6` (Acentos marinos de frescura y agua)
- **Café Cálido**: `#4A2E27` (Tipografía secundaria, detalles de sofisticación)
- **Negro / Base**: `#231815` (Texto principal de alta legibilidad)
- **Tipografías**: *Cormorant Garamond* (Serif elegante para títulos) y *Plus Jakarta Sans / Outfit* (Lectura limpia)
- **Isotipo oficial**: Monograma vectorial "AB" con corona de hojas de palma y acabado caribeño.

---

## 🚀 Características Principales

1. **Catálogo Dinámico e Interactivo**:
   - 6+ productos iniciales realistas para vestidos de baño y accesorios colombianos con precios en Pesos Colombianos (COP).
   - Filtros por categorías (*Vestidos de Baño*, *Accesorios de Playa*, *Colección Caribe Esmeralda*).
   - Buscador en tiempo real y ordenamiento por precio y novedades.
   - Vista rápida con galería de fotos, selector de tallas (S, M, L, XL), selector de colores con muestras cromáticas y control de existencias.

2. **Bolsa de Compras Lateral (Slide-over Cart)**:
   - Cálculo automático de subtotal, costo de envío nacional ($15.000 COP o **Gratis** para compras > $200.000 COP) y barra de progreso de envío gratis.
   - Aplicación de cupones de descuento promocionales (`ALICE10` para 10% OFF y `VERANO20` para 20% OFF).

3. **Sistema de Autenticación Triple**:
   - Correo electrónico y contraseña con encriptación `bcrypt` y tokens `JWT`.
   - Autenticación por número celular colombiano mediante código de validación OTP simulado.
   - Botón de integración con Google OAuth ("Continuar con Gmail / Google").

4. **Pasarela de Pagos PSE (Débito Bancario Colombia)**:
   - Catálogo oficial de entidades financieras (Bancolombia, Nequi, Davivienda, Daviplata, Banco de Bogotá, BBVA, Nu Colombia, etc.).
   - Simulador bancario interactivo que replica el flujo de aprobación de ACH Colombia / Wompi / Bold.
   - Generación de comprobante digital con código de autorización y enlace directo a WhatsApp para confirmación de despacho.

5. **Panel de Administración (`/admin`)**:
   - Métricas en tiempo real: Ingresos Totales (COP), Total de Pedidos, Productos en Catálogo, Clientes Registrados y Alertas de Stock Crítico (≤ 5 unidades).
   - **CRUD de Productos**: Crear, editar, eliminar, cambiar precios en COP, tallas, colores e imágenes (con subida de fotos locales y URLs).
   - **Gestión de Órdenes**: Cambio de estado de pedidos en tiempo real (*Pendiente*, *Pagado*, *En Preparación*, *Enviado*, *Entregado*).

6. **Integración con Redes y Canales Oficiales**:
   - **WhatsApp Oficial Directo**: [+57 302 3949733](https://wa.me/573023949733) (incluye botón flotante permanente).
   - **Instagram Oficial**: [@alicee_brand](https://www.instagram.com/alicee_brand?igsi=bmtvbXQzbHhlaWZx).

---

## 🛠️ Requisitos e Instalación

### Requisitos
- Python 3.10 o superior

### Ejecución Rápida

```bash
cd C:\Users\Usuario\.gemini\antigravity\scratch\alice-brand-web
python -m pip install -r requirements.txt
python run.py
```

El servidor iniciará en: **`http://127.0.0.1:8000`**

Documentación interactiva de la API: **`http://127.0.0.1:8000/docs`**

---

## 🔑 Credenciales de Prueba

| Rol | Correo / Identificador | Contraseña | Celular |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@alicebrand.com` | `admin123` | `+573023949733` |
| **Cliente Demo** | `cliente@alicebrand.com` | `cliente123` | `+573105559876` |
| **Código OTP Demo** | — | `123456` (o el generado en pantalla) | Cualquier celular |

---

## 📦 Estructura del Código

```
alice-brand-web/
├── app/
│   ├── database.py         # Conexión SQLite y esquema de tablas
│   ├── models.py           # Esquemas Pydantic
│   ├── auth.py             # JWT, Password Hash y OTP
│   ├── seed_data.py        # Datos de prueba para Colombia
│   ├── routers/
│   │   ├── auth_routes.py
│   │   ├── product_routes.py
│   │   ├── order_routes.py
│   │   ├── payment_routes.py
│   │   └── admin_routes.py
│   └── uploads/            # Fotos subidas
├── static/
│   ├── css/style.css       # Estilos Alice Brand
│   ├── js/
│   │   ├── app.js          # Controlador principal
│   │   ├── auth.js         # Lógica de login y registro
│   │   ├── cart.js         # Bolsa de compras y cálculos COP
│   │   ├── checkout.js     # Checkout y pasarela PSE
│   │   └── admin.js        # Dashboard administrativo
│   ├── images/
│   │   └── logo-ab.svg     # Isotipo vectorial AB oficial
│   └── index.html          # Frontend responsivo
├── run.py                  # Script de arranque
└── requirements.txt        # Dependencias
```
