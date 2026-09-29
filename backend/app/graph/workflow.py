import logging
from typing import Dict, Any, List, Optional, TypedDict
from langgraph.graph import StateGraph, START, END

from app.models.schemas import SourceItem
from app.services.qr_service import qr_service
from app.services.url_service import url_service
from app.services.ocr_service import ocr_service
from app.services.rag_service import rag_service
from app.services.gemini_service import gemini_service

import re

logger = logging.getLogger(__name__)

class GraphState(TypedDict):
    question: str
    url: Optional[str]
    image_bytes: Optional[bytes]
    image_mime: Optional[str]
    conversation_history: List[Dict[str, str]]
    
    # Computed state
    evidence_context: str
    security_evidence: List[str]
    rag_sources: List[SourceItem]
    rag_context_text: str
    metadata: Dict[str, Any]
    final_answer: str

def extract_security_indicators(
    qr_result: Dict[str, Any],
    url_info: Optional[Dict[str, Any]],
    raw_ocr_text: str,
    user_question: str
) -> List[str]:
    """
    Extracts concrete, factual security indicators detected during analysis.
    Only indicators that are directly evidenced in the input are returned.
    Works dynamically for arbitrary user input, screenshots, URLs, and text messages.
    """
    indicators: List[str] = []

    # 1. URL Analysis Indicators
    if url_info and url_info.get("requested_url"):
        hostname = (url_info.get("hostname") or "").lower()
        scheme = (url_info.get("scheme") or "").lower()
        has_ssl = url_info.get("has_ssl", False)
        error = url_info.get("error")
        redirects = url_info.get("redirect_history") or []
        tld = (url_info.get("tld") or "").lower()

        if scheme == "http" or not has_ssl:
            indicators.append("Unencrypted connection (HTTP without SSL/TLS security)")
        
        if redirects:
            first_redirect = redirects[0]
            indicators.append(f"HTTP redirection chain observed ({first_redirect.get('from')} -> {url_info.get('final_url')})")
        
        if error:
            indicators.append("Destination hostname unreachable or DNS resolution failed")
            
        if any(char.isdigit() for char in hostname.replace(".", "")) and all(part.isdigit() for part in hostname.split(".")):
            indicators.append("Destination is a raw numerical IP address rather than a verified domain name")
            
        if tld in ["xyz", "top", "buzz", "work", "loan", "click", "cf", "gq", "ml", "tk"]:
            indicators.append(f"High-risk or disposable top-level domain (.{tld})")

        # Lookalike or suspicious verification keywords in domain
        suspicious_domain_keywords = ["verify", "verification", "secure", "auth", "login", "update", "kyc"]
        if any(kw in hostname for kw in suspicious_domain_keywords) and any(b in hostname for b in ["bank", "pay", "upi", "chase", "sbi", "hdfc", "icici", "axis"]):
            indicators.append("Suspicious lookalike domain pairing financial brand terms with verification keywords")

    # 2. QR Analysis Indicators
    if qr_result and qr_result.get("detected"):
        qr_data = qr_result.get("data") or ""
        lower_qr = qr_data.lower()
        if "upi://" in lower_qr or "pay?" in lower_qr or "pa=" in lower_qr:
            indicators.append("Direct instant payment mandate encoded in QR code (UPI intent)")
        elif qr_result.get("is_url"):
            indicators.append(f"QR code payload resolves to external web destination ({qr_result.get('url')})")
        else:
            indicators.append("Decoded embedded QR barcode payload")

    # 3. Content Analysis Indicators (OCR text + user question)
    combined_text = f"{raw_ocr_text} {user_question}".lower()
    
    # Urgency & Threat / Deadline language
    urgency_pattern = r'\b(urgent|urgently|immediately|immediate|within \d+ (minutes?|hours?)|tonight|today|deadline|suspension|suspended|blocked|blocking|cutoff|penalty|expires?|last warning|permanent account suspension|disconnected)\b'
    if re.search(urgency_pattern, combined_text):
        indicators.append("Urgent threat or deadline language (e.g. impending account blocking, cutoff, or suspension)")

    # Credential solicitation (OTP / PIN / Password / CVV)
    credential_pattern = r'\b(otp|one[- ]time password|upi pin|atm pin|pin|cvv|password|net banking password|credentials?)\b'
    solicitation_verbs = r'\b(send|share|enter|provide|submit|give|confirm|type|ask for|requesting)\b'
    if re.search(credential_pattern, combined_text) and (re.search(solicitation_verbs, combined_text) or "pin" in combined_text or "otp" in combined_text):
        indicators.append("Solicitation of sensitive security credentials (PIN, OTP, CVV, or password)")

    # Unsolicited payment or nominal verification charge / advance-fee lure
    payment_request_pattern = r'(\b(pay|paying|transfer|deposit|fee|charge|bill)\b.{0,30}(₹|\$|rs\.?|inr|usd|\d+))|(\b(pay|paying|transfer)\b.{0,20}\b(link|upi|account)\b)'
    if re.search(payment_request_pattern, combined_text):
        indicators.append("Unsolicited payment request or token verification fee (advance-fee payment lure)")

    # Institutional or utility/banking impersonation warning
    impersonation_pattern = r'\b(bank account|your bank|banking|utility|electricity|power supply|tax department|customs officer|police department)\b'
    if re.search(impersonation_pattern, combined_text) and re.search(r'\b(blocked|suspended|cutoff|disconnected|penalty|verify immediately|action required)\b', combined_text):
        indicators.append("Impersonation of official banking or utility institution with coercive action threats")

    # Personal mobile phone number used for official utility or billing notification
    if re.search(r'\b[6-9]\d{9}\b', combined_text) and any(w in combined_text for w in ["electricity", "power", "utility", "officer", "disconnect", "disconnected", "bill"]):
        indicators.append("Personal mobile phone number used for official utility notification")

    # Personal email posing as enterprise notification
    if re.search(r'\b[a-zA-Z0-9._%+-]+@(gmail|yahoo|hotmail|outlook)\.com\b', combined_text):
        if any(w in combined_text for w in ["bank", "electricity", "support", "official", "department", "customs", "tax", "lottery", "prize", "refund", "bill"]):
            indicators.append("Personal consumer email address used for official institutional notification")

    # Remote desktop software
    remote_tools = ["anydesk", "teamviewer", "rustdesk", "quicksupport", "screen share"]
    if any(t in combined_text for t in remote_tools):
        indicators.append("Request to install remote desktop or screen-sharing application")

    # Lottery / Refund / Advance-fee lures
    lure_keywords = ["congratulations you won", "lottery prize", "cashback reward", "unclaimed refund", "scratch card winner", "gst registration fee"]
    if any(l in combined_text for l in lure_keywords):
        indicators.append("Unsolicited reward, lottery prize, or upfront fee requirement")

    return list(dict.fromkeys(indicators))

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
        "image_analyzed": False,
        "security_evidence": []
    }

    image_bytes = state.get("image_bytes")
    target_url = state.get("url")
    raw_ocr_text = ""
    qr_result = {"detected": False}
    url_info = None

    # Auto-detect URL from question if target_url was not explicitly supplied
    if not target_url and state.get("question"):
        url_match = re.search(r'https?://[^\s<>"\')]+(?<![\.,;:?!])', state.get("question", ""))
        if url_match:
            target_url = url_match.group(0)
            metadata["url"] = target_url

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
            raw_ocr_text = ocr_result.get("raw_text", "")
            if raw_ocr_text:
                evidence_parts.append(f"[IMAGE VERBATIM TEXT & VISUAL ELEMENTS]:\n{raw_ocr_text}")

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

    # 3. Detect concrete security indicators
    indicators = extract_security_indicators(
        qr_result=qr_result,
        url_info=url_info,
        raw_ocr_text=raw_ocr_text,
        user_question=state.get("question", "")
    )
    metadata["security_evidence"] = indicators

    return {
        "evidence_context": "\n\n".join(evidence_parts),
        "security_evidence": indicators,
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
    metadata["perf_embedding_ms"] = getattr(rag_service, "last_embedding_ms", 0.0)
    metadata["perf_rag_ms"] = getattr(rag_service, "last_rag_ms", 0.0)

    return {
        "rag_sources": formatted["sources"],
        "rag_context_text": formatted["rag_context_text"],
        "metadata": metadata
    }

def generate_answer_node(state: GraphState) -> Dict[str, Any]:
    """
    Generates the synthesized, question-driven answer using Gemini.
    """
    import time
    question = state.get("question", "")
    evidence_context = state.get("evidence_context", "")
    rag_context = state.get("rag_context_text", "")
    history = state.get("conversation_history", [])
    image_bytes = state.get("image_bytes")
    image_mime = state.get("image_mime") or "image/jpeg"

    t0_gen = time.perf_counter()
    answer = gemini_service.generate_answer(
        question=question,
        evidence_context=evidence_context,
        rag_context=rag_context,
        conversation_history=history,
        image_bytes=image_bytes,
        image_mime=image_mime
    )
    t1_gen = time.perf_counter()

    metadata = state.get("metadata", {})
    metadata["perf_gemini_ms"] = (t1_gen - t0_gen) * 1000

    return {
        "final_answer": answer,
        "metadata": metadata
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
