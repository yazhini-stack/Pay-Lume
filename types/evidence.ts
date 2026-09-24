export type EvidenceType = 'screenshot' | 'qr' | 'url' | 'message';

export interface QRDecodedPayload {
  rawPayload: string;
  protocol?: string;
  payeeName?: string;
  vpaOrAccount?: string;
  amount?: string;
  category?: string;
  parsedFields: Record<string, string>;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
}

export interface SensitiveDataWarning {
  hasOtp?: boolean;
  hasCvv?: boolean;
  hasPassword?: boolean;
  hasCardNumber?: boolean;
  warningMessage?: string;
}

export interface PaymentFields {
  payee?: string;
  amount?: string;
  currency?: string;
  accountOrVpa?: string;
  urgencyPhrases?: string[];
  bankOrGateway?: string;
  refNumber?: string;
}

export interface ExtractedContext {
  ocrText?: string;
  detectedUrls?: string[];
  paymentFields?: PaymentFields;
  sensitiveDataDetected?: SensitiveDataWarning;
  extractionConfidence?: number;
  domainMetadata?: {
    domain: string;
    isHttps: boolean;
    creationAge?: string;
    registrar?: string;
    reputationScore?: string;
  };
  timestamp: string;
}

export interface EvidencePayload {
  id: string;
  type: EvidenceType;
  title: string;
  previewUrl?: string;
  rawText?: string;
  url?: string;
  qrDecoded?: QRDecodedPayload;
  fileMeta?: FileMetadata;
  extractedContext?: ExtractedContext;
  rawFile?: File;
  createdAt: string;
}
