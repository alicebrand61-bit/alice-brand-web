import uvicorn
import sys
import os

if __name__ == "__main__":
    # Ensure current directory is in sys.path
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    
    print("==========================================================")
    print("ALICE BRAND - BOUTIQUE E-COMMERCE FULLSTACK (COLOMBIA)")
    print("==========================================================")
    print("Servidor en ejecucion: http://127.0.0.1:8000")
    print("Documentacion API Swagger: http://127.0.0.1:8000/docs")
    print("Acceso Administrador Demo: admin@alicebrand.com / admin123")
    print("WhatsApp Oficial: +57 302 3949733")
    print("Instagram: @alicee_brand")
    print("==========================================================")
    
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
