import os
import sys
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import logging
from app.config import settings
from app.services.ingestion_service import ingestion_service

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ingestion")

DOCUMENTS_METADATA = [
    {
        "filename": "cisa_phishing_guidelines.md",
        "title": "CISA Security Tip ST04-014: Recognizing and Reporting Phishing",
        "source": "CISA",
        "category": "phishing",
        "source_url": "https://www.cisa.gov/news-events/news/recognizing-and-avoiding-phishing"
    },
    {
        "filename": "ftc_payment_scams.md",
        "title": "FTC Consumer Advice: Avoiding P2P Payment and Wire Transfer Scams",
        "source": "FTC",
        "category": "payment_scams",
        "source_url": "https://consumer.ftc.gov/articles/how-to-avoid-scam"
    },
    {
        "filename": "cisa_fbi_qr_code_tampering.md",
        "title": "CISA / FBI Cyber Alert: Malicious QR Codes and Parking Meter Tampering",
        "source": "CISA",
        "category": "qr_scams",
        "source_url": "https://www.cisa.gov/resources-tools/tips/qr-code-safety"
    },
    {
        "filename": "owasp_malicious_urls_and_fake_websites.md",
        "title": "OWASP Guidance: Deceptive Domains, Malicious URLs, and SSL/TLS Misconceptions",
        "source": "OWASP",
        "category": "malicious_urls",
        "source_url": "https://owasp.org/www-community/attacks/Phishing"
    },
    {
        "filename": "cert_in_suspicious_payment_requests.md",
        "title": "CERT-In Advisory: Fake Payment Requests and Instant Gateway Fraud",
        "source": "CERT-In",
        "category": "payment_scams",
        "source_url": "https://www.cert-in.org.in/"
    }
]

def run_ingestion():
    logger.info("Starting Paylume RAG Ingestion Pipeline...")
    logger.info(f"Target Supabase URL: {settings.SUPABASE_URL}")
    logger.info(f"Embedding model: {settings.EMBEDDING_MODEL} (1536 dims)")

    if not settings.SUPABASE_SERVICE_ROLE_KEY or "YOUR_SUPABASE" in settings.SUPABASE_SERVICE_ROLE_KEY:
        logger.error(
            "\n=======================================================\n"
            "ERROR: SUPABASE_SERVICE_ROLE_KEY is not configured in backend/.env!\n"
            "Please add your actual Supabase Service Role Secret Key to backend/.env\n"
            "to insert vectors into your public.documents table.\n"
            "=======================================================\n"
        )
        return False

    sources_dir = Path(__file__).resolve().parent / "sources"
    total_docs = len(DOCUMENTS_METADATA)
    total_inserted = 0
    total_skipped = 0

    for doc_info in DOCUMENTS_METADATA:
        file_path = sources_dir / doc_info["filename"]
        if not file_path.exists():
            logger.warning(f"Source file not found: {file_path}")
            continue

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()

        logger.info(f"Ingesting: '{doc_info['title']}' ({doc_info['source']})...")
        try:
            res = ingestion_service.ingest_document(
                document_title=doc_info["title"],
                source=doc_info["source"],
                category=doc_info["category"],
                source_url=doc_info["source_url"],
                content=content
            )
            total_inserted += res["inserted"]
            total_skipped += res["skipped"]
            if res["skipped"] > 0:
                logger.info(f"-> Skipped (already exists in Supabase): {doc_info['title']}")
            else:
                logger.info(f"-> Successfully inserted {res['inserted']} chunks into Supabase documents table.")
        except Exception as e:
            logger.error(f"Failed ingesting {doc_info['title']}: {e}")

    logger.info("--------------------------------------------------")
    logger.info(f"Ingestion complete. Total chunks inserted: {total_inserted}, Skipped: {total_skipped}")
    return True

if __name__ == "__main__":
    success = run_ingestion()
    sys.exit(0 if success else 1)
