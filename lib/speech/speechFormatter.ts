import type { Message, StructuredAnswer } from "@/types/chat";

/**
 * Strips raw markdown syntax, code fences, citations, and converts links
 * into readable text suitable for speech synthesis without omitting
 * security-critical warnings or recommendations.
 */
export function formatMarkdownForSpeech(markdown: string): string {
  if (!markdown || typeof markdown !== "string") return "";

  let text = markdown;

  // 1. Remove citations like [1], [2], [10]
  text = text.replace(/\[\d+\]/g, "");

  // 2. Remove code fences (code blocks)
  text = text.replace(/```(?:[a-zA-Z0-9_-]+)?\s*([\s\S]*?)```/g, () => {
    return " Code block omitted. ";
  });

  // 3. Inline code `code` -> code
  text = text.replace(/`([^`]+)`/g, "$1");

  // 4. Handle Markdown links: [Link Title](https://...) -> Link Title
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");

  // 5. Handle standalone URLs: replace with readable spoken hostname
  text = text.replace(/(https?:\/\/[^\s<>)"]+)/g, (match) => {
    try {
      const parsed = new URL(match);
      const cleanHost = parsed.hostname.replace(/^www\./, "");
      const spokenHost = cleanHost.replace(/\./g, " dot ");
      return ` link to ${spokenHost} `;
    } catch {
      return " web link ";
    }
  });

  // 6. Remove HTML tags if present (e.g., <br/>, <span...>)
  text = text.replace(/<\/?[a-zA-Z0-9]+(?:\s+[^>]*?)?\/?>/g, " ");

  // 7. Strip Markdown table borders and headers (e.g. |---|---|)
  text = text.replace(/\|[\s-:]+\|[\s-:|]*/g, " ");
  text = text.replace(/\|/g, ", ");

  // 8. Headers (# Header, ## Subheader) -> Header with natural pause
  text = text.replace(/^#{1,6}\s+(.+)$/gm, "$1. ");

  // 9. Blockquotes (> quote) -> quote
  text = text.replace(/^>\s*(.+)$/gm, "$1. ");

  // 10. List items
  // Unordered list items (* or - or +)
  text = text.replace(/^[\s]*[-*+]\s+(.+)$/gm, "$1. ");
  // Ordered list items (1. 2.)
  text = text.replace(/^[\s]*(\d+)\.\s+(.+)$/gm, "$1. $2. ");

  // 11. Bold, italics, strikethrough
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, "$1");
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");
  text = text.replace(/___([^_]+)___/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/_([^_]+)_/g, "$1");
  text = text.replace(/~~([^~]+)~~/g, "$1");

  // 12. Normalize whitespace, remove double periods or weird punctuation
  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\.\s*\./g, ".")
    .replace(/\s*,\s*,/g, ",")
    .replace(/\n+/g, " ")
    .replace(/\s*([.,!?;:])\s*/g, "$1 ")
    .trim();

  return text;
}

/**
 * Prepares the complete message (including sections: observed, interpretation, actions)
 * into a coherent spoken script that announces sections clearly so security advice
 * is preserved and easy to comprehend.
 */
export function prepareSpeechText(
  message: Pick<Message, "content"> & { sections?: Partial<StructuredAnswer> }
): string {
  const parts: string[] = [];

  if (message.content && message.content.trim()) {
    const cleanedContent = formatMarkdownForSpeech(message.content);
    if (cleanedContent) {
      parts.push(cleanedContent);
    }
  }

  if (message.sections) {
    if (message.sections.observed && message.sections.observed.trim()) {
      const observedText = formatMarkdownForSpeech(message.sections.observed);
      if (observedText) {
        parts.push(`Observed: ${observedText}`);
      }
    }

    if (message.sections.interpretation && message.sections.interpretation.trim()) {
      const interpText = formatMarkdownForSpeech(message.sections.interpretation);
      if (interpText) {
        parts.push(`Interpretation: ${interpText}`);
      }
    }

    if (message.sections.actions && message.sections.actions.trim()) {
      const actionsText = formatMarkdownForSpeech(message.sections.actions);
      if (actionsText) {
        parts.push(`Recommended actions: ${actionsText}`);
      }
    }
  }

  return parts.join(" ");
}

/**
 * Splits long text into natural sentence-sized chunks (< 160 characters when possible).
 * This prevents the well-known Chrome/Edge SpeechSynthesis 15-second speech stall bug.
 */
export function splitSpeechChunks(text: string, maxChunkLength = 160): string[] {
  if (!text || text.trim().length === 0) return [];

  // Match sentences ending in ., !, or ?
  const sentenceRegex = /[^.!?]+[.!?]+|\s*[^.!?]+$/g;
  const rawSentences = text.match(sentenceRegex) || [text];

  const chunks: string[] = [];
  let currentChunk = "";

  for (const raw of rawSentences) {
    const sentence = raw.trim();
    if (!sentence) continue;

    if (!currentChunk) {
      currentChunk = sentence;
    } else if (currentChunk.length + sentence.length + 1 <= maxChunkLength) {
      currentChunk += " " + sentence;
    } else {
      chunks.push(currentChunk);
      currentChunk = sentence;
    }

    // If an individual sentence is longer than maxChunkLength, split by commas/semicolons
    if (currentChunk.length > maxChunkLength) {
      const subParts = currentChunk.split(/([,;:]\s+)/);
      let subAccum = "";
      for (const part of subParts) {
        if (!subAccum) {
          subAccum = part;
        } else if (subAccum.length + part.length <= maxChunkLength) {
          subAccum += part;
        } else {
          chunks.push(subAccum.trim());
          subAccum = part;
        }
      }
      currentChunk = subAccum;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter((c) => c.length > 0);
}
