import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.graph.workflow import workflow

def run_test(name, initial_state):
    print(f"\n{'='*70}\nRUNNING: {name}\n{'='*70}")
    result = workflow.invoke(initial_state)
    meta = result.get("metadata", {})
    context = meta.get("context", {})
    sources = result.get("rag_sources", [])
    answer = result.get("final_answer", "")
    
    print(f"Evidence Type: {meta.get('evidence_type')}")
    print(f"Context Objects: {context.get('objects')}")
    print(f"Context Locations: {context.get('locations')}")
    print(f"Transaction Context: {context.get('transaction_context')}")
    print(f"Retrieval Query: {meta.get('retrieval_query')}")
    print(f"Retrieved Sources ({len(sources)}):")
    for s in sources:
        print(f"  - [{s.source}] {s.title}")
    
    print(f"\nAnswer Excerpt (first 300 chars):\n{answer[:300]}...\n")
    return {
        "context": context,
        "sources": sources,
        "answer": answer
    }

def main():
    print("Testing All 6 Required Scenarios for Contextual RAG Grounding...")

    # TEST 1: Tampered Parking QR
    res1 = run_test(
        "TEST 1: Tampered Parking QR",
        {
            "question": "I saw this QR code sticker pasted over the original payment code on a street parking meter. Is it safe to scan to pay for parking?",
            "url": "http://park-quick-pay.xyz/meter441",
            "image_bytes": None,
            "image_mime": None,
            "conversation_history": [],
            "evidence_type": "text",
            "context": {"objects": [], "locations": [], "platforms": [], "transaction_context": None},
            "evidence_context": "",
            "security_evidence": [],
            "rag_sources": [],
            "rag_context_text": "",
            "metadata": {},
            "final_answer": ""
        }
    )
    assert "parking meter" in res1["context"].get("objects", []) or "parking" in res1["context"].get("locations", []), "Parking meter context missing in Test 1"
    assert any("Parking Meter" in s.title for s in res1["sources"]), "Parking meter document should be relevant in Test 1"

    # TEST 2: Restaurant QR
    res2 = run_test(
        "TEST 2: Restaurant QR",
        {
            "question": "I am at a restaurant table and scanned this QR code on the menu poster to pay for lunch. Is it legitimate?",
            "url": "http://foodie-pay-dine.top/bill123",
            "image_bytes": None,
            "image_mime": None,
            "conversation_history": [],
            "evidence_type": "text",
            "context": {"objects": [], "locations": [], "platforms": [], "transaction_context": None},
            "evidence_context": "",
            "security_evidence": [],
            "rag_sources": [],
            "rag_context_text": "",
            "metadata": {},
            "final_answer": ""
        }
    )
    assert "parking meter" not in res2["context"].get("objects", []), "Parking meter falsely detected in Test 2"
    for s in res2["sources"]:
        assert "Parking Meter Tampering" not in s.title, f"Parking meter title falsely presented in Test 2: {s.title}"
    assert "parking meter" not in res2["answer"].lower(), "Answer falsely claimed parking meter in Test 2"

    # TEST 3: Suspicious Bank URL
    res3 = run_test(
        "TEST 3: Suspicious Bank URL",
        {
            "question": "Someone sent me this link saying my bank account will be suspended: http://secure-login-chase-update.com/signin. Should I enter my credentials?",
            "url": "http://secure-login-chase-update.com/signin",
            "image_bytes": None,
            "image_mime": None,
            "conversation_history": [],
            "evidence_type": "text",
            "context": {"objects": [], "locations": [], "platforms": [], "transaction_context": None},
            "evidence_context": "",
            "security_evidence": [],
            "rag_sources": [],
            "rag_context_text": "",
            "metadata": {},
            "final_answer": ""
        }
    )
    for s in res3["sources"]:
        assert "Parking Meter" not in s.title, f"Parking meter document should not dominate bank URL test: {s.title}"

    # TEST 4: Urgent Payment SMS
    res4 = run_test(
        "TEST 4: Urgent Payment SMS",
        {
            "question": "URGENT NOTICE: Your electricity power supply will be disconnected tonight at 9:30 PM due to unpaid bill of $142. Call officer at 9876543210 immediately to pay.",
            "url": None,
            "image_bytes": None,
            "image_mime": None,
            "conversation_history": [],
            "evidence_type": "text",
            "context": {"objects": [], "locations": [], "platforms": [], "transaction_context": None},
            "evidence_context": "",
            "security_evidence": [],
            "rag_sources": [],
            "rag_context_text": "",
            "metadata": {},
            "final_answer": ""
        }
    )
    for s in res4["sources"]:
        assert "Parking Meter" not in s.title, f"Parking meter document should not appear in SMS test: {s.title}"

    # TEST 5: Forged Receipt
    res5 = run_test(
        "TEST 5: Forged Receipt",
        {
            "question": "A buyer sent me this payment receipt screenshot claiming they sent $450 for my item and asking me to ship immediately. How do I verify this payment receipt?",
            "url": None,
            "image_bytes": None,
            "image_mime": None,
            "conversation_history": [],
            "evidence_type": "text",
            "context": {"objects": [], "locations": [], "platforms": [], "transaction_context": None},
            "evidence_context": "",
            "security_evidence": [],
            "rag_sources": [],
            "rag_context_text": "",
            "metadata": {},
            "final_answer": ""
        }
    )
    for s in res5["sources"]:
        assert "Parking Meter" not in s.title, f"Parking meter document should not appear in receipt test: {s.title}"

    # TEST 6: No Relevant Document
    res6 = run_test(
        "TEST 6: No Relevant Document",
        {
            "question": "How do I configure my home Wi-Fi router password and DHCP subnet mask range?",
            "url": None,
            "image_bytes": None,
            "image_mime": None,
            "conversation_history": [],
            "evidence_type": "text",
            "context": {"objects": [], "locations": [], "platforms": [], "transaction_context": None},
            "evidence_context": "",
            "security_evidence": [],
            "rag_sources": [],
            "rag_context_text": "",
            "metadata": {},
            "final_answer": ""
        }
    )
    assert len(res6["sources"]) == 0, f"Expected 0 sources for unrelated query, got {len(res6['sources'])}"
    print("\nALL 6 TEST SCENARIOS PASSED WITH FULL COMPLIANCE!")

if __name__ == "__main__":
    main()
