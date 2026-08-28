from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from contextlib import asynccontextmanager

from app.seed_data import seed_database
from app.routers import auth_routes, product_routes, order_routes, payment_routes, admin_routes

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
UPLOAD_DIR = BASE_DIR / "app" / "uploads"

# Ensure directories exist
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
STATIC_DIR.mkdir(parents=True, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: seed database if first time
    seed_database()
    yield

app = FastAPI(
    title="Alice Brand E-Commerce API",
    description="API REST Fullstack para Alice Brand - Boutique de vestidos de baño y moda costera en Colombia.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth_routes.router)
app.include_router(product_routes.router)
app.include_router(order_routes.router)
app.include_router(payment_routes.router)
app.include_router(admin_routes.router)

# Mount uploads static folder
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Mount general static assets
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Serve Frontend Single Page Application
@app.get("/")
async def serve_home():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return HTMLResponse("<h1>Alice Brand Backend activo. Creando frontend...</h1>")

# Fallback for SPA routing and simulator
@app.get("/admin")
@app.get("/pse-simulator")
@app.get("/checkout")
@app.get("/catalogo")
@app.get("/perfil")
async def serve_spa_routes():
    index_file = STATIC_DIR / "index.html"
    return FileResponse(str(index_file))
