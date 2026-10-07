import time
import re
from urllib.parse import urlparse
import logging
from typing import List, Dict, Any, Optional
from supabase import create_client, Client
from app.config import settings
from app.services.embedding_service import embedding_service
from app.models.schemas import SourceItem

logger = logging.getLogger(__name__)

ENABLE_RAG_DEBUG_LOGGING = True
MIN_BASE_SIMILARITY = 0.60
MIN_FINAL_RELEVANCE = 0.64

# Verified official website mappings for authoritative cybersecurity organizations
KNOWN_OFFICIAL_WEBSITE_MAP: Dict[str, str] = {
    "cisa": "https://www.cisa.gov/",
    "fbi": "https://www.fbi.gov/",
    "ic3": "https://www.ic3.gov/",
    "ftc": "https://consumer.ftc.gov/",
    "owasp": "https://owasp.org/",
    "cert-in": "https://www.cert-in.org.in/",
    "certin": "https://www.cert-in.org.in/",
    "nist": "https://www.nist.gov/",
}

BLOCKED_URL_SCHEMES = ("javascript:", "data:", "file:", "vbscript:", "blob:")
BLOCKED_URL_HOSTS = ("localhost", "127.0.0.1", "0.0.0.0", "::1", "testserver")
DOMAIN_REGEX = re.compile(
    r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?:/[^\s]*)?$"
)

def normalize_and_validate_resource_url(
    raw_url: Optional[str],
    source_name: Optional[str] = None
) -> Optional[str]:
    """
    Validates, normalizes, and secures Trusted Resource URLs before returning to client.
    Priority:
    1. URL stored in the trusted/RAG document metadata (or specific article URL)
    2. Normalized domain if valid domain string (e.g. 'cisa.gov' -> 'https://www.cisa.gov/')
    3. Known official website mapping for verified organization (CISA, FBI, FTC, OWASP, CERT-In)
    Otherwise returns None (non-clickable).
    Strictly forbids javascript:, data:, file:, localhost, private IPs, or malformed URLs.
    """
    candidate = (raw_url or "").strip()

    if candidate:
        lower_cand = candidate.lower()
        # Reject prohibited dangerous schemes immediately
        if any(lower_cand.startswith(bad_scheme) for bad_scheme in BLOCKED_URL_SCHEMES):
            return None

        # If candidate is a bare valid domain (e.g., 'cisa.gov', 'fbi.gov', 'consumer.ftc.gov')
        if not lower_cand.startswith("http://") and not lower_cand.startswith("https://"):
            first_slash = candidate.find("/")
            domain_part = candidate[:first_slash] if first_slash != -1 else candidate
            if DOMAIN_REGEX.match(candidate) or DOMAIN_REGEX.match(domain_part):
                candidate = f"https://{candidate}"
            else:
                candidate = ""

        # Validate parsed URL
        if candidate:
            try:
                parsed = urlparse(candidate)
                if parsed.scheme not in ("http", "https"):
                    candidate = ""
                else:
                    host = (parsed.hostname or "").lower()
                    if (
                        not host
                        or host in BLOCKED_URL_HOSTS
                        or host.startswith("192.168.")
                        or host.startswith("10.")
                        or host.endswith(".local")
                        or host.endswith(".internal")
                        or (host.startswith("172.") and any(host.startswith(f"172.{i}.") for i in range(16, 32)))
                    ):
                        candidate = ""
            except Exception:
                candidate = ""

    # If document has no valid URL stored, fallback to known verified organization mapping
    if not candidate and source_name:
        src_lower = source_name.strip().lower()
        for org_key, official_url in KNOWN_OFFICIAL_WEBSITE_MAP.items():
            if org_key in src_lower:
                candidate = official_url
                break

    return candidate if candidate else None


