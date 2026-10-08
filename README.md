# 🔐 Pay-Lume

### Upload. Ask. Understand.

**Pay-Lume** is a multimodal conversational AI cybersecurity assistant designed to help everyday users identify and understand potential payment scams.

Users can **upload screenshots, images, QR codes, invoices, or paste suspicious URLs/messages**, then ask questions naturally. Pay-Lume analyzes the provided evidence, retrieves relevant cybersecurity knowledge from trusted sources, and generates an explainable, evidence-based response with recommended actions.

## 🚀 Live Demo

**Pay-Lume — Live Application:**  
https://paylume-frontend.onrender.com/

---

## 🎯 Problem

Payment scams are becoming increasingly convincing.

Users may receive:

- Suspicious QR codes
- Fake bank or payment websites
- Urgent electricity or utility messages
- Fraudulent invoices and receipts
- Fake escrow/payment requests
- Phishing and smishing messages
- Suspicious payment links

The problem is that users often don't know **what exactly makes a message, link, QR code, or payment request suspicious**.

Existing security tools can also be difficult for non-technical users to understand.

### 💡 Our Solution

Pay-Lume converts complex security analysis into a simple conversational experience.

Instead of asking users to understand cybersecurity terminology, Pay-Lume lets them simply:

> **Upload → Ask → Understand**

---

## ✨ Key Features

### 📸 Multimodal Evidence Analysis

Users can provide different types of evidence:

- Screenshots
- Photos
- QR codes
- Payment messages
- Invoices and receipts
- Suspicious URLs
- SMS/utility alerts

### 🔍 Security Evidence Detection

Pay-Lume identifies observable indicators such as:

- Suspicious or lookalike domains
- Unencrypted HTTP connections
- Urgency and threat language
- Credential or OTP requests
- Suspicious payment instructions
- Institutional impersonation
- Unusual phone numbers
- Nominal verification-fee requests
- Other suspicious patterns

The system distinguishes between **observed evidence** and **inferred security risk** instead of automatically labeling everything as a scam.

### 🧠 RAG-Powered Cybersecurity Knowledge

Pay-Lume uses Retrieval-Augmented Generation (RAG) to retrieve relevant cybersecurity information from a curated knowledge base.

The knowledge base includes guidance from trusted sources such as:

- CISA
- FTC
- OWASP
- CERT-In

The retrieved information provides authoritative context for the AI's response.

### 💬 Conversational AI

Users can ask follow-up questions naturally:

> “Why is this suspicious?”

> “What does HTTP mean?”

> “What should I do now?”

> “I already paid. What should I do?”

Pay-Lume maintains conversation context so users don't have to repeatedly explain the situation.

### 🔗 Secure URL Inspection

URLs can be analyzed for characteristics such as:

- HTTP/HTTPS
- Redirect behavior
- Domain characteristics
- Suspicious domains
- Lookalike patterns

The backend includes **SSRF protection** to prevent requests to private or sensitive network addresses.

### 📱 QR Code Analysis

QR codes can be decoded to inspect their underlying payload and identify potentially suspicious payment or URL destinations.

### 📝 OCR & Image Analysis

Text can be extracted from uploaded images and screenshots for further security analysis.

### 🚨 Already Paid?

If a user has already made a payment, Pay-Lume provides a dedicated **Already Paid** workflow focused on damage-control and next steps rather than simply identifying the scam.

### 🔒 Privacy & Security

The application includes safeguards around sensitive evidence and follows an important rule:

> **Pay-Lume never asks users to provide OTPs, PINs, passwords, or other authentication secrets.**

---

# 🏗️ System Architecture

```text
                         USER
                           │
                           ▼
                ┌─────────────────────┐
                │   Next.js Frontend  │
                │    Chat Interface    │
                └──────────┬──────────┘
                           │
                           ▼
                ┌─────────────────────┐
                │   FastAPI Backend   │
                └──────────┬──────────┘
                           │
                    ┌──────┴──────┐
                    │  LangGraph  │
                    │  Workflow   │
                    └──────┬──────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
        QR Decoder        OCR       URL Inspection
             │             │             │
             └─────────────┼─────────────┘
                           ▼
                  Evidence Extraction
                           │
                           ▼
                  ┌─────────────────┐
                  │   RAG Retrieval  │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Supabase        │
                  │ PostgreSQL      │
                  │ + pgvector      │
                  └────────┬────────┘
                           │
                    Relevant Knowledge
                           │
                           ▼
                  ┌─────────────────┐
                  │   Gemini AI     │
                  │   Generation    │
                  └────────┬────────┘
                           │
                           ▼
                  Explainable Response
                           │
                           ▼
                  ┌─────────────────┐
                  │   Pay-Lume UI   │
                  │ Chat + Insights │
                  └─────────────────┘
```

---

# 🧠 How Pay-Lume Works

## 1. User provides evidence

The user uploads an image, screenshot, QR code, invoice, or enters a URL/message.

## 2. Evidence processing

The backend determines what type of evidence is available.

Depending on the input, Pay-Lume can perform:

- QR decoding
- OCR
- Image analysis
- URL inspection
- Security indicator extraction

## 3. RAG retrieval

The user's question is converted into an embedding.

The embedding is compared against cybersecurity knowledge stored in **Supabase PostgreSQL with pgvector**.

Relevant documents are retrieved using vector similarity search.

## 4. AI reasoning

Gemini receives the relevant evidence, retrieved cybersecurity context, and conversation history.

