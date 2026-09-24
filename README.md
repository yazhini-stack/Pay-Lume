# Paylume — Frontend

> **"Upload. Ask. Understand."**

Paylume is a multimodal RAG chatbot designed to help people understand suspicious payment-related content with clinical clarity and calm.

---

## 🛡️ Product Model

Paylume is **question-driven**, not a scanner. Uploading evidence will **never** trigger an automatic verdict, risk score, red/green badge, or percentage gauge.

- **Flow**: Attach evidence → User asks a question → Answer → Follow-up conversation
- **Persistent Context**: Attached evidence (QR barcode, screenshot, URL, or pasted message) stays anchored to the thread for seamless follow-up questions.
- **Three-Section Structured Answers**: Every response from Paylume is strictly separated into:
  1. `Observed` — Factually what is in the evidence
  2. `Interpretation` — Why those specific items matter
  3. `Recommended actions` — Concrete steps the user should take
- **Controlled Submission**: The send button remains disabled after attaching evidence until the user enters a question. Dynamic starter questions guide the user based on the evidence modality.

---

## 🎨 Design Direction

Directly inspired by the bespoke **emerald & jade luminous glassmorphic aesthetic**:
- **Background**: Deep obsidian & forest green canvas (`#060B08`) with ambient radial emerald glows.
- **Translucent Glass Cards**: Frosted panels with `backdrop-blur` and subtle borders (`rgba(74, 222, 128, 0.15)`).
- **Pill Badges & Buttons**: Radiant jade/mint gradient pill buttons (`#7CE698` to `#45B768`) and sleek status indicators.
- **Cyber-Brackets QR Inspector**: Glowing corner brackets framing QR payloads, inspired directly by the reference visual.
- **Amber Caution Notices**: Strictly reserved for privacy warnings and sensitive credential alerts — never used decoratively.

---

## 🚀 Getting Started

### 1. Installation
```bash
npm install
```

### 2. Running Locally with Mock Backend
By default, the application runs with `NEXT_PUBLIC_USE_MOCK_API=true` (defined in `.env.local`).

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Pointing to Real FastAPI Backend
To connect to your live FastAPI backend, adjust `.env.local`:

```env
NEXT_PUBLIC_USE_MOCK_API=false
NEXT_PUBLIC_API_URL=http://localhost:8000
```

The unified client in `lib/api/client.ts` automatically switches between the mock client and the real HTTP/SSE client with zero component changes.

---

## 📁 Directory Structure

```
├── app/
│   ├── globals.css                # Custom theme tokens, cyber-brackets, glassmorphism
│   ├── layout.tsx                 # Root layout with TanStack Query & dark mode
│   ├── page.tsx                   # Landing page (hero shield, 3-step flow, 4 modalities)
│   ├── providers.tsx              # QueryClientProvider & PrivacyGuardModal
│   └── chat/
│       ├── page.tsx               # Main chat workspace
│       └── [conversationId]/     # Hydrated chat workspace for specific threads
├── components/
│   ├── chat/
│   │   ├── ChatWorkspace.tsx      # Main 3-region workspace controller
│   │   ├── Composer.tsx           # Unified input, clipboard paste, starter questions
│   │   ├── ConversationSidebar.tsx# Collapsible conversation history, search, user profile
│   │   ├── MessageItem.tsx        # 3-section structured layout with citation popovers
│   │   ├── MessageThread.tsx      # Scrollable thread with auto-scroll & empty states
│   │   ├── PrivacyGuardModal.tsx  # First-upload session privacy guard
│   │   ├── RAGPipelineIndicator.tsx# Live stage progression indicator
│   │   └── StreamingControls.tsx  # Stop generation & error retry
│   ├── evidence/
│   │   ├── EvidencePanel.tsx      # Persistent right drawer for attached evidence
│   │   ├── EvidencePreview.tsx    # Cyber-bracket QR, URL card, image thumbnail, message text
│   │   └── ExtractedContextDisclosure.tsx # "What Paylume extracted" OCR & payment parameters
│   └── ui/
│       ├── Badge.tsx              # Pill status badges
│       ├── Button.tsx             # Jade pill buttons & frosted ghost buttons
│       ├── Lightbox.tsx           # Image inspector with zoom and rotate
│       ├── Modal.tsx              # Frosted dialog primitive
│       ├── Skeleton.tsx           # Calm emerald pulse loaders
│       └── Tooltip.tsx            # Accessible helper tooltips
├── lib/
│   ├── api/
│   │   ├── client.ts              # Unified API client (Mock & FastAPI parity)
│   │   └── mock/
│   │       ├── fixtures.ts        # Preloaded scam fixtures & citations (CISA, FTC, OWASP)
│   │       └── mock-client.ts     # Realistic SSE streaming & stage progression generator
│   ├── hooks/
│   │   ├── useAuth.ts             # Supabase Auth stub (Alex Thompson profile)
│   │   └── usePrivacyGuard.ts     # Session privacy acknowledgment tracker
│   ├── stores/
│   │   └── useChatStore.ts        # Zustand active chat, streaming, and UI store
│   └── utils.ts                   # Class merging & date formatters
└── types/
    ├── api.ts                     # SSE event types & endpoint request/response types
    ├── chat.ts                    # Message, conversation, and citation definitions
    └── evidence.ts                # Evidence modalities, OCR layers, and payment fields
```

---

## 💡 What I Would Change & Next Evolutionary Steps

Having built the complete end-to-end architecture according to the specification, here are the highest-impact enhancements recommended for future iterations:

1. **Interactive Evidence Bounding Boxes**:
   - In the evidence lightbox, overlay interactive bounding boxes on the screenshot pinpointing altered fonts or suspicious payment handles, allowing users to hover directly over the problematic area of a receipt.
2. **Client-Side WASM QR Decoding & EXIF Scrubbing**:
   - Incorporate a lightweight WebAssembly QR engine (`jsQR` or `@zxing/library`) in the browser to preview decoded payloads immediately before network upload, while automatically stripping sensitive EXIF geolocation metadata from uploaded phone screenshots.
3. **Multi-Item Evidence Comparison (Side-by-Side Context)**:
   - Extend the evidence panel to support secondary comparison attachments (e.g., comparing a suspicious SMS alongside the actual bank statement) within a single investigation thread.
4. **Offline PWA & Device Action Integration**:
   - Since users frequently review payment links and QR stickers while on the go on their mobile phones, packaging Paylume as a progressive web app (PWA) with quick "Share to Paylume" sheet integration from iOS / Android photos.
