import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend root or parent if present
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

class Settings:
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

    # Embedding model configuration
    EMBEDDING_MODEL: str = "models/gemini-embedding-2"
    EMBEDDING_DIMENSION: int = 1536

    # Generation model configuration (Primary + Resilient Fallback Cascade)
    GENERATION_MODELS: list = [
        "models/gemini-3.6-flash",
        "models/gemini-3-flash-preview",
        "models/gemini-3.1-flash-lite-preview",
        "models/gemini-flash-lite-latest"
    ]
    GENERATION_MODEL: str = "models/gemini-3.6-flash"

    # Upload and network limits
    MAX_IMAGE_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    MAX_URL_CONTENT_BYTES: int = 1 * 1024 * 1024   # 1 MB
    URL_REQUEST_TIMEOUT_SECONDS: float = 8.0

settings = Settings()
