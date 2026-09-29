import time
import logging
from typing import List, Dict, Any, Optional
from supabase import create_client, Client
from app.config import settings
from app.services.embedding_service import embedding_service
from app.models.schemas import SourceItem

logger = logging.getLogger(__name__)

class RAGService:
    def __init__(self):
        self.url = settings.SUPABASE_URL
        self.key = settings.SUPABASE_SERVICE_ROLE_KEY
        self._supabase: Optional[Client] = None
        self.last_embedding_ms: float = 0.0
        self.last_rag_ms: float = 0.0

    def _get_supabase(self) -> Optional[Client]:
        if not self._supabase:
            if not self.url or not self.key or "YOUR_SUPABASE" in self.key:
                logger.warning("Supabase URL or SERVICE_ROLE_KEY is not configured or using placeholder.")
                return None
            try:
                self._supabase = create_client(self.url, self.key)
            except Exception as e:
                logger.error(f"Failed to initialize Supabase client: {e}")
                return None
        return self._supabase

    def retrieve_relevant_documents(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Generates a 1536-dimensional embedding using Gemini Embedding 2,
        then calls the Supabase match_documents RPC directly with verified parameters to find the top_k most similar chunks.
        """
        clean_query = (query or "").strip()
        if not clean_query:
            return []

        # Generate query vector
        t0_emb = time.perf_counter()
        try:
            query_embedding = embedding_service.generate_embedding(clean_query)
            self.last_embedding_ms = (time.perf_counter() - t0_emb) * 1000
        except Exception as e:
            self.last_embedding_ms = (time.perf_counter() - t0_emb) * 1000
            logger.error(f"Failed to generate query embedding for RAG: {e}")
            return []

        client = self._get_supabase()
        if not client:
            logger.warning("Skipping vector search because Supabase client is not available.")
            return []

        # Directly invoke the verified working RPC signature: {"query_embedding": query_embedding, "match_count": top_k}
        t0_rag = time.perf_counter()
        params = {"query_embedding": query_embedding, "match_count": top_k}
        try:
            response = client.rpc("match_documents", params).execute()
            self.last_rag_ms = (time.perf_counter() - t0_rag) * 1000
            if response.data:
                logger.info(f"Retrieved {len(response.data)} documents from Supabase match_documents")
                return response.data
            elif response.data == []:
                logger.info("Supabase match_documents returned 0 matches.")
                return []
        except Exception as e:
            logger.warning(f"Direct RPC match_documents call failed: {e}. Trying safe fallback...")
            try:
                fallback_params = {"query_embedding": query_embedding, "match_threshold": 0.25, "match_count": top_k}
                response = client.rpc("match_documents", fallback_params).execute()
                self.last_rag_ms = (time.perf_counter() - t0_rag) * 1000
                if response.data:
                    return response.data
            except Exception as fb_err:
                logger.debug(f"Fallback RPC call also failed: {fb_err}")
            self.last_rag_ms = (time.perf_counter() - t0_rag) * 1000

        logger.warning("Could not complete RPC match_documents call.")
        return []

    def format_sources_and_context(self, documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Converts retrieved document records into structured SourceItem list
        and formatted text block for Gemini prompt injection.
        """
        source_items: List[SourceItem] = []
        context_blocks: List[str] = []

        for idx, doc in enumerate(documents, start=1):
            content = doc.get("content", "")
            source_name = doc.get("source", "Authoritative Advisory")
            category = doc.get("category", "cybersecurity")
            meta = doc.get("metadata") or {}
            
            title = meta.get("document_title") or meta.get("title") or f"{source_name} Security Guidelines"
            url = meta.get("source_url") or meta.get("url") or ""
            
            snippet = content[:250].replace("\n", " ") + ("..." if len(content) > 250 else "")

            source_items.append(SourceItem(
                title=title,
                source=source_name,
                category=category,
                url=url,
                snippet=snippet
            ))

            context_blocks.append(
                f"[Source {idx} - {source_name}: {title} (Category: {category})]\n{content}\n"
            )

        return {
            "sources": source_items,
            "rag_context_text": "\n---\n".join(context_blocks)
        }

rag_service = RAGService()
