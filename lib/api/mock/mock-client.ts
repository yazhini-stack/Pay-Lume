import { EvidencePayload, EvidenceType, ExtractedContext } from "@/types/evidence";
import { Conversation, Message, Citation, StructuredAnswer } from "@/types/chat";
import { 
  EvidenceUploadResponse, 
  CreateConversationRequest, 
  CreateConversationResponse, 
  SSEEvent 
} from "@/types/api";
import { MOCK_PRELOADED_CONVERSATIONS, MOCK_CITATIONS } from "./fixtures";
import { isConversationalMessage, getConversationalReply } from "@/lib/utils";

const STORAGE_KEY = "paylume_mock_conversations";

function getStoredConversations(): Conversation[] {
  if (typeof window === "undefined") return MOCK_PRELOADED_CONVERSATIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_PRELOADED_CONVERSATIONS));
      return MOCK_PRELOADED_CONVERSATIONS;
    }
    return JSON.parse(raw);
  } catch {
    return MOCK_PRELOADED_CONVERSATIONS;
  }
}

function saveStoredConversations(convs: Conversation[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  } catch (e) {
    console.error("Failed to save conversations to localStorage", e);
  }
}

export class MockApiClient {
  async uploadEvidence(
    file: File, 
    onProgress?: (percent: number) => void
  ): Promise<EvidenceUploadResponse> {
    // Check error simulation
    if (file.name.toLowerCase().includes("fail") || file.name.toLowerCase().includes("corrupt")) {
      throw new Error("Extraction failed: Unreadable or corrupted image file. Please provide a clearer photo.");
    }

    // Simulate upload progress
    const steps = [15, 45, 75, 95, 100];
    for (const pct of steps) {
      await new Promise((r) => setTimeout(r, 80));
      onProgress?.(pct);
    }

    const isQr = file.name.toLowerCase().includes("qr") || file.name.toLowerCase().includes("barcode");
    const isSensitive = file.name.toLowerCase().includes("otp") || file.name.toLowerCase().includes("cvv") || file.name.toLowerCase().includes("sensitive");

    const evidenceType: EvidenceType = isQr ? "qr" : "screenshot";
    const evidenceId = `ev-${Date.now()}`;

    // Read file as data URL for local preview
    const previewUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

    const extracted: ExtractedContext = {
      ocrText: isQr
        ? "MUNICIPAL PARKING - SCAN TO PAY HOURLY RATE ₹120. SLOT 44B"
        : "PAYMENT TRANSFER CONFIRMATION: Ref #TXN984210. Status: In Escrow Hold. Beneficiary: Global Escrow Release Desk.",
      detectedUrls: isQr ? ["upi://pay?pa=quickpay.muni.services@okaxis"] : [],
      paymentFields: {
        payee: isQr ? "CityMunicipalPay" : "Global Escrow Release Desk",
        amount: isQr ? "120.00" : "4,850.00",
        currency: isQr ? "INR" : "USD",
        accountOrVpa: isQr ? "quickpay.muni.services@okaxis" : "ESCROW-98421",
        urgencyPhrases: isQr ? [] : ["funds on temporary hold", "release fee required within 24h"]
      },
      sensitiveDataDetected: isSensitive ? {
        hasOtp: true,
        hasCvv: true,
        warningMessage: "Sensitive financial data detected (potential OTP or card verification number in image). Ensure you never share authentication credentials."
      } : undefined,
      extractionConfidence: 0.96,
      timestamp: new Date().toISOString()
    };

    const evidence: EvidencePayload = {
      id: evidenceId,
      type: evidenceType,
      title: file.name,
      previewUrl,
      fileMeta: {
        name: file.name,
        size: file.size,
        type: file.type
      },
      qrDecoded: isQr ? {
        rawPayload: "upi://pay?pa=quickpay.muni.services@okaxis&pn=CityMunicipalPay&am=120.00&cu=INR&tn=ParkingSlot44B",
        protocol: "UPI Pay",
        payeeName: "CityMunicipalPay",
        vpaOrAccount: "quickpay.muni.services@okaxis",
        amount: "₹120.00",
        category: "Peer-to-Peer / Unverified Merchant",
        parsedFields: {
          "Payee Address (VPA)": "quickpay.muni.services@okaxis",
          "Merchant / Display Name": "CityMunicipalPay",
          "Preset Amount": "₹120.00",
          "Currency": "INR",
          "Transaction Note": "ParkingSlot44B"
        }
      } : undefined,
      extractedContext: extracted,
      createdAt: new Date().toISOString()
    };

    return {
      evidenceId,
      type: evidenceType,
      previewUrl,
      evidence,
      extracted
    };
  }

