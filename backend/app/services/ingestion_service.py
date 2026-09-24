import re
import logging
from typing import List, Dict, Any, Optional
from supabase import create_client, Client
from app.config import settings
from app.services.embedding_service import embedding_service
from app.models.schemas import IngestionResult

logger = logging.getLogger(__name__)

def clean_text(text: str) -> str:
    """Removes excessive whitespace and standardizes newlines."""
    text = re.sub(r'\r\n|\r', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    return text.strip()

def chunk_text(text: str, chunk_size: int = 800, chunk_overlap: int = 150) -> List[str]:
    """
    Splits text into overlapping chunks, respecting paragraph and sentence boundaries.
    """
    cleaned = clean_text(text)
    if not cleaned:
        return []

    # If already smaller than chunk_size, return single chunk
    if len(cleaned) <= chunk_size:
        return [cleaned]

    paragraphs = cleaned.split("\n\n")
    chunks: List[str] = []
    current_chunk = ""

    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        
        if len(current_chunk) + len(p) + 2 <= chunk_size:
            current_chunk = f"{current_chunk}\n\n{p}" if current_chunk else p
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            
            # If paragraph itself is too large, split by sentences
            if len(p) > chunk_size:
                sentences = re.split(r'(?<=[.!?])\s+', p)
                sub_chunk = ""
                for s in sentences:
                    if len(sub_chunk) + len(s) + 1 <= chunk_size:
                        sub_chunk = f"{sub_chunk} {s}" if sub_chunk else s
                    else:
                        if sub_chunk:
                            chunks.append(sub_chunk.strip())
                        sub_chunk = s
                if sub_chunk:
                    current_chunk = sub_chunk
                else:
                    current_chunk = ""
            else:
                current_chunk = p

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks

class IngestionService:
    def __init__(self):
        self.url = settings.SUPABASE_URL
        self.key = settings.SUPABASE_SERVICE_ROLE_KEY
        self._supabase: Optional[Client] = None

    def _get_supabase(self) -> Client:
        if not self._supabase:
            if not self.url or not self.key or "YOUR_SUPABASE" in self.key:
                raise ValueError("Supabase URL and SUPABASE_SERVICE_ROLE_KEY must be configured.")
            self._supabase = create_client(self.url, self.key)
        return self._supabase

    def ingest_document(
        self,
        document_title: str,
        source: str,
        category: str,
        source_url: str,
        content: str
    ) -> Dict[str, int]:
        """
        Chunks, embeds (1536 dims), and inserts document into public.documents,
        skipping insertion if the document has already been ingested.
        """
        client = self._get_supabase()

        # Deduplication check: check if document_title and source already exist
        try:
            existing = client.table("documents")\
                .select("id")\
                .eq("source", source)\
                .contains("metadata", {"document_title": document_title})\
                .limit(1)\
                .execute()

            if existing.data and len(existing.data) > 0:
                logger.info(f"Document '{document_title}' from '{source}' already ingested. Skipping duplicate.")
                return {"total": 0, "inserted": 0, "skipped": 1}
        except Exception as e:
            logger.warning(f"Could not perform deduplication query: {e}. Proceeding with cautious ingestion.")

        chunks = chunk_text(content, chunk_size=800, chunk_overlap=150)
        logger.info(f"Processing '{document_title}': {len(chunks)} chunks generated.")

        inserted_count = 0
        for idx, chunk in enumerate(chunks):
            # Generate 1536-dim vector
            embedding = embedding_service.generate_embedding(chunk)

            row = {
                "content": chunk,
                "source": source,
                "category": category,
                "metadata": {
                    "source_url": source_url,
                    "document_title": document_title,
                    "category": category,
                    "chunk_index": idx,
                    "total_chunks": len(chunks)
                },
                "embedding": embedding
            }

            try:
                client.table("documents").insert(row).execute()
                inserted_count += 1
            except Exception as e:
                logger.error(f"Failed inserting chunk {idx} of '{document_title}': {e}")
                raise

        return {"total": len(chunks), "inserted": inserted_count, "skipped": 0}

ingestion_service = IngestionService()
