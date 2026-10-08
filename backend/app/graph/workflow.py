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
    evidence_type: str
    context: Dict[str, Any]
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

def extract_evidence_context(
    evidence_type: str,
    qr_result: Dict[str, Any],
    url_info: Optional[Dict[str, Any]],
    raw_ocr_text: str,
    user_question: str
) -> Dict[str, Any]:
    """
    Extracts structured contextual attributes directly supported by the evidence and question:
    - objects: specific physical hardware, items, or visual elements detected
    - locations: detected physical locations
    - platforms: detected digital payment/messaging platforms
    - transaction_context: overall transaction modality
    Does NOT invent context; only includes attributes genuinely present in the evidence.
    """
    combined = f"{raw_ocr_text} {user_question}".lower()
    if url_info:
        combined += f" {url_info.get('requested_url', '')} {url_info.get('hostname', '')} {url_info.get('title', '')} {url_info.get('text_snippet', '')}".lower()
    if qr_result and qr_result.get("data"):
        combined += f" {qr_result.get('data', '')}".lower()

    objects: List[str] = []
    locations: List[str] = []
    platforms: List[str] = []
    transaction_context: Optional[str] = None

    # Detect QR code
    if (qr_result and qr_result.get("detected")) or "qr" in combined or "barcode" in combined:
        objects.append("QR code")

    # Specific physical objects / hardware
    if re.search(r'\b(parking meter|parking pay station|pay by plate|parkmobile|meter parking)\b', combined):
        objects.append("parking meter")
        locations.append("parking")
        transaction_context = "parking"

    if re.search(r'\b(gas pump|fuel pump|petrol pump|fuel dispenser)\b', combined):
        objects.append("gas pump")
        locations.append("gas station")
        transaction_context = "fuel"

    if re.search(r'\b(ev charger|charging station|charging kiosk)\b', combined):
        objects.append("charging station")

    if re.search(r'\b(ticketing kiosk|transit ticketing kiosk|ticket vending machine|transit kiosk)\b', combined):
        objects.append("ticketing kiosk")
        locations.append("transit station")

    if re.search(r'\b(atm|cash machine|automated teller)\b', combined):
        objects.append("atm")

    if re.search(r'\b(sticker|pasted over|adhesive overlay|peeling|misaligned sticker)\b', combined):
        objects.append("sticker")

    if re.search(r'\b(receipt|tax invoice|payment slip|bill of supply|invoice)\b', combined):
        objects.append("receipt")
        if not transaction_context:
            transaction_context = "receipt_verification"

    if re.search(r'\b(poster|menu|restaurant menu|table tent|standee|flyer)\b', combined):
        if "menu" in combined:
            objects.append("menu")
        if "poster" in combined:
            objects.append("poster")
        if "table tent" in combined or "table" in combined:
            objects.append("table")

    # Locations
    if re.search(r'\b(restaurant|cafe|coffee shop|dining|diner|bistro|eatery|food court)\b', combined):
        locations.append("restaurant")
        if not transaction_context:
            transaction_context = "dining"

    if re.search(r'\b(parking lot|parking garage|street parking)\b', combined):
        locations.append("parking")

    if re.search(r'\b(gas station|petrol station|fuel station)\b', combined):
        locations.append("gas station")

    if re.search(r'\b(transit station|metro station|bus station|train station|subway)\b', combined):
        locations.append("transit station")

    # Platforms
    if re.search(r'\b(upi|gpay|google pay|phonepe|paytm|bhim)\b', combined):
        platforms.append("upi")
        if not transaction_context:
            transaction_context = "upi_payment"

    if re.search(r'\b(zelle|venmo|cash app|cashapp|paypal)\b', combined):
        platforms.append("p2p")
        if not transaction_context:
            transaction_context = "p2p_transfer"

    if re.search(r'\b(sms|text message|shortcode)\b', combined):
        platforms.append("sms")

    if re.search(r'\b(email|inbox|gmail|outlook)\b', combined):
        platforms.append("email")

    if re.search(r'\b(netbanking|online banking|bank login|portal|signin|sign-in)\b', combined) and any(b in combined for b in ["bank", "chase", "sbi", "hdfc", "icici", "wells", "citibank"]):
        platforms.append("banking portal")
        if not transaction_context:
            transaction_context = "credential_login"

    if re.search(r'\b(anydesk|teamviewer|rustdesk|quicksupport|screen share)\b', combined):
        platforms.append("remote desktop")

    # Transaction context fallback
    if not transaction_context:
        if re.search(r'\b(urgent|electricity|power bill|disconnect|cutoff|penalty)\b', combined):
            transaction_context = "urgent_bill"
        elif re.search(r'\b(pay|payment|transfer|charge|fee|amount|transaction)\b', combined):
            transaction_context = "payment"

    return {
        "objects": list(dict.fromkeys(objects)),
        "locations": list(dict.fromkeys(locations)),
        "platforms": list(dict.fromkeys(platforms)),
        "transaction_context": transaction_context
    }