It then generates a grounded response focused on the user's question.

## 5. User receives the result

The interface separates:

**Attached Evidence**

What the user provided.

**Security Insights**

What Pay-Lume discovered from that evidence.

**Chat**

The conversational explanation and answer.

This keeps the interface informative without overwhelming the user.

---

# 🔄 LangGraph Workflow

Pay-Lume uses a LangGraph-based state workflow:

```text
User Input
    │
    ▼
Process Evidence
    │
    ├── QR Decoding
    ├── OCR
    ├── URL Inspection
    └── Indicator Detection
    │
    ▼
Retrieve RAG Context
    │
    ├── Generate Embedding
    ├── Vector Search
    └── Contextual Retrieval
    │
    ▼
Generate Answer
    │
    └── Gemini
    │
    ▼
Final Conversational Response
```

A shared workflow state carries information such as:

- User question
- Conversation history
- Uploaded evidence
- OCR output
- QR payload
- URL analysis
- Security indicators
- Retrieved documents
- Generated response

---

# 🛠️ Technology Stack

## Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Zustand
- TanStack React Query
- React Markdown
- React Dropzone
- Lucide React
- Web Speech API

## Backend

- Python
- FastAPI
- Uvicorn
- Pydantic
- HTTPX
- BeautifulSoup
- Pillow
- zxing-cpp

## AI / ML

- Google Gemini
- LangChain
- LangGraph
- Vector embeddings
- Retrieval-Augmented Generation (RAG)

## Database & Authentication

- Supabase
- PostgreSQL
- pgvector
- Supabase Authentication
- Row Level Security (RLS)

## Deployment

- Render — Frontend
- Render — Backend
- Supabase — Database & Authentication
- Google Gemini API — AI generation

---

# 🔐 Security Architecture

Security is considered at multiple layers.

### SSRF Protection

The URL inspection service blocks requests to sensitive/private destinations, including:

- Localhost
- Private IPv4 ranges
- IPv6 loopback
- Cloud metadata endpoints

Redirects are also inspected with a controlled redirect limit.

### Credential Protection

Pay-Lume is designed never to request:

- OTPs
- UPI PINs
- Passwords
- Banking credentials
- Authentication secrets

### Database Security

Supabase Row Level Security helps ensure users can access only the data permitted for their account.

---

# 📚 Trusted Knowledge Sources

Pay-Lume's RAG knowledge base is curated from authoritative cybersecurity guidance, including:

- **CISA** — Cybersecurity and Infrastructure Security Agency
- **FTC** — Federal Trade Commission
- **OWASP** — Open Worldwide Application Security Project
- **CERT-In** — Indian Computer Emergency Response Team

These sources provide context for phishing, smishing, QR-code scams, malicious URLs, payment fraud, impersonation, and related threats.

---

# ⚡ Example Use Cases

### QR Code Scam

```text
User:
[Uploads a QR code]

"Is this QR code safe to scan?"
```

Pay-Lume analyzes the QR payload and provides security guidance based on the extracted evidence and relevant cybersecurity knowledge.

### Suspicious Bank Link

```text
User:
http://secure-login-example.xyz/auth

"Is this really my bank's website?"
```

Pay-Lume can inspect URL characteristics and explain suspicious indicators.

### Utility Scam

```text
User:
[Uploads electricity disconnection SMS screenshot]

"Should I make this payment?"
```

Pay-Lume can identify urgency, impersonation, payment-related indicators, and provide recommended actions.

### Already Paid

```text
User:
"I already transferred the money. What should I do?"
```

Pay-Lume provides post-payment guidance focused on reducing potential damage and taking appropriate next steps.

---

# ☁️ Deployment Architecture

Pay-Lume is deployed as separate frontend and backend services:

```text
                Internet
                    │
                    ▼
       ┌────────────────────────┐
       │  Render - Frontend     │
       │  Next.js               │
       └───────────┬────────────┘
                   │
                   ▼
       ┌────────────────────────┐
       │  Render - Backend      │
       │  FastAPI               │
       └──────┬─────────┬───────┘
              │         │
              ▼         ▼
       ┌──────────┐  ┌──────────┐
       │ Supabase │  │ Gemini   │
       │ DB/Auth  │  │ API      │
       └──────────┘  └──────────┘
```

The frontend communicates with the deployed FastAPI backend through the configured API endpoint.

Sensitive credentials and API keys are supplied through environment variables rather than being committed to the repository.

---

# 📈 Future Scope

Potential future improvements include:

- Larger and continuously updated cybersecurity knowledge bases
- Hybrid keyword + vector retrieval
- Advanced retrieval reranking
- More payment platforms and scam categories
- Improved multilingual support
- Threat-intelligence integrations
- Automated domain reputation analysis
- More advanced fraud-pattern correlation
- Production-scale observability and monitoring
- Additional post-payment recovery workflows

---

# 🎯 Project Vision

Pay-Lume aims to make cybersecurity assistance understandable to everyone.

Instead of simply saying:

> **“This is a scam.”**

Pay-Lume focuses on explaining:

> **What was observed → Why it matters → What the user should do next.**

The goal is to help users make safer decisions **before they pay, scan, click, or share sensitive information.**

---

## 👩‍💻 Project

**Pay-Lume — Multimodal Conversational AI Cybersecurity Assistant**

**Tagline:**  
### Upload. Ask. Understand.

**Live Demo:**  
https://paylume-frontend.onrender.com/
