import { EvidencePayload } from "./evidence";

export type MessageSection = 'observed' | 'interpretation' | 'actions';

export type RAGStatus = 'idle' | 'extracting' | 'retrieving' | 'reranking' | 'generating';

export interface Citation {
  id: number;
  title: string;
  source: string;
  url: string;
  snippet: string;
}

export interface StructuredAnswer {
  observed: string;
  interpretation: string;
  actions: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content?: string;
  sections?: Partial<StructuredAnswer>;
  citations?: Citation[];
  createdAt: string;
  status?: RAGStatus;
}

export interface Conversation {
  id: string;
  title: string;
  evidence: EvidencePayload;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}