def construct_retrieval_query(
    question: str,
    evidence_type: str,
    context_data: Dict[str, Any],
    security_evidence: List[str]
) -> str:
    """
    Constructs a context-aware retrieval query combining question and verified evidence context.
    """
    terms: List[str] = [question.strip()]
    objects = context_data.get("objects", [])
    locations = context_data.get("locations", [])
    platforms = context_data.get("platforms", [])
    tx_context = context_data.get("transaction_context")

    if evidence_type == "qr_code":
        terms.append("QR code quishing scam")
        if "parking meter" in objects or "parking" in locations:
            terms.append("parking meter tampering sticker overlay physical security")
        elif "restaurant" in locations or tx_context == "dining":
            terms.append("restaurant menu fake payment destination verification")
        else:
            terms.append("payment destination verification preview URL")
    elif evidence_type == "url":
        terms.append("phishing malicious URL deceptive domain SSL misconception")
        if "banking portal" in platforms or tx_context == "credential_login":
            terms.append("banking login credential harvest")
    elif evidence_type == "sms" or "sms" in platforms or tx_context == "urgent_bill":
        terms.append("SMS phishing smishing urgent payment disconnection threat")
    elif evidence_type == "receipt" or "receipt" in objects or tx_context == "receipt_verification":
        terms.append("fake payment receipt invoice fraud verification P2P")
    elif tx_context in ["payment", "p2p_transfer", "upi_payment"]:
        terms.append("payment scam fraudulent transfer refund")

    return " ".join(dict.fromkeys(" ".join(terms).split()))

CONVERSATIONAL_EXACT = {
    "thank you", "thanks", "thanks!", "thank you!", "thanks so much", "thank you so much",
    "okay", "ok", "k", "got it", "understood", "that makes sense", "makes sense",
    "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
    "bye", "goodbye", "cool", "great", "nice", "sounds good", "alright"
}

def is_conversational_message(text: str) -> bool:
    clean = re.sub(r'[^\w\s]', '', text.lower().strip())
    if clean in CONVERSATIONAL_EXACT:
        return True
    pattern = r'^(hi|hello|hey|thanks|thank you|ok|okay|got it|understood|that makes sense|bye|goodbye)(\s+(there|paylume|pay-lume|assistant|so much|very much))?$'
    return bool(re.match(pattern, clean))

def get_conversational_reply(text: str) -> str:
    clean = re.sub(r'[^\w\s]', '', text.lower().strip())
    if any(w in clean for w in ["thank", "thanks"]):
        return "You're welcome! Let me know if you have any other questions."
    if any(w in clean for w in ["hi", "hello", "hey", "good morning", "good afternoon"]):
        return "Hello! How can I help you inspect or understand a payment request or link today?"
    if any(w in clean for w in ["ok", "okay", "got it", "understood", "makes sense", "sounds good", "great"]):
        return "Glad that helps! Feel free to ask if you'd like me to explain anything further or check another item."
    return "Understood! Let me know if you need help with anything else."

