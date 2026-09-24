# Paylume Intelligence Backend

**Tagline:** "Upload. Ask. Understand."  
**Mission:** A question-driven multimodal cybersecurity assistant focusing on payment scams, phishing, malicious URLs, QR scams, fake payment requests, and digital fraud awareness.

---

## Architecture Overview

```
                      +------------------------------------------+
                      |         Next.js Frontend (Port 3000)     |
                      +------------------------------------------+
                                           |
                                [POST /api/chat (FormData)]
                                           v
                      +------------------------------------------+
                      |         FastAPI Backend (Port 8000)      |
                      +------------------------------------------+
                                           |
                  +------------------------+------------------------+
                  |                        |                        |
             [Image Upload]           [QR Code]                 [URL]
                  |                        |                        |
         (Gemini Vision/OCR)       (zxing-cpp decode)        (SSRF Check &
                  |                        |                 Safe Scraper)
                  +------------------------+------------------------+
                                           |
                                  [Unified Evidence]
                                           v
                              +-------------------------+
                              |    LangGraph Workflow   |
                              +-------------------------+
                                           |
                     +---------------------+---------------------+
                     |                                           |
           [Question Embedding]                        [Uploaded Context]
        (Gemini Embedding 2: 1536d)                              |
                     |                                           |
                     v                                           |
            [Supabase pgvector]                                  |
        (public.match_documents)                                 |
                     |                                           |
          [Top 5 Trusted Chunks]                                 |
        (CISA / FTC / OWASP / CERT-In)                           |
                     |                                           |
                     +---------------------+---------------------+
                                           |
                                           v
                               +-----------------------+
                               |   Google Gemini LLM   |
                               |  (gemini-3.6-flash)   |
                               +-----------------------+
                                           |
                                [Tailored Direct Answer]
                                           v
                      +------------------------------------------+
                      |      Frontend Display (Answer + Citations)|
                      +------------------------------------------+
```

---

## Directory Structure

```
backend/
├── app/
│   ├── config.py                 # Centralized configuration & environment loader
│   ├── main.py                   # FastAPI initialization, CORS, and routing
│   ├── graph/
│   │   └── workflow.py           # LangGraph orchestration state machine
│   ├── models/
│   │   └── schemas.py            # Pydantic schemas (ChatResponse, SourceItem, etc.)
│   ├── prompts/
│   │   └── system_prompt.py      # Strict, objective cybersecurity reasoning directives
│   ├── routes/
│   │   ├── chat.py               # POST /api/chat multipart/form-data handler
│   │   └── health.py             # GET /health healthcheck endpoint
│   └── services/
│       ├── embedding_service.py  # Gemini Embedding 2 (1536 dimensions)
│       ├── gemini_service.py     # Gemini 3.6 Flash multimodal reasoning
│       ├── ingestion_service.py  # Chunking, embedding, deduplication & Supabase insert
│       ├── ocr_service.py        # Image validation, Pillow integrity & Gemini Vision
│       ├── qr_service.py         # zxing-cpp QR detection & URL extraction
│       ├── rag_service.py        # Supabase pgvector cosine search (match_documents)
│       └── url_service.py        # SSRF-protected URL inspection & metadata scraper
├── ingestion/
│   ├── ingest_documents.py       # Automated vector ingestion script
│   └── sources/                  # Curated authoritative security guidelines
│       ├── cisa_phishing_guidelines.md
│       ├── ftc_payment_scams.md
│       ├── cisa_fbi_qr_code_tampering.md
│       ├── owasp_malicious_urls_and_fake_websites.md
│       └── cert_in_suspicious_payment_requests.md
├── .env.example                  # Environment variable template
├── .gitignore                    # Git ignore file
├── requirements.txt              # Production Python dependencies
└── README.md                     # Backend documentation
```

---

## Prerequisites & Installation

### 1. Python Environment (Python 3.12 Recommended)
Ensure you have Python 3.12 or newer installed:
```powershell
# From the project root or backend directory:
py -3.12 -m venv backend/venv
```

Activate the virtual environment:
- **Windows (PowerShell):**
  ```powershell
  backend\venv\Scripts\Activate.ps1
  ```
- **Windows (Command Prompt):**
  ```cmd
  backend\venv\Scripts\activate.bat
  ```
- **macOS / Linux:**
  ```bash
  source backend/venv/bin/activate
  ```

### 2. Install Dependencies
```powershell
pip install -r backend/requirements.txt
```

---

## Configuration (.env)

Create a `.env` file in the `backend/` directory (or copy from `.env.example`):
```ini
# Google Gemini API Key (Required)
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase Database Configuration (Required for RAG Vector Search & Ingestion)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_secret_key

# Frontend Origin for CORS
FRONTEND_ORIGIN=http://localhost:3000
```

> **Security Note:** Never commit `backend/.env` to source control. The service role key must remain on the backend only and never be exposed to the client browser.

---

## RAG Knowledge Base Ingestion

To ingest the curated authoritative security documents into your Supabase `public.documents` pgvector table:

```powershell
# Ensure your virtual environment is active and SUPABASE_SERVICE_ROLE_KEY is set in backend/.env:
python backend/ingestion/ingest_documents.py
```

The script will:
1. Load advisories from `backend/ingestion/sources/` (CISA, FTC, OWASP, CERT-In).
2. Clean and split the text into overlapping semantic chunks.
3. Compute 1536-dimensional embeddings with `models/gemini-embedding-2`.
4. Perform deduplication to prevent duplicate database rows.
5. Insert vectors and metadata into your Supabase database.

---

## Running the Applications

### Start the Backend Server (Port 8000)
```powershell
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Documentation will be available at:
- Swagger UI: `http://localhost:8000/docs`
- Redoc: `http://localhost:8000/redoc`

### Start the Frontend Server (Port 3000)
In a separate terminal window:
```powershell
npm run dev
```
Open `http://localhost:3000` in your web browser.

---

## Testing API Endpoints

### 1. Health Check
```powershell
curl http://localhost:8000/health
```
Expected response:
```json
{"status": "ok"}
```

### 2. Chat Endpoint (Question Only)
```powershell
curl -X POST http://localhost:8000/api/chat -F "question=Does this message asking for my PIN look like a scam?"
```

### 3. Chat Endpoint (With URL Inspection)
```powershell
curl -X POST http://localhost:8000/api/chat -F "question=Is this website legitimate?" -F "url=https://example.com"
```

### 4. Chat Endpoint (With Uploaded Image / QR Code)
```powershell
curl -X POST http://localhost:8000/api/chat -F "question=What does this QR code lead to and is it safe?" -F "image=@path/to/qrcode.png"
```

---

## Security Safeguards

- **SSRF Prevention:** The URL inspection engine validates hostnames, resolves DNS, and strictly forbids connections to localhost, private RFC 1918 subnets, link-local ranges, and cloud metadata endpoints (e.g. `169.254.169.254`).
- **Safe HTML Parsing:** Strips executable JavaScript tags (`<script>`, `<noscript>`, `<svg>`) and limits response payload size.
- **Credential Privacy:** System directives strictly forbid requesting or echoing passwords, OTPs, PINs, or banking credentials.
- **Nuanced Assessment:** Avoids falsely validating scams merely because a site uses HTTPS/SSL, and avoids labeling non-traditional TLDs as malicious without substantive evidence.
