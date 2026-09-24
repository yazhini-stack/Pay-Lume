import { Conversation, Citation } from "@/types/chat";
import { EvidencePayload } from "@/types/evidence";

export const MOCK_CITATIONS: Record<string, Citation> = {
  cisa_quishing: {
    id: 1,
    title: "CISA Alert AA23-074A: QR Code Quishing in Public Spaces",
    source: "Cybersecurity & Infrastructure Security Agency (CISA)",
    url: "https://www.cisa.gov/news-events/cybersecurity-advisories",
    snippet: "Malicious actors frequently place adhesive QR code overlays on legitimate public infrastructure such as parking meters and transit kiosks to redirect payments to rogue accounts."
  },
  ftc_qr: {
    id: 2,
    title: "FTC Consumer Advice: Scammers Are Using QR Codes to Steal Your Information",
    source: "Federal Trade Commission (FTC)",
    url: "https://consumer.ftc.gov/consumer-alerts/2023/12/scammers-are-using-qr-codes-steal-your-information",
    snippet: "Before scanning a QR code in public, inspect the surface for physical stickers placed over original signage. Verify the URL domain before entering any credentials or sending funds."
  },
  cert_vpa: {
    id: 3,
    title: "CERT-In Advisory CI-2024-0012: Phishing via Masqueraded Virtual Payment Addresses",
    source: "Indian Computer Emergency Response Team (CERT-In)",
    url: "https://www.cert-in.org.in",
    snippet: "Fraudsters register personal VPAs with names closely mimicking government and municipal departments, exploiting the fact that display names can differ from legal account holders."
  },
  owasp_domain: {
    id: 4,
    title: "OWASP Top 10 API & Web Security: Lookalike Domain and Credential Harvesting",
    source: "OWASP Foundation",
    url: "https://owasp.org",
    snippet: "Attackers commonly employ newly registered generic top-level domains (.xyz, .top, .live) with brand keywords to conduct lookalike credential and payment interception."
  },
  ftc_utility: {
    id: 5,
    title: "FTC Alert: Utility Scam Callers & Urgent Cutoff Threats",
    source: "Federal Trade Commission (FTC)",
    url: "https://consumer.ftc.gov/consumer-alerts/2022/07/utility-scams-turn-heat",
    snippet: "Legitimate utilities will never demand immediate payment through third-party apps, gift cards, or phone transfers within an arbitrary same-day deadline without prior mail notices."
  }
};

