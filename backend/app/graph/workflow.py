import logging
from typing import Dict, Any, List, Optional, TypedDict
from langgraph.graph import StateGraph, START, END

from app.models.schemas import SourceItem
from app.services.qr_service import qr_service
from app.services.url_service import url_service
from app.services.ocr_service import ocr_service
from app.services.rag_service import rag_service
from app.services.gemini_service import gemini_service

logger = logging.getLogger(__name__)

class GraphState(TypedDict):
    question: str
    url: Optional[str]
    image_bytes: Optional[bytes]
    image_mime: Optional[str]
    conversation_history: List[Dict[str, str]]
    
    # Computed state
    evidence_context: str
    rag_sources: List[SourceItem]
    rag_context_text: str
    metadata: Dict[str, Any]
    final_answer: str

def process_evidence_node(state: GraphState) -> Dict[str, Any]:
    """
    Extracts forensic evidence from images (QR decoding + OCR/Vision) and URLs.
    """
    evidence_parts = []
    metadata = {
        "qr_detected": False,
        "qr_data": None,
        "url_analyzed": False,
        "url": state.get("url"),
        "image_analyzed": False
    }

    image_bytes = state.get("image_bytes")
    target_url = state.get("url")

    # 1. Process Image if present
    if image_bytes:
        metadata["image_analyzed"] = True
        
        # 1a. Check for QR Code
        qr_result = qr_service.decode_qr(image_bytes)
        if qr_result.get("detected"):
            metadata["qr_detected"] = True
            metadata["qr_data"] = qr_result.get("data")
            evidence_parts.append(f"[QR CODE PAYLOAD DETECTED]: {qr_result.get('data')}")
            
            # If QR contains a URL and no URL was manually specified, analyze the QR destination
            if qr_result.get("is_url") and not target_url:
                target_url = qr_result.get("url")
                metadata["url"] = target_url

        # 1b. Perform Multimodal OCR / Visual Extraction if not a pure QR code
        if not qr_result.get("detected"):
            ocr_result = ocr_service.extract_text_and_visual_context(
                image_bytes, 
                mime_type=state.get("image_mime") or "image/jpeg"
            )
            if ocr_result.get("raw_text"):
                evidence_parts.append(f"[IMAGE VERBATIM TEXT & VISUAL ELEMENTS]:\n{ocr_result.get('raw_text')}")

    # 2. Process URL if present
    if target_url:
        metadata["url_analyzed"] = True
        url_info = url_service.analyze_url(target_url)
        
        url_summary = [
            f"[DESTINATION URL INSPECTION]:",
            f"- Requested: {url_info.get('requested_url')}",
            f"- Scheme: {url_info.get('scheme')} (SSL/TLS: {url_info.get('has_ssl')})",
            f"- Domain/Host: {url_info.get('hostname')} (TLD: .{url_info.get('tld')})",
            f"- HTTP Status: {url_info.get('status_code')}"
        ]
        
        if url_info.get("redirect_history"):
            url_summary.append(f"- Redirect Chain: {url_info.get('redirect_history')}")
        if url_info.get("title"):
            url_summary.append(f"- Page Title: {url_info.get('title')}")
        if url_info.get("meta_description"):
            url_summary.append(f"- Meta Description: {url_info.get('meta_description')}")
        if url_info.get("text_snippet"):
            url_summary.append(f"- Extracted Body Text:\n  {url_info.get('text_snippet')}")
        if url_info.get("error"):
            url_summary.append(f"- Security/Network Notice: {url_info.get('error')}")

        evidence_parts.append("\n".join(url_summary))

    return {
        "evidence_context": "\n\n".join(evidence_parts),
        "metadata": metadata,
        "url": target_url
    }

def retrieve_rag_node(state: GraphState) -> Dict[str, Any]:
    """
    Embeds user question and retrieves top matching cybersecurity advisories from Supabase.
    """
    question = state.get("question", "")
    
    # Retrieve top 5 matching documents
    raw_docs = rag_service.retrieve_relevant_documents(question, top_k=5)
    formatted = rag_service.format_sources_and_context(raw_docs)
    
    metadata = state.get("metadata", {})
    metadata["sources_count"] = len(formatted["sources"])

    return {
        "rag_sources": formatted["sources"],
        "rag_context_text": formatted["rag_context_text"],
        "metadata": metadata
    }

def generate_answer_node(state: GraphState) -> Dict[str, Any]:
    """
    Generates the synthesized, question-driven answer using Gemini 3.6 Flash.
    """
    question = state.get("question", "")
    evidence_context = state.get("evidence_context", "")
    rag_context = state.get("rag_context_text", "")
    history = state.get("conversation_history", [])
    image_bytes = state.get("image_bytes")
    image_mime = state.get("image_mime") or "image/jpeg"

    answer = gemini_service.generate_answer(
        question=question,
        evidence_context=evidence_context,
        rag_context=rag_context,
        conversation_history=history,
        image_bytes=image_bytes,
        image_mime=image_mime
    )

    return {
        "final_answer": answer
    }

# Build LangGraph workflow
builder = StateGraph(GraphState)

builder.add_node("process_evidence", process_evidence_node)
builder.add_node("retrieve_rag", retrieve_rag_node)
builder.add_node("generate_answer", generate_answer_node)

builder.add_edge(START, "process_evidence")
builder.add_edge("process_evidence", "retrieve_rag")
builder.add_edge("retrieve_rag", "generate_answer")
builder.add_edge("generate_answer", END)

workflow = builder.compile()