def process_evidence_node(state: GraphState) -> Dict[str, Any]:
    """
    Extracts forensic evidence from images (QR decoding + OCR/Vision) and URLs.
    Computes evidence_type and context (objects, locations, platforms, transaction_context).
    """
    # Conversational turn bypass
    user_q = state.get("question", "")
    if is_conversational_message(user_q):
        return {
            "evidence_context": "",
            "security_evidence": [],
            "evidence_type": "conversational",
            "context": {},
            "metadata": {
                "qr_detected": False,
                "url_analyzed": False,
                "image_analyzed": False,
                "security_evidence": [],
                "is_conversational": True
            },
            "url": None
        }

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

    # Determine evidence_type
    evidence_type = "text"
    if qr_result.get("detected"):
        evidence_type = "qr_code"
    elif image_bytes:
        combined_text_check = f"{raw_ocr_text} {state.get('question', '')}".lower()
        if re.search(r'\b(receipt|invoice|tax invoice|payment slip|bill of supply)\b', combined_text_check):
            evidence_type = "receipt"
        elif re.search(r'\b(qr code|qr barcode)\b', combined_text_check):
            evidence_type = "qr_code"
        elif re.search(r'\b(sms|text message)\b', combined_text_check):
            evidence_type = "sms"
        else:
            evidence_type = "image"
    elif target_url:
        evidence_type = "url"
    else:
        combined_text_check = state.get("question", "").lower()
        if re.search(r'\b(receipt|invoice)\b', combined_text_check):
            evidence_type = "receipt"
        elif re.search(r'\b(sms|text message)\b', combined_text_check) or re.search(r'\b[6-9]\d{9}\b', combined_text_check):
            evidence_type = "sms"
        elif "qr" in combined_text_check:
            evidence_type = "qr_code"

    # Extract structured context
    context_data = extract_evidence_context(
        evidence_type=evidence_type,
        qr_result=qr_result,
        url_info=url_info,
        raw_ocr_text=raw_ocr_text,
        user_question=state.get("question", "")
    )
    metadata["evidence_type"] = evidence_type
    metadata["context"] = context_data

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
        "evidence_type": evidence_type,
        "context": context_data,
        "metadata": metadata,
        "url": target_url
    }

def retrieve_rag_node(state: GraphState) -> Dict[str, Any]:
    """
    Constructs a context-aware query, retrieves candidate documents from Supabase pgvector,
    and applies contextual relevance filtering & reranking before passing to Gemini.
    """
    if state.get("evidence_type") == "conversational":
        return {
            "rag_sources": [],
            "rag_context_text": "",
            "metadata": state.get("metadata", {})
        }

    question = state.get("question", "")
    evidence_type = state.get("evidence_type", "text")
    context_data = state.get("context", {})
    security_evidence = state.get("security_evidence", [])

    # 1. Query Construction
    retrieval_query = construct_retrieval_query(
        question=question,
        evidence_type=evidence_type,
        context_data=context_data,
        security_evidence=security_evidence
    )

    # 2. Existing Supabase Vector Search for Candidates
    candidate_docs = rag_service.retrieve_relevant_documents(retrieval_query, top_k=6)

    # 3. Contextual Relevance Filtering & Lightweight Reranking
    relevant_docs = rag_service.filter_and_rerank_candidates(
        candidates=candidate_docs,
        query=retrieval_query,
        evidence_type=evidence_type,
        evidence_context=context_data,
        top_k=3
    )

    # 4. Format Sources and Prompt Context
    formatted = rag_service.format_sources_and_context(
        relevant_docs,
        evidence_context=context_data
    )

    metadata = state.get("metadata", {})
    metadata["retrieval_query"] = retrieval_query
    metadata["candidates_count"] = len(candidate_docs)
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
    if state.get("evidence_type") == "conversational":
        return {
            "final_answer": get_conversational_reply(state.get("question", "")),
            "metadata": state.get("metadata", {})
        }

    import time
    question = state.get("question", "")
    evidence_context = state.get("evidence_context", "")
    rag_context = state.get("rag_context_text", "")
    if not rag_context.strip():
        rag_context = "[No external security advisory chunks met the contextual relevance threshold. Provide analysis strictly grounded in the uploaded evidence and fundamental cybersecurity verification principles without referencing unevidenced external scenarios.]"

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
