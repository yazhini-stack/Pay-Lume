import logging
from typing import List, Optional
from google import genai
from google.genai import types
from app.config import settings

logger = logging.getLogger(__name__)

class EmbeddingService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model = settings.EMBEDDING_MODEL
        self.dimension = settings.EMBEDDING_DIMENSION
        self._client: Optional[genai.Client] = None

    def _get_client(self) -> genai.Client:
        if not self._client:
            if not self.api_key:
                raise ValueError("GEMINI_API_KEY is not configured in backend settings.")
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate a 1536-dimensional embedding for a single text chunk using Gemini Embedding 2.
        """
        clean_text = (text or "").strip()
        if not clean_text:
            return [0.0] * self.dimension

        client = self._get_client()
        try:
            response = client.models.embed_content(
                model=self.model,
                contents=clean_text,
                config=types.EmbedContentConfig(
                    output_dimensionality=self.dimension
                )
            )
            
            if response.embeddings and len(response.embeddings) > 0:
                values = response.embeddings[0].values
                if len(values) != self.dimension:
                    logger.warning(f"Embedding dimension mismatch: expected {self.dimension}, got {len(values)}")
                return list(values)
            else:
                raise RuntimeError("Empty embedding response returned from Gemini API.")
        except Exception as e:
            logger.error(f"Error generating embedding with {self.model}: {e}")
            raise

    def generate_batch_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings for multiple texts sequentially or in batches.
        """
        results = []
        for t in texts:
            results.append(self.generate_embedding(t))
        return results

embedding_service = EmbeddingService()
