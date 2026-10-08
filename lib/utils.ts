import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

const KNOWN_OFFICIAL_WEBSITE_MAP: Record<string, string> = {
  cisa: "https://www.cisa.gov/",
  fbi: "https://www.fbi.gov/",
  ic3: "https://www.ic3.gov/",
  ftc: "https://consumer.ftc.gov/",
  owasp: "https://owasp.org/",
  "cert-in": "https://www.cert-in.org.in/",
  certin: "https://www.cert-in.org.in/",
  nist: "https://www.nist.gov/",
};

const BLOCKED_SCHEMES = ["javascript:", "data:", "file:", "vbscript:", "blob:"];
const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "testserver"];

export function getSafeExternalUrl(
  rawUrl?: string | null,
  fallbackSource?: string | null
): string | null {
  if (!rawUrl && !fallbackSource) return null;
  const trimmed = (rawUrl || "").trim();

  let candidate = trimmed;

  if (candidate) {
    const lower = candidate.toLowerCase();
    // Reject dangerous schemes
    if (BLOCKED_SCHEMES.some((scheme) => lower.startsWith(scheme))) {
      return null;
    }

    // Normalize bare valid domains (e.g., "cisa.gov", "fbi.gov", "consumer.ftc.gov") to https://
    if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(\/[^\s]*)?$/;
      if (domainRegex.test(candidate)) {
        candidate = `https://${candidate}`;
      } else {
        candidate = "";
      }
    }

    // Validate URL syntax and host
    if (candidate) {
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          candidate = "";
        } else {
          const host = parsed.hostname.toLowerCase();
          if (
            !host ||
            BLOCKED_HOSTS.includes(host) ||
            host.startsWith("192.168.") ||
            host.startsWith("10.") ||
            host.endsWith(".local") ||
            host.endsWith(".internal")
          ) {
            candidate = "";
          }
        }
      } catch {
        candidate = "";
      }
    }
  }

  // Fallback to verified official website mapping if candidate is empty
  if (!candidate && fallbackSource) {
    const srcLower = fallbackSource.toLowerCase();
    for (const [key, officialUrl] of Object.entries(KNOWN_OFFICIAL_WEBSITE_MAP)) {
      if (srcLower.includes(key)) {
        candidate = officialUrl;
        break;
      }
    }
  }

  return candidate || null;
}

export function extractResourceDomain(
  rawUrl?: string | null,
  fallbackSource?: string | null
): string {
  const safeUrl = getSafeExternalUrl(rawUrl, fallbackSource);
  if (safeUrl) {
    try {
      return new URL(safeUrl).hostname.replace(/^www\./, "");
    } catch {
      // ignore
    }
  }

  if (fallbackSource) {
    const s = fallbackSource.toLowerCase();
    if (s.includes("cisa")) return "cisa.gov";
    if (s.includes("fbi")) return "fbi.gov";
    if (s.includes("ic3")) return "ic3.gov";
    if (s.includes("ftc")) return "consumer.ftc.gov";
    if (s.includes("owasp")) return "owasp.org";
    if (s.includes("cert-in") || s.includes("certin")) return "cert-in.org.in";
    if (s.includes("nist")) return "nist.gov";
  }

  return "";
}

export function isConversationalMessage(text: string): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase().replace(/[.,!?;:]+$/, "").trim();

  const exactPhrases = [
    "thank you", "thanks", "thank you so much", "thanks a lot", "many thanks", "thx", "ty",
    "ok", "okay", "k", "got it", "understood", "that makes sense", "makes sense",
    "sounds good", "alright", "all right", "sure", "cool", "great", "awesome", "perfect",
    "hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening", "good day",
    "bye", "goodbye", "see you", "have a good one", "have a nice day",
    "ok got it", "okay got it", "got it thanks", "got it thank you", "ok thanks", "okay thanks",
    "understood thanks", "understood thank you", "great thanks", "perfect thanks"
  ];

  if (exactPhrases.includes(clean)) return true;

  const conversationalPattern = /^(thanks?(\s+you)?(\s+so\s+much|\s+a\s+lot)?|ok(ay)?|got\s+it|understood|that\s+makes?\s+sense|makes?\s+sense|hi|hello|hey|good\s+(morning|afternoon|evening|day)|bye|goodbye)[.!?]*$/i;
  return conversationalPattern.test(clean);
}

export function getConversationalReply(text: string): string {
  const clean = text.trim().toLowerCase();
  if (clean.includes("thank") || clean.includes("thx") || clean.includes("ty")) {
    return "You’re welcome! Let me know if you have any other questions.";
  }
  if (clean.includes("hi") || clean.includes("hello") || clean.includes("hey")) {
    return "Hello! How can I help you inspect suspicious payment requests, QR codes, or messages today?";
  }
  if (clean.includes("bye") || clean.includes("see you")) {
    return "Stay safe! Reach out anytime you want to check a suspicious payment transaction.";
  }
  if (clean.includes("ok") || clean.includes("got it") || clean.includes("understood") || clean.includes("sense")) {
    return "Glad that makes sense! Feel free to ask if you have any follow-up questions.";
  }
  return "Happy to help! Let me know if you have any other questions or need to inspect another payment item.";
}

