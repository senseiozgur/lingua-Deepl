export type ProviderErrorCode =
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_QUOTA_EXCEEDED"
  | "PROVIDER_UPSTREAM_5XX"
  | "PROVIDER_UNKNOWN";

export interface NormalizedProviderError {
  code: ProviderErrorCode;
  http_status?: number;
  retryable?: boolean;
}

export interface TranslateDocumentInput {
  fileBuffer: Buffer;
  fileName: string;
  sourceLang?: string;
  targetLang: string;
}

export interface TranslateDocumentOutput {
  outputBuffer: Buffer;
}

export interface TranslationProvider {
  translateDocument(input: TranslateDocumentInput): Promise<TranslateDocumentOutput>;
  translateText(_text: string, _opts?: Record<string, unknown>): Promise<string>;
  detectLanguage(_text: string): Promise<string>;
  getUsage(): Promise<Record<string, unknown>>;
  normalizeError(err: unknown): NormalizedProviderError;
}

export class ProviderExecutionError extends Error {
  readonly normalized: NormalizedProviderError;

  constructor(normalized: NormalizedProviderError) {
    super(normalized.code);
    this.normalized = normalized;
  }
}

