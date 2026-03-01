import {
  NormalizedProviderError,
  ProviderExecutionError,
  TranslationProvider,
  TranslateDocumentInput,
  TranslateDocumentOutput
} from "./provider.interface";

type FetchFn = typeof fetch;

interface DeepLProviderConfig {
  apiKey: string;
  baseUrl: string;
  pollIntervalMs: number;
  pollTimeoutMs: number;
  httpTimeoutMs: number;
  fetchFn?: FetchFn;
}

interface DeepLUploadResponse {
  document_id: string;
  document_key: string;
}

interface DeepLStatusResponse {
  status: "queued" | "translating" | "done" | "error";
}

class DeepLHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`DEEPL_HTTP_${status}`);
    this.status = status;
  }
}

export class DeepLProvider implements TranslationProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly pollTimeoutMs: number;
  private readonly httpTimeoutMs: number;
  private readonly fetchFn: FetchFn;

  constructor(config: DeepLProviderConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.pollIntervalMs = config.pollIntervalMs;
    this.pollTimeoutMs = config.pollTimeoutMs;
    this.httpTimeoutMs = config.httpTimeoutMs;
    this.fetchFn = config.fetchFn || fetch;
  }

  async translateDocument(input: TranslateDocumentInput): Promise<TranslateDocumentOutput> {
    const uploaded = await this.uploadDocument(input);
    await this.pollUntilDone(uploaded.document_id, uploaded.document_key);
    const outputBuffer = await this.downloadDocument(uploaded.document_id, uploaded.document_key);
    return { outputBuffer };
  }

  async translateText(_text: string): Promise<string> {
    throw new Error("Not implemented in MVP");
  }

  async detectLanguage(_text: string): Promise<string> {
    throw new Error("Not implemented in MVP");
  }

  async getUsage(): Promise<Record<string, unknown>> {
    return {};
  }

  normalizeError(err: unknown): NormalizedProviderError {
    if (err instanceof ProviderExecutionError) {
      return err.normalized;
    }

    if (err instanceof DeepLHttpError) {
      if (err.status === 429) {
        return { code: "PROVIDER_RATE_LIMIT", http_status: 429, retryable: true };
      }
      if (err.status === 456) {
        return { code: "PROVIDER_QUOTA_EXCEEDED", http_status: 456, retryable: false };
      }
      if (err.status >= 500) {
        return { code: "PROVIDER_UPSTREAM_5XX", http_status: err.status, retryable: true };
      }
      return { code: "PROVIDER_UNKNOWN", http_status: err.status, retryable: false };
    }

    if (err instanceof Error && err.name === "AbortError") {
      return { code: "PROVIDER_TIMEOUT", retryable: true };
    }

    return { code: "PROVIDER_UNKNOWN", retryable: false };
  }

  private async uploadDocument(input: TranslateDocumentInput): Promise<DeepLUploadResponse> {
    const formData = new FormData();
    formData.set("file", new Blob([new Uint8Array(input.fileBuffer)]), input.fileName);
    formData.set("target_lang", input.targetLang);
    if (input.sourceLang) {
      formData.set("source_lang", input.sourceLang);
    }

    const response = await this.callWithTimeout(`${this.baseUrl}/v2/document`, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${this.apiKey}` },
      body: formData
    });

    if (!response.ok) {
      throw new DeepLHttpError(response.status);
    }

    const payload = (await response.json()) as DeepLUploadResponse;
    return payload;
  }

  private async pollUntilDone(documentId: string, documentKey: string): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < this.pollTimeoutMs) {
      const formData = new URLSearchParams();
      formData.set("document_key", documentKey);
      const response = await this.callWithTimeout(`${this.baseUrl}/v2/document/${documentId}`, {
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${this.apiKey}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formData
      });

      if (!response.ok) {
        throw new DeepLHttpError(response.status);
      }

      const status = (await response.json()) as DeepLStatusResponse;
      if (status.status === "done") {
        return;
      }
      if (status.status === "error") {
        throw new ProviderExecutionError({ code: "PROVIDER_UNKNOWN", retryable: false });
      }
      await this.delay(this.pollIntervalMs);
    }

    throw new ProviderExecutionError({ code: "PROVIDER_TIMEOUT", retryable: true });
  }

  private async downloadDocument(documentId: string, documentKey: string): Promise<Buffer> {
    const formData = new URLSearchParams();
    formData.set("document_key", documentKey);
    const response = await this.callWithTimeout(`${this.baseUrl}/v2/document/${documentId}/result`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${this.apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData
    });

    if (!response.ok) {
      throw new DeepLHttpError(response.status);
    }

    const output = await response.arrayBuffer();
    return Buffer.from(output);
  }

  private async callWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.httpTimeoutMs);
    try {
      return await this.fetchFn(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