  async uploadUrl(url: string): Promise<EvidenceUploadResponse> {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new Error("Invalid URL: Must begin with http:// or https://");
    }

    if (url.includes("blocked") || url.includes("unreachable")) {
      throw new Error("Extraction failed: Remote web host is unreachable or rejected connection.");
    }

    await new Promise((r) => setTimeout(r, 600));

    let domain = "";
    try {
      domain = new URL(url).hostname;
    } catch {
      domain = url;
    }

    const evidenceId = `ev-url-${Date.now()}`;
    const extracted: ExtractedContext = {
      detectedUrls: [url],
      domainMetadata: {
        domain,
        isHttps: url.startsWith("https://"),
        creationAge: "3 days old",
        registrar: "Tucows Domains Privacy Shield",
        reputationScore: "High Risk (Brand lookalike heuristic triggered)"
      },
      paymentFields: {
        payee: domain,
        urgencyPhrases: ["Immediate account authorization required", "Session expires in 05:00"]
      },
      extractionConfidence: 0.99,
      timestamp: new Date().toISOString()
    };

    const evidence: EvidencePayload = {
      id: evidenceId,
      type: "url",
      title: domain,
      url,
      extractedContext: extracted,
      createdAt: new Date().toISOString()
    };

    return {
      evidenceId,
      type: "url",
      evidence,
      extracted
    };
  }

  createRawMessageEvidence(text: string): EvidenceUploadResponse {
    const evidenceId = `ev-msg-${Date.now()}`;
    const hasUrgency = text.toLowerCase().includes("urgent") || text.toLowerCase().includes("disconnect") || text.toLowerCase().includes("tonight");
    
    const extracted: ExtractedContext = {
      ocrText: "",
      paymentFields: {
        payee: "Unknown SMS Sender",
        urgencyPhrases: hasUrgency ? ["immediate disconnect", "pay tonight"] : []
      },
      extractionConfidence: 0.94,
      timestamp: new Date().toISOString()
    };

    const evidence: EvidencePayload = {
      id: evidenceId,
      type: "message",
      title: "Pasted notification text",
      rawText: text,
      extractedContext: extracted,
      createdAt: new Date().toISOString()
    };

    return {
      evidenceId,
      type: "message",
      evidence,
      extracted
    };
  }

  async getConversations(): Promise<Conversation[]> {
    await new Promise((r) => setTimeout(r, 150));
    return getStoredConversations();
  }

  async getConversation(id: string): Promise<Conversation | null> {
    await new Promise((r) => setTimeout(r, 100));
    const all = getStoredConversations();
    return all.find((c) => c.id === id) || null;
  }

  async createConversation(req: CreateConversationRequest): Promise<CreateConversationResponse> {
    await new Promise((r) => setTimeout(r, 200));
    const all = getStoredConversations();
    const id = `conv-${Date.now()}`;

    const newConv: Conversation = {
      id,
      title: req.title || (req.evidencePayload?.title ?? "New Analysis"),
      evidence: req.evidencePayload || {
        id: req.evidenceId,
        type: "screenshot",
        title: "Attached Evidence",
        createdAt: new Date().toISOString()
      },
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    all.unshift(newConv);
    saveStoredConversations(all);

    return {
      conversationId: id,
      conversation: newConv
    };
  }

  async deleteConversation(id: string): Promise<void> {
    await new Promise((r) => setTimeout(r, 100));
    const all = getStoredConversations();
    const filtered = all.filter((c) => c.id !== id);
    saveStoredConversations(filtered);
  }

  async streamMessage(
    conversationId: string,
    question: string,
    onEvent: (event: SSEEvent) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const all = getStoredConversations();
    const conv = all.find((c) => c.id === conversationId);
    const evidence = conv?.evidence;

    // If it's a conversational message, skip security pipeline delay
    if (isConversationalMessage(question)) {
      const { content } = this.generateQuestionDrivenAnswer(question, evidence);
      if (content) {
        const words = content.split(" ");
        for (let i = 0; i < words.length; i++) {
          if (signal?.aborted) return;
          const delta = (i === 0 ? "" : " ") + words[i];
          onEvent({ type: 'token', data: { delta } });
          await new Promise((r) => setTimeout(r, 12));
        }
      }
      const messageId = `msg-asst-${Date.now()}`;
      const userMsg: Message = {
        id: `msg-user-${Date.now()}`,
        conversationId,
        role: 'user',
        content: question,
        createdAt: new Date().toISOString()
      };
      const asstMsg: Message = {
        id: messageId,
        conversationId,
        role: 'assistant',
        content,
        citations: [],
        securityEvidence: [],
        createdAt: new Date().toISOString()
      };
      if (conv) {
        conv.messages.push(userMsg, asstMsg);
        conv.updatedAt = new Date().toISOString();
        saveStoredConversations(all);
      }
      onEvent({ type: 'done', data: { messageId, message: asstMsg } });
      return;
    }

    // Stage 1: Pipeline status progression for security queries
    const steps: { step: 'extracting' | 'retrieving' | 'reranking' | 'generating'; msg: string; delay: number }[] = [
      { step: 'extracting', msg: 'Analyzing question and attached evidence parameters...', delay: 350 },
      { step: 'retrieving', msg: 'Querying CISA, FTC, OWASP & CERT-In security advisories...', delay: 450 },
      { step: 'reranking', msg: 'Cross-referencing verified payment patterns & heuristics...', delay: 350 },
      { step: 'generating', msg: 'Formulating question-driven response...', delay: 250 }
    ];

    for (const s of steps) {
      if (signal?.aborted) return;
      onEvent({ type: 'status', data: { step: s.step, message: s.msg } });
      await new Promise((r) => setTimeout(r, s.delay));
    }

    if (signal?.aborted) return;

    // Generate dynamic response controlled by user's question and evidence
    const { content, sections, citations, securityEvidence } = this.generateQuestionDrivenAnswer(question, evidence);

    // Stream content if present
    if (content) {
      const words = content.split(" ");
      for (let i = 0; i < words.length; i++) {
        if (signal?.aborted) return;
        const delta = (i === 0 ? "" : " ") + words[i];
        onEvent({
          type: 'token',
          data: { delta }
        });
        await new Promise((r) => setTimeout(r, 18));
      }
    }

    // Stream sections if present and useful
    if (sections) {
      for (const [secKey, secVal] of Object.entries(sections)) {
        const secText = secVal as string | undefined;
        if (!secText) continue;
        const words = secText.split(" ");
        for (let i = 0; i < words.length; i++) {
          if (signal?.aborted) return;
          const delta = (i === 0 ? "" : " ") + words[i];
          onEvent({
            type: 'token',
            data: { delta, section: secKey as any }
          });
          await new Promise((r) => setTimeout(r, 18));
        }
      }
    }

    // Send citations
    for (const citation of citations) {
      if (signal?.aborted) return;
      onEvent({ type: 'citation', data: citation });
      await new Promise((r) => setTimeout(r, 50));
    }

    // Send security evidence if present
    if (securityEvidence && securityEvidence.length > 0) {
      if (!signal?.aborted) {
        onEvent({ type: 'evidence', data: securityEvidence });
      }
    }

    // Finalize message and save to conversation history
    const messageId = `msg-asst-${Date.now()}`;
    const userMsg: Message = {
      id: `msg-user-${Date.now()}`,
      conversationId,
      role: 'user',
      content: question,
      createdAt: new Date().toISOString()
    };

    const asstMsg: Message = {
      id: messageId,
      conversationId,
      role: 'assistant',
      content,
      sections,
      citations,
      securityEvidence: securityEvidence || [],
      createdAt: new Date().toISOString()
    };

    if (conv) {
      conv.messages.push(userMsg, asstMsg);
      conv.updatedAt = new Date().toISOString();
      saveStoredConversations(all);
    }

    onEvent({ type: 'done', data: { messageId, message: asstMsg } });
  }

  private generateQuestionDrivenAnswer(
    question: string,
    evidence?: EvidencePayload
  ): {
    content?: string;
    sections?: Partial<StructuredAnswer>;
    citations: Citation[];
    securityEvidence?: string[];
  } {
    const q = question.toLowerCase().trim();
    const evType = evidence?.type || "unknown";
    const citations: Citation[] = [];

    // 0. PURE CONVERSATIONAL TURNS (e.g. "Thank you", "Thanks", "Okay", "Got it", "Hi", "Hello")
    if (isConversationalMessage(question)) {
      return {
        content: getConversationalReply(question),
        citations: [],
        securityEvidence: []
      };
    }

    // 0b. CONVERSATION FOLLOW-UP QUESTIONS (Context-aware explanations)
    // Follow-up: "Why?" or "Why is the link suspicious?"
    if (q === "why" || q === "why?" || q.includes("why is the link") || q.includes("why is it suspicious") || q.includes("why suspicious") || q.includes("why is this suspicious")) {
      return {
        content: `The link was flagged because of multiple concrete security observations:\n\n1. **Unencrypted HTTP Connection**: The destination does not use SSL/TLS encryption, meaning any credentials or personal data entered can be intercepted.\n2. **Lookalike Financial Domain**: The hostname combines financial brand terms with authentication keywords (\`secure-chase-auth-verify\`), a standard typosquatting tactic.\n3. **High-Risk Disposable TLD**: Registered on a generic top-level domain (\`.xyz\`) only 2 days ago via privacy proxy services.\n4. **Credential Solicitation & Artificial Urgency**: The page prompts for login passwords alongside an urgent countdown timer (*"Session expires in 05:00"*) to pressure hasty submission.`,
        citations: [],
        securityEvidence: []
      };
    }

    // Follow-up: "What does HTTP mean?"
    if (q.includes("what does http mean") || q.includes("what is http") || q.includes("meaning of http") || q === "http" || q === "what is https") {
      return {
        content: `**HTTP** stands for **Hypertext Transfer Protocol** — the foundational protocol used by web browsers and servers to communicate.\n\nIn the context of the link you asked about:\n- **HTTP (Plaintext)**: Data sent over HTTP travels in plain, unencrypted text. Anyone on the same network (e.g., public Wi-Fi or compromised router) can view data entered into the page, including usernames and passwords.\n- **HTTPS (Secure)**: Adds an **SSL/TLS encryption layer**, ensuring communication is encrypted between your browser and the server.\n\n*Important Security Caveat*: While HTTPS encrypts transit, having HTTPS does **not** prove a site is trustworthy or authentic, because attackers can also obtain free SSL certificates. However, entering banking credentials on an unencrypted plain HTTP site is a direct security hazard.`,
        citations: [],
        securityEvidence: []
      };
    }

    // Check if user specifically requested a full structured breakdown (Observed / Interpretation / Recommended Actions)
    const isFullReportRequest = 
      q.includes("full breakdown") || 
      q.includes("structured breakdown") || 
      q.includes("full report") || 
      q.includes("observe and interpret") || 
      q.includes("complete analysis") ||
      q.includes("all three sections");

    if (isFullReportRequest) {
      if (evType === "qr") {
        citations.push(MOCK_CITATIONS.cisa_quishing, MOCK_CITATIONS.ftc_qr, MOCK_CITATIONS.cert_vpa);
        return {
          sections: {
            observed: "The QR barcode resolves to a peer-to-peer UPI payment string (`upi://pay?pa=quickpay.muni.services@okaxis&pn=CityMunicipalPay&am=120.00&cu=INR&tn=ParkingSlot44B`). The display label is `CityMunicipalPay`, but the payment route points to an individual consumer bank handle (`@okaxis`). A preset fixed transfer charge of ₹120.00 is designated with note `ParkingSlot44B`.",
            interpretation: "Municipal public transit and parking authorities deploy dedicated corporate merchant aggregators rather than personal bank handles [1]. Scammers frequently paste fraudulent adhesive QR overlays directly onto parking meters (termed 'quishing') to divert motorist payments to private accounts [2]. Anyone can create a personal handle with the display name `CityMunicipalPay` to deceive users [3].",
            actions: "1. Do not scan or authenticate this transaction with your PIN.\n2. Examine the physical sign or meter surface to verify whether the QR is an adhesive sticker layered over original signage [2].\n3. Pay directly through the official municipal parking portal or at a designated physical pay booth.\n4. Inform parking enforcement of the suspicious overlay sticker."
          },
          citations
        };
      } else if (evType === "url") {
        citations.push(MOCK_CITATIONS.owasp_domain);
        return {
          sections: {
            observed: "The link points to `https://secure-chase-auth-verify.xyz/login?session=exp89`. Domain records show registration 2 days ago via privacy protection services. The site serves over HTTPS with an automated domain-validated certificate. The page contains credential fields and a 5-minute session timeout alert.",
            interpretation: "Authentic financial institutions only service transactions through their authenticated primary root domain (e.g., `chase.com`). Note that HTTPS indicates encrypted transit, but HTTPS does NOT prove that a website is legitimate or authorized. Furthermore, while a `.xyz` or other generic TLD alone does NOT prove maliciousness, newly created lookalike domains pairing brand names with authentication words are consistent with credential harvesting patterns [4].",
            actions: "1. Immediately close this browser tab without submitting any personal data, passwords, or card numbers.\n2. Navigate directly to your bank's website by typing their official URL into a new browser window.\n3. Never enter one-time passwords (OTPs), card CVVs, or account PINs on this page."
          },
          citations
        };
      }
    }

    // 1. URL SPECIFIC QUESTIONS
    if (evType === "url" || q.includes("website") || q.includes("url") || q.includes("domain") || q.includes("site") || q.includes("link")) {
      const domain = evidence?.extractedContext?.domainMetadata?.domain || evidence?.url || "secure-chase-auth-verify.xyz";
      const age = evidence?.extractedContext?.domainMetadata?.creationAge || "2 days ago";
      const urlSecurityEvidence = [
        `Suspicious domain (${domain} registered ${age})`,
        "Generic TLD (.xyz) for financial institution",
        "Credential harvesting form detected",
        "Artificial urgency timer (5:00 expiration)"
      ];

      // Q: "What is this website?"
      if (q.includes("what is this website") || q.includes("what is this site") || q.includes("what website") || q.includes("what site") || q.includes("what is this link") || q.includes("what is this")) {
        citations.push(MOCK_CITATIONS.owasp_domain);
        return {
          content: `Based on the provided link, this is a web page hosted on the domain **\`${domain}\`**.

Key technical facts:
- **Domain Identity**: The hostname is \`${domain}\`. It is not the official primary domain of the financial institution it references.
- **Registration**: Domain records indicate it was registered **${age}** via an anonymous proxy registrar.
- **Security & HTTPS**: The site is accessed via HTTPS. It is critical to understand that **HTTPS does NOT prove that a website is legitimate** — HTTPS only confirms that connection data is encrypted in transit between your browser and the web server. It does not certify the identity or trustworthiness of the domain owner.
- **Domain Extension**: The site uses the generic top-level domain **\`.xyz\`**. Note that **a \`.xyz\` or other generic TLD alone does NOT prove that a website is malicious**, as many valid websites utilize diverse TLDs. However, major banks (such as JPMorgan Chase) operate strictly on their authenticated primary domain (\`chase.com\`), rather than hyphenated authentication domains.
- **Page Presentation**: The interface presents an account login and authorization form with an artificial urgency prompt (*"Session expires in 05:00"*).

**Safety Guidance**: Never enter passwords, One-Time Passwords (OTPs), card CVVs, or PINs on this page.`,
          citations,
          securityEvidence: urlSecurityEvidence
        };
      }

      // Q: "What information did you find about this website?"
      if (q.includes("what information") || q.includes("information did you find") || q.includes("what did you find") || q.includes("extract") || q.includes("findings")) {
        citations.push(MOCK_CITATIONS.owasp_domain);
        return {
          content: `Here is the specific technical and factual information extracted from this website:

### 1. Factual Evidence (Observed Parameters)
- **Target URL**: \`${evidence?.url || "https://secure-chase-auth-verify.xyz/login?session=exp89"}\`
- **Hostname / Domain**: \`${domain}\`
- **Domain Age**: Registered **${age}** using an anonymous proxy registrar service.
- **Transport Security**: HTTPS enabled with an automated domain-validation certificate.
- **Detected Form Fields**: User ID / account number input, password field, and urgent prompt *"Session expires in 05:00"*.

### 2. Analytical Interpretation
- **Distinguishing Evidence from Interpretation**: The concrete evidence is that this is a 2-day-old domain on a generic TLD with brand keywords in the hostname. The security interpretation is that this strongly mirrors common lookalike credential harvesting techniques [4].
- **No Absolute Assertions**: We do not claim a URL is definitely a scam without definitive threat intelligence, but the structural indicators make entering credentials extremely unsafe.
- **HTTPS Clarification**: Having HTTPS active only means that your connection is encrypted; it does not verify the authenticity of the site operator.

**Important**: We never request or collect passwords, OTPs, or financial secrets. Keep your credentials private.`,
          citations,
          securityEvidence: urlSecurityEvidence
        };
      }

      // Q: "What should I check before entering my payment details?"
      if (q.includes("what should i check") || q.includes("before entering") || q.includes("before paying") || q.includes("check before") || q.includes("safe to pay") || q.includes("safe?")) {
        citations.push(MOCK_CITATIONS.owasp_domain);
        return {
          content: `Before entering payment details, debit/credit card numbers, or credentials on this or any unfamiliar page, check these essential security items:

1. **Verify the Exact Address Bar Domain**:
   - Carefully check the root domain name in your browser's address bar. Legitimate banks and payment providers only conduct business on their established root domain (e.g., \`chase.com\`), never on hyphenated lookalike addresses (e.g., \`secure-chase-auth-verify.xyz\`).
   - Remember that **a \`.xyz\` or other generic TLD alone does not prove a site is malicious**, but major financial institutions rarely host customer login interfaces on disposable generic TLDs.

2. **Do Not Rely Solely on HTTPS or Padlock Icons**:
   - **HTTPS does NOT prove that a website is legitimate.** Free automated certificates are readily available to anyone. HTTPS only encrypts the transmission; it does not vouch for who receives it.

3. **Check How You Reached This Link**:
   - If you arrived here via an unexpected SMS, email alert, or chat message claiming urgent account suspension, do not use the link. Open a new browser tab and navigate manually to your bank's verified website, or use the bank's official mobile application.

4. **Non-Negotiable Rule for Secrets**:
   - **Never enter one-time passwords (OTPs), card CVVs, ATM PINs, or online banking passwords** on pages accessed via third-party messages. Real banks will never ask you to disclose an OTP to cancel or verify an unauthorized transaction.`,
          citations,
          securityEvidence: urlSecurityEvidence
        };
      }
    }

    // 2. QR CODE SPECIFIC QUESTIONS
    if (evType === "qr" || q.includes("qr") || q.includes("barcode") || q.includes("scan")) {
      const qr = evidence?.qrDecoded;
      const vpa = qr?.vpaOrAccount || "quickpay.muni.services@okaxis";
      const payee = qr?.payeeName || "CityMunicipalPay";
      const amount = qr?.amount || "₹120.00";
      const qrSecurityEvidence = [
        "Unverified consumer VPA handle (@okaxis) instead of municipal gateway",
        "Arbitrary display name spoofing risk",
        "Physical quishing adhesive overlay risk"
      ];

      // Q: "What does this QR code contain?"
      if (q.includes("what does this qr") || q.includes("qr code contain") || q.includes("what is in this qr") || q.includes("qr contain") || q.includes("decoded") || q.includes("payload")) {
        citations.push(MOCK_CITATIONS.cert_vpa);
        return {
          content: `The attached QR code contains a direct UPI payment instruction string with the following decoded parameters:

- **Protocol**: \`upi://pay\` (Standard Unified Payments Interface payment URI)
- **Payee Virtual Payment Address (VPA)**: \`${vpa}\`
  - Notice that this address is hosted on a consumer commercial bank handle (\`@okaxis\`), rather than an institutional municipal treasury gateway.
- **Merchant / Display Name**: \`${payee}\`
  - *Note on display names*: Any individual creating a VPA can specify a custom display name (such as "${payee}"). A display name does not confirm an authentic government or municipality affiliation [3].
- **Preset Amount**: **${amount}**
- **Transaction Note**: \`${qr?.parsedFields?.["Transaction Note"] || "ParkingSlot44B"}\`

**Summary**: Scanning this code prompts your payment app to immediately transfer ${amount} directly to the individual consumer VPA handle \`${vpa}\`.`,
          citations,
          securityEvidence: qrSecurityEvidence
        };
      }

      // Q: "Is it safe to scan this?"
      if (q.includes("is it safe") || q.includes("safe to scan") || q.includes("safe to pay") || q.includes("should i pay") || q.includes("should i scan")) {
        citations.push(MOCK_CITATIONS.cisa_quishing, MOCK_CITATIONS.ftc_qr, MOCK_CITATIONS.cert_vpa);
        return {
          content: `Authorizing payment through this QR code presents significant security concerns:

1. **Unverified Consumer Routing**:
   - The recipient handle is \`${vpa}\`. Official municipal parking departments use registered corporate merchant aggregators with verified merchant accounts, not generic consumer handles on commercial bank PSPs [1].
   - The display name \`${payee}\` can be registered by any private individual [3].

2. **Physical Sticker Overlay ("Quishing")**:
   - In public parking areas, malicious actors frequently stick fraudulent adhesive QR code labels over authentic parking meter signage [2]. When motorists scan the sticker, their payment goes directly to the fraudster while the motorist risks getting a parking violation ticket.

3. **Immediate Recommended Steps**:
   - **Do not enter your UPI PIN** to approve this payment.
   - Inspect the physical parking meter: check if this QR code is a peelable sticker placed over the metal plate.
   - Pay using the city's official parking app, or use the coin/card slot on the parking machine.
   - Report the suspected overlay sticker to parking enforcement or the local transit authority.`,
          citations,
          securityEvidence: qrSecurityEvidence
        };
      }
    }

    // 3. MESSAGE / SMS SPECIFIC QUESTIONS
    if (evType === "message" || q.includes("sms") || q.includes("message") || q.includes("text") || q.includes("power") || q.includes("electricity") || q.includes("disconnect")) {
      citations.push(MOCK_CITATIONS.ftc_utility);
      return {
        content: `Regarding the notification text you provided:

1. **Disconnection Protocol Reality**:
   - Legitimate utility companies are legally required to provide formal written notices with an official Consumer Account (CA) number and a statutory grace period (often 15 business days) before any service disconnection [5].
   - Utilities do not send informal same-day threats claiming disconnection "tonight at 9:30 PM".

2. **Sender Phone Header**:
   - Notice that this message came from an individual 10-digit telephone number rather than an official utility provider alpha-header (e.g., \`VK-STATEEB\`).
   - Utility providers never instruct customers to call individual personal phone numbers or transfer money directly to field officers.

3. **What You Should Do**:
   - **Do not call the personal phone number** listed in the message.
   - **Do not download any APK files** or apps sent via SMS or chat.
   - Check your actual billing balance by logging into your utility provider's verified portal or mobile app.
   - Call the customer service hotline printed on your previous paper electricity bill to confirm your status.`,
        citations,
        securityEvidence: [
          "Personal 10-digit phone sender instead of verified alpha-header",
          "Immediate same-day disconnection threat without statutory notice",
          "Call-to-action directs to personal phone number"
        ]
      };
    }

    // 4. SCREENSHOT / RECEIPT SPECIFIC QUESTIONS
    if (evType === "screenshot" || q.includes("receipt") || q.includes("screenshot") || q.includes("escrow") || q.includes("transfer") || q.includes("cleared")) {
      citations.push(MOCK_CITATIONS.ftc_qr);
      return {
        content: `Based on the analysis of the payment transfer receipt image:

1. **Font & Layout Inconsistencies**:
   - The reference ID and transaction amount text show slight typographic and spacing misalignment when compared against standard banking templates.

2. **Advance-Fee / Escrow Trap Pattern**:
   - The screenshot claims the transaction is in "Escrow Hold" and indicates an advance fee is needed to release funds.
   - **Critical Rule**: Authentic bank escrow and wire transfer systems never require the seller or recipient to deposit upfront personal funds ("clearance fees" or "release charges") to unlock an incoming payment. Demanding a fee to unlock pending funds is a classic advance-fee scam indicator.

3. **Recommended Actions**:
   - Do not pay any advance release or clearance fee.
   - Do not dispatch items or transfer property based on a buyer's screenshot.
   - Check your own bank account directly by logging into your official banking portal to see if funds have actually settled.`,
        citations,
        securityEvidence: [
          "Typography and layout misalignment on payment confirmation",
          "Advance fee required to release alleged escrow hold",
          "Unverified settlement status"
        ]
      };
    }

    // 5. DEFAULT CONTEXTUAL ANSWER FOR GENERAL QUESTIONS
    citations.push(MOCK_CITATIONS.ftc_qr, MOCK_CITATIONS.cisa_quishing);
    return {
      content: `In response to your question: **"${question}"**

Based on the evidence attached to this thread:
- **Observed Context**: The item being evaluated is a **${evType}** (${evidence?.title || "attached evidence"}).
- **Security Principles**:
  - Technical evidence is always evaluated factually before drawing conclusions.
  - **HTTPS does NOT prove that a website is legitimate**, as encrypted connections are available to any website operator.
  - **A .xyz or other generic TLD alone does NOT prove that a website is malicious**; however, financial and government operations consistently rely on their authenticated primary root domains.
  - **Never disclose authentication secrets**: We strongly remind you never to enter or share OTPs, PINs, card CVVs, or online banking passwords.
- **Next Steps**: If you have specific questions about any parameter (such as recipient handles, domain age, or safety verification steps), ask directly and I will inspect that specific aspect.`,
      citations,
      securityEvidence: evidence ? [
        "Unverified external payment request",
        "Domain and recipient route authentication required"
      ] : []
    };
  }
}

export const mockApiClient = new MockApiClient();