export const MOCK_PRELOADED_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-qr-parking-meter",
    title: "Parking meter sticker payment QR",
    evidence: {
      id: "ev-qr-1",
      type: "qr",
      title: "Public parking sticker barcode",
      previewUrl: "/mock/qr-parking.png",
      qrDecoded: {
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
          "Transaction Note": "ParkingSlot44B",
          "PSP Provider": "Axis Bank Consumer Gateway"
        }
      },
      extractedContext: {
        ocrText: "MUNICIPAL PARKING - SCAN TO PAY HOURLY RATE ₹120. SLOT 44B",
        detectedUrls: [],
        paymentFields: {
          payee: "CityMunicipalPay",
          amount: "120.00",
          currency: "INR",
          accountOrVpa: "quickpay.muni.services@okaxis",
          bankOrGateway: "Axis Bank Consumer Handle",
          refNumber: "ParkingSlot44B"
        },
        extractionConfidence: 0.98,
        timestamp: "2026-09-20T08:15:00Z"
      },
      createdAt: "2026-09-20T08:15:00Z"
    },
    messages: [
      {
        id: "msg-user-1",
        conversationId: "conv-qr-parking-meter",
        role: "user",
        content: "What does this QR code actually contain and is it safe to scan?",
        createdAt: "2026-09-20T08:16:00Z"
      },
      {
        id: "msg-asst-1",
        conversationId: "conv-qr-parking-meter",
        role: "assistant",
        sections: {
          observed: "The QR code decodes to a direct peer-to-peer payment string (`upi://pay?pa=quickpay.muni.services@okaxis`). While the display name is set to `CityMunicipalPay`, the receiving address is hosted on a consumer bank handle (`@okaxis`) rather than an institutional municipal aggregator. The transfer specifies a fixed value of ₹120.00 with the reference note `ParkingSlot44B`.",
          interpretation: "Municipal parking authorities universally use registered corporate merchant IDs with verified treasury accounts, rather than generic consumer email handles on commercial bank PSPs [1]. The display name `CityMunicipalPay` is freely customizable by individual account creators and does not represent official agency authentication [3]. Physical parking meters are high-frequency targets for physical sticker tampering (\"quishing\") where genuine payment plates are covered by rogue adhesive codes [2].",
          actions: "1. Do not complete or authenticate this payment transaction with your PIN.\n2. Physically check the meter plate to see if this code is a peelable overlay sticker placed on top of official signage [2].\n3. Pay through the city's official parking mobile app or directly at an automated ticket station.\n4. Report the suspect meter number to the municipal transit helpline."
        },
        citations: [
          MOCK_CITATIONS.cisa_quishing,
          MOCK_CITATIONS.ftc_qr,
          MOCK_CITATIONS.cert_vpa
        ],
        createdAt: "2026-09-20T08:16:15Z"
      }
    ],
    createdAt: "2026-09-20T08:15:00Z",
    updatedAt: "2026-09-20T08:16:15Z"
  },
  {
    id: "conv-url-bank-spoof",
    title: "Suspicious banking SMS link",
    evidence: {
      id: "ev-url-1",
      type: "url",
      title: "secure-chase-auth-verify.xyz",
      url: "https://secure-chase-auth-verify.xyz/login?session=exp89",
      extractedContext: {
        ocrText: "",
        detectedUrls: ["https://secure-chase-auth-verify.xyz/login?session=exp89"],
        domainMetadata: {
          domain: "secure-chase-auth-verify.xyz",
          isHttps: true,
          creationAge: "2 days old",
          registrar: "NameCheap Public Proxy",
          reputationScore: "High Risk (Brand Spoofing Flagged)"
        },
        extractionConfidence: 0.99,
        timestamp: "2026-09-19T14:22:00Z"
      },
      createdAt: "2026-09-19T14:22:00Z"
    },
    messages: [
      {
        id: "msg-user-2",
        conversationId: "conv-url-bank-spoof",
        role: "user",
        content: "What should I check before paying or entering my password here?",
        createdAt: "2026-09-19T14:23:00Z"
      },
      {
        id: "msg-asst-2",
        conversationId: "conv-url-bank-spoof",
        role: "assistant",
        sections: {
          observed: "The destination domain is `secure-chase-auth-verify.xyz`. Domain WHOIS records show this hostname was registered 2 days ago via an anonymous proxy registrar. Although it uses HTTPS, the certificate is an automated domain-validated certificate from Let's Encrypt, not an organizational certificate issued to JPMorgan Chase & Co.",
          interpretation: "Authentic financial institutions exclusively authenticate accounts on their primary root domain (e.g. `chase.com`). Scammers frequently register hyphenated domains combining brand names with words like 'secure', 'auth', or 'verify' using cheap generic TLDs like `.xyz` to impersonate legitimate login prompts [4]. HTTPS only confirms that the connection is encrypted, not that the destination belongs to the bank.",
          actions: "1. Close the browser tab immediately without typing any account numbers, passwords, or card digits.\n2. Navigate directly to your bank's verified website by typing `chase.com` into a fresh browser window or opening your official mobile app.\n3. If you previously entered credentials on this link, immediately call your bank's official fraud department via the number printed on the physical back of your debit card."
        },
        citations: [
          MOCK_CITATIONS.owasp_domain
        ],
        createdAt: "2026-09-19T14:23:25Z"
      }
    ],
    createdAt: "2026-09-19T14:22:00Z",
    updatedAt: "2026-09-19T14:23:25Z"
  },
  {
    id: "conv-msg-electricity",
    title: "Electricity disconnect warning SMS",
    evidence: {
      id: "ev-msg-1",
      type: "message",
      title: "Urgent power disconnect notice",
      rawText: "URGENT NOTICE: Dear consumer, your electricity supply will be disconnected tonight at 9:30 PM due to pending bill Rs 1,480. Please contact electricity officer Mr. Sharma immediately at 9811203491 or pay immediately to avoid penalty.",
      extractedContext: {
        ocrText: "",
        paymentFields: {
          payee: "Mr. Sharma (Alleged Officer)",
          amount: "1,480.00",
          currency: "INR",
          accountOrVpa: "9811203491",
          urgencyPhrases: ["disconnected tonight at 9:30 PM", "contact immediately", "avoid penalty"]
        },
        extractionConfidence: 0.95,
        timestamp: "2026-09-18T19:05:00Z"
      },
      createdAt: "2026-09-18T19:05:00Z"
    },
    messages: [
      {
        id: "msg-user-3",
        conversationId: "conv-msg-electricity",
        role: "user",
        content: "Will my power actually be cut off tonight if I don't pay this?",
        createdAt: "2026-09-18T19:06:00Z"
      },
      {
        id: "msg-asst-3",
        conversationId: "conv-msg-electricity",
        role: "assistant",
        sections: {
          observed: "The message originates from an individual 10-digit mobile number rather than a registered government bulk SMS sender header (such as `VK-STATEEB`). It cites a specific cutoff deadline ('tonight at 9:30 PM') and provides a personal mobile number rather than an official utility customer service hotline.",
          interpretation: "Statutory electricity utility regulations require formal written disconnection notices with a registered Consumer Account number and a minimum statutory grace period (often 15 business days). Utility providers never task individual executives to collect direct payments via personal mobile phones or WhatsApp [5]. Creating artificial urgency around immediate night-time disconnection is a textbook coercion tactic intended to induce panic payment.",
          actions: "1. Do not call the personal phone number provided or transfer funds to any personal UPI/account.\n2. Check your actual electricity account balance by logging into your state utility board's official portal or billing app.\n3. Call the verified 24/7 customer service number listed on an earlier paper bill to confirm your payment status."
        },
        citations: [
          MOCK_CITATIONS.ftc_utility
        ],
        createdAt: "2026-09-18T19:06:20Z"
      }
    ],
    createdAt: "2026-09-18T19:05:00Z",
    updatedAt: "2026-09-18T19:06:20Z"
  }
];

export const STARTER_QUESTIONS: Record<string, string[]> = {
  qr: [
    "What does this QR code actually contain?",
    "Is it safe to scan and pay this?",
    "How can I verify the recipient handle?"
  ],
  url: [
    "What should I check before paying or entering credentials here?",
    "Is this the genuine official portal or a spoof?",
    "Why does this domain look different from the brand's normal site?"
  ],
  screenshot: [
    "Does this payment receipt look authentic or digitally edited?",
    "Are these transaction references and bank stamps verifiable?",
    "Should I release the goods or services based on this screenshot?"
  ],
  message: [
    "Is the urgent payment or disconnection threat in this text real?",
    "Why is this message asking me to call a personal phone number?",
    "How do legitimate utility/bank notifications usually arrive?"
  ]
};
