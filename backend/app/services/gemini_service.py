import time
import logging
from typing import List, Dict, Any, Optional
from google import genai
from google.genai import types
from app.config import settings
from app.prompts.system_prompt import SYSTEM_PROMPT

logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        self._client: Optional[genai.Client] = None

    def _get_client(self) -> genai.Client:
        if not self._client:
            if not settings.GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY is not configured in settings.")
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._client

    def generate_answer(
        self,
        question: str,
        evidence_context: str = "",
        rag_context: str = "",
        conversation_history: Optional[List[Dict[str, str]]] = None,
        image_bytes: Optional[bytes] = None,
        image_mime: str = "image/jpeg"
    ) -> str:
        """
        Synthesizes the user's question, multimodal evidence, RAG context, and history into a tailored, direct answer.
        Uses a cascade of models (gemini-3-flash-preview -> gemini-3.1-flash-lite-preview -> gemini-flash-lite-latest)
        to guarantee high availability and prevent 429/503 interruptions.
        """
        client = self._get_client()

        prompt_parts: List[Any] = []

        if image_bytes:
            try:
                prompt_parts.append(
                    types.Part.from_bytes(data=image_bytes, mime_type=image_mime)
                )
            except Exception as e:
                logger.warning(f"Could not attach image part to Gemini request: {e}")

        context_sections = []

        if evidence_context.strip():
            context_sections.append(f"=== UPLOADED EVIDENCE / FORENSIC INSPECTION ===\n{evidence_context.strip()}")

        if rag_context.strip():
            context_sections.append(f"=== RETRIEVED CYBERSECURITY KNOWLEDGE (CISA / FTC / OWASP / CERT-In) ===\n{rag_context.strip()}")

        if conversation_history:
            history_lines = []
            for msg in conversation_history[-6:]:
                role = msg.get("role", "user").capitalize()
                content = msg.get("content", "")
                history_lines.append(f"{role}: {content}")
            if history_lines:
                context_sections.append(f"=== PRIOR CONVERSATION HISTORY ===\n" + "\n".join(history_lines))

        context_sections.append(
            f"=== CURRENT USER QUESTION ===\n{question}\n\n"
            f"Please address the user's question above directly, applying the system prompt directives."
        )

        prompt_text = "\n\n".join(context_sections)
        prompt_parts.append(prompt_text)

        candidate_models = getattr(settings, "GENERATION_MODELS", [settings.GENERATION_MODEL])

        for model_name in candidate_models:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt_parts,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        temperature=0.2,
                        max_output_tokens=2048
                    )
                )

                if response and response.text:
                    logger.info(f"Successfully generated answer using model: {model_name}")
                    return response.text.strip()
            except Exception as e:
                err_str = str(e)
                logger.warning(f"Model {model_name} failed ({err_str[:90]}). Falling back to next available model...")

        return "I was unable to complete the analysis due to upstream AI service congestion. Please try again in a few moments."

gemini_service = GeminiService()