# Extensible registry of context-specific hardware, physical locations, and situational markers
SPECIFIC_SCENARIOS = [
    {
        "name": "parking_meter",
        "keywords": ["parking meter", "parking pay station", "pay by plate", "parkmobile", "parking kiosk", "meter parking"],
        "check": lambda ctx: "parking meter" in ctx.get("objects", []) or "parking" in ctx.get("locations", []),
        "sanitized_title": "CISA / FBI Guidance: Malicious QR Codes & Quishing (General Security Advisory)"
    },
    {
        "name": "gas_pump",
        "keywords": ["gas pump", "fuel pump", "petrol pump", "fuel dispenser"],
        "check": lambda ctx: "gas pump" in ctx.get("objects", []) or "gas station" in ctx.get("locations", []),
        "sanitized_title": "CISA / FBI Guidance: Malicious QR Codes & Quishing (General Security Advisory)"
    },
    {
        "name": "ticketing_kiosk",
        "keywords": ["ticketing kiosk", "transit ticketing kiosk", "ticket vending machine", "transit kiosk"],
        "check": lambda ctx: "ticketing kiosk" in ctx.get("objects", []) or "transit station" in ctx.get("locations", []),
        "sanitized_title": "CISA / FBI Guidance: Malicious QR Codes & Quishing (General Security Advisory)"
    },
    {
        "name": "charging_station",
        "keywords": ["outdoor charging station", "charging kiosk", "ev charger", "charging station"],
        "check": lambda ctx: "charging station" in ctx.get("objects", []),
        "sanitized_title": "CISA / FBI Guidance: Malicious QR Codes & Quishing (General Security Advisory)"
    },
    {
        "name": "remote_desktop",
        "keywords": ["remote desktop", "anydesk", "teamviewer", "rustdesk", "quicksupport", "screen-sharing", "screen share"],
        "check": lambda ctx: "remote desktop" in ctx.get("platforms", []),
        "sanitized_title": None
    },
    {
        "name": "bank_portal_login",
        "keywords": ["bank login portal", "netbanking password", "mfa login portal", "microsoft 365 login", "banking credentials"],
        "check": lambda ctx: "banking portal" in ctx.get("platforms", []) or ctx.get("transaction_context") == "credential_login",
        "sanitized_title": None
    },
    {
        "name": "lottery_reward",
        "keywords": ["lottery prize", "sweepstakes winner", "scratch card winner", "unclaimed refund", "unclaimed lottery"],
        "check": lambda ctx: ctx.get("transaction_context") == "lottery_refund",
        "sanitized_title": None
    },
    {
        "name": "p2p_overpayment",
        "keywords": ["fake overpayment", "accidental transfer refund", "sent you too much money", "overpayment scam"],
        "check": lambda ctx: ctx.get("transaction_context") in ["p2p_transfer", "overpayment_scam"],
        "sanitized_title": None
    }
]

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

    def retrieve_relevant_documents(self, query: str, top_k: int = 6) -> List[Dict[str, Any]]:
        """
        Generates a 1536-dimensional embedding using Gemini Embedding 2,
        then calls the Supabase match_documents RPC directly with verified parameters to find candidate chunks.
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
                logger.info(f"Retrieved {len(response.data)} candidate document chunks from Supabase match_documents")
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

    def filter_and_rerank_candidates(
        self,
        candidates: List[Dict[str, Any]],
        query: str,
        evidence_type: str,
        evidence_context: Dict[str, Any],
        top_k: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Applies contextual relevance filtering and lightweight reranking:
        - Evaluates vector similarity against base threshold
        - Identifies specific scenario/hardware requirements in chunks
        - Boosts chunks matching evidenced scenarios; downgrades/filters unevidenced scenario claims
        - Preserves general security guidance chunks from mixed advisories
        - Formats/sanitizes source titles if general guidance is retained but specific scenario is absent
        - Logs full evaluation pipeline for auditability
        """
        if not candidates:
            return []

        objects = evidence_context.get("objects", [])
        locations = evidence_context.get("locations", [])
        platforms = evidence_context.get("platforms", [])
        tx_context = evidence_context.get("transaction_context")
        is_parking_meter = "parking meter" in objects or "parking" in locations

        scored_candidates: List[Dict[str, Any]] = []
        candidate_log_lines: List[str] = []

        for c_idx, doc in enumerate(candidates, start=1):
            content = doc.get("content", "")
            lower_content = content.lower()
            source_name = doc.get("source", "Authoritative Advisory")
            category = (doc.get("category") or "cybersecurity").lower()
            meta = doc.get("metadata") or {}
            orig_title = meta.get("document_title") or meta.get("title") or f"{source_name} Security Guidelines"
            raw_sim = float(doc.get("similarity", 0.0))

            # 1. Base similarity check
            if raw_sim < MIN_BASE_SIMILARITY:
                candidate_log_lines.append(
                    f"Candidate [{c_idx}]: {orig_title} (chunk {meta.get('chunk_index', '?')})\n"
                    f"  similarity = {raw_sim:.3f}\n"
                    f"  context_match = false (below base threshold {MIN_BASE_SIMILARITY})\n"
                    f"  decision = REJECT_LOW_SIMILARITY"
                )
                continue

            # 2. Specific scenario checks
            matched_scenarios = []
            mismatched_scenarios = []
            scenario_bonus = 0.0
            scenario_penalty = 0.0
            sanitized_title = None

            for scenario in SPECIFIC_SCENARIOS:
                if any(kw in lower_content for kw in scenario["keywords"]):
                    if scenario["check"](evidence_context):
                        matched_scenarios.append(scenario["name"])
                        scenario_bonus += 0.20
                    else:
                        mismatched_scenarios.append(scenario["name"])
                        # If the chunk exclusively or heavily asserts this specific absent scenario
                        # (e.g. detailed instructions on parking meter sticker overlays), apply penalty
                        scenario_penalty += 0.35
                        if scenario.get("sanitized_title"):
                            sanitized_title = scenario["sanitized_title"]

            # Also check if original document title references a specific scenario absent from evidence
            if "parking meter" in orig_title.lower() and not is_parking_meter:
                if not sanitized_title:
                    sanitized_title = "CISA / FBI Guidance: Malicious QR Codes & Quishing (General Security Advisory)"

            # 3. Evidence type & category match bonus
            category_bonus = 0.0
            if evidence_type == "qr_code" and category == "qr_scams":
                category_bonus += 0.15
            elif evidence_type == "url" and category == "malicious_urls":
                category_bonus += 0.15
            elif evidence_type in ["sms", "text"] and category in ["phishing", "payment_scams"]:
                category_bonus += 0.15
            elif tx_context in ["payment", "p2p_transfer", "upi_payment", "receipt_verification"] and category == "payment_scams":
                category_bonus += 0.15

            # 4. Transaction context bonus
            tx_bonus = 0.0
            if tx_context == "receipt_verification" and any(w in lower_content for w in ["receipt", "invoice", "transfer", "record"]):
                tx_bonus += 0.10
            elif tx_context == "urgent_bill" and any(w in lower_content for w in ["urgent", "deadline", "immediate", "disconnect", "penalty"]):
                tx_bonus += 0.10

            # 5. Compute final relevance
            final_relevance = raw_sim + scenario_bonus + category_bonus + tx_bonus - scenario_penalty

            # 6. Determine decision
            decision = "UNKNOWN"
            is_valid = True

            if scenario_penalty > 0 and final_relevance < MIN_FINAL_RELEVANCE:
                decision = "DOWNGRADE/FILTER (scenario unsupported by evidence)"
                is_valid = False
            elif final_relevance < MIN_FINAL_RELEVANCE:
                decision = f"REJECT_INSUFFICIENT_RELEVANCE ({final_relevance:.3f} < {MIN_FINAL_RELEVANCE})"
                is_valid = False
            elif matched_scenarios:
                decision = f"KEEP_SPECIFIC_MATCH ({', '.join(matched_scenarios)})"
            elif mismatched_scenarios:
                # Kept because general guidance portion outweighed the scenario penalty
                decision = "KEEP_GENERAL_GUIDANCE (unevidenced scenario claims sanitized)"
            else:
                decision = "KEEP_GENERAL_GUIDANCE"

            candidate_log_lines.append(
                f"Candidate [{c_idx}]: {orig_title} (chunk {meta.get('chunk_index', '?')})\n"
                f"  similarity = {raw_sim:.3f}\n"
                f"  final_relevance = {final_relevance:.3f} (bonus: +{scenario_bonus+category_bonus+tx_bonus:.2f}, penalty: -{scenario_penalty:.2f})\n"
                f"  context_match = {'specific' if matched_scenarios else ('mismatched' if mismatched_scenarios else 'general')}\n"
                f"  decision = {decision}"
            )

            if is_valid:
                doc_copy = dict(doc)
                doc_copy["final_relevance"] = final_relevance
                doc_copy["sanitized_title"] = sanitized_title if sanitized_title else orig_title
                doc_copy["is_sanitized"] = bool(sanitized_title)
                scored_candidates.append(doc_copy)

        # Sort by final relevance descending
        scored_candidates.sort(key=lambda x: x.get("final_relevance", 0.0), reverse=True)
        final_docs = scored_candidates[:top_k]

        # Log pipeline summary
        if ENABLE_RAG_DEBUG_LOGGING:
            logger.info(
                f"\n=== [RAG CONTEXTUAL RELEVANCE EVALUATION] ===\n"
                f"Evidence context:\n"
                f"  type: {evidence_type}\n"
                f"  objects: {objects}\n"
                f"  locations: {locations}\n"
                f"  platforms: {platforms}\n"
                f"  transaction_context: {tx_context}\n"
                f"  parking_meter_detected: {is_parking_meter}\n"
                f"Retrieval query:\n  {query}\n"
                f"Evaluated candidates:\n"
                + "\n\n".join(candidate_log_lines)
                + f"\n\nFinal documents passed to Gemini: {len(final_docs)} chunk(s)\n"
                + "============================================="
            )

        return final_docs

    def format_sources_and_context(
        self,
        documents: List[Dict[str, Any]],
        evidence_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Converts retrieved document records into structured SourceItem list
        and formatted text block for Gemini prompt injection.
        Respects sanitized general titles when context-specific claims were excluded.
        """
        source_items: List[SourceItem] = []
        context_blocks: List[str] = []

        for idx, doc in enumerate(documents, start=1):
            content = doc.get("content", "")
            source_name = doc.get("source", "Authoritative Advisory")
            category = doc.get("category", "cybersecurity")
            meta = doc.get("metadata") or {}
            
            title = doc.get("sanitized_title") or meta.get("document_title") or meta.get("title") or f"{source_name} Security Guidelines"
            candidate_url = (
                meta.get("source_url")
                or meta.get("url")
                or meta.get("website")
                or doc.get("source_url")
                or doc.get("url")
                or ""
            )
            validated_url = normalize_and_validate_resource_url(candidate_url, source_name=source_name) or ""
            
            # Format clean snippet
            if doc.get("is_sanitized"):
                snippet = "Authoritative guidance on verifying QR destinations, previewing decoded web links, and validating recipient merchant identity before authorizing payments."
            else:
                snippet = content[:250].replace("\n", " ") + ("..." if len(content) > 250 else "")

            source_items.append(SourceItem(
                title=title,
                source=source_name,
                category=category,
                url=validated_url,
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

