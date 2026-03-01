import { DeepLProvider } from "./deepl.provider";
import { TranslationProvider } from "./provider.interface";

export interface ProviderFactoryConfig {
  provider: string;
  deeplApiKey: string;
  deeplApiBaseUrl: string;
  deeplPollIntervalMs: number;
  deeplPollTimeoutMs: number;
  deeplHttpTimeoutMs: number;
}

export function createProvider(config: ProviderFactoryConfig): TranslationProvider {
  const provider = (config.provider || "deepl").toLowerCase();
  if (provider === "deepl") {
    return new DeepLProvider({
      apiKey: config.deeplApiKey,
      baseUrl: config.deeplApiBaseUrl,
      pollIntervalMs: config.deeplPollIntervalMs,
      pollTimeoutMs: config.deeplPollTimeoutMs,
      httpTimeoutMs: config.deeplHttpTimeoutMs
    });
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

