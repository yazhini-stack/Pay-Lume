import { EvidencePayload, ExtractedContext, EvidenceType } from "./evidence";
import { Conversation, Message, RAGStatus, MessageSection, Citation } from "./chat";

export interface EvidenceUploadResponse {
  evidenceId: string;
  type: EvidenceType;
  previewUrl?: string;
  evidence: EvidencePayload;
  extracted: ExtractedContext;
}

export interface EvidenceUrlRequest {
  url: string;
}

export interface CreateConversationRequest {
  evidenceId: string;
  evidencePayload?: EvidencePayload;
  title?: string;
}

export interface CreateConversationResponse {
  conversationId: string;
  conversation: Conversation;
}

export interface PostMessageRequest {
  question: string;
}

export type SSEEvent = 
  | { type: 'status'; data: { step: RAGStatus; message: string } }
  | { type: 'token'; data: { delta: string; section?: MessageSection } }
  | { type: 'citation'; data: Citation }
  | { type: 'evidence'; data: string[] }
  | { type: 'done'; data: { messageId: string; message?: Message } }
  | { type: 'error'; data: { message: string; code?: string } };
