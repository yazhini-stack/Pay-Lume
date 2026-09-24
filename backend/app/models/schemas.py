from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class SourceItem(BaseModel):
    title: str = Field(..., description="Title of the authoritative security source document")
    source: str = Field(..., description="Organization or agency (e.g. CISA, FTC, OWASP, CERT-In)")
    category: Optional[str] = Field(None, description="Category such as phishing, payment_scams, qr_scams")
    url: Optional[str] = Field(None, description="URL or reference link for the source")
    snippet: Optional[str] = Field(None, description="Relevant excerpt or guideline from the source")

class ChatResponse(BaseModel):
    answer: str = Field(..., description="Direct answer to the user's question, informed by evidence and RAG knowledge")
    sources: List[SourceItem] = Field(default_factory=list, description="Authoritative cybersecurity citations utilized")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Metadata regarding evidence processing (QR, URL, OCR)")

class HealthResponse(BaseModel):
    status: str = "ok"

class IngestionResult(BaseModel):
    total_chunks: int
    inserted_chunks: int
    skipped_chunks: int
    categories: List[str]
