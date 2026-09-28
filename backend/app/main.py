import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import health, chat, auth_routes

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("paylume-backend")

app = FastAPI(
    title="Paylume Intelligence API",
    description="Multimodal cybersecurity RAG assistant for payment scams, phishing, malicious URLs, and QR scams.",
    version="1.0.0"
)

# Configure CORS origins
raw_origins = (settings.FRONTEND_ORIGIN or "").split(",")
allowed_origins = [o.strip() for o in raw_origins if o.strip()]
for default_origin in ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001"]:
    if default_origin not in allowed_origins:
        allowed_origins.append(default_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health.router)
app.include_router(chat.router)
app.include_router(auth_routes.router)

@app.on_event("startup")
async def startup_event():
    logger.info("Paylume Intelligence Backend successfully initiated.")
    logger.info(f"CORS allowed origins: {allowed_origins}")
    logger.info(f"Gemini generation model: {settings.GENERATION_MODEL}")
    logger.info(f"Gemini embedding model: {settings.EMBEDDING_MODEL} (1536 dim)")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
