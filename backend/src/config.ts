export interface AppConfig {
  port: number;
  translationProvider: string;
  deeplApiKey: string;
  deeplApiBaseUrl: string;
  deeplPollIntervalMs: number;
  deeplPollTimeoutMs: number;
  deeplHttpTimeoutMs: number;
  storageRoot: string;
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  return {
    port: Number(env.PORT || 3000),
    translationProvider: env.TRANSLATION_PROVIDER || "deepl",
    deeplApiKey: env.DEEPL_API_KEY || "",
    deeplApiBaseUrl: env.DEEPL_API_BASE_URL || "https://api-free.deepl.com",
    deeplPollIntervalMs: Number(env.DEEPL_POLL_INTERVAL_MS || 2000),
    deeplPollTimeoutMs: Number(env.DEEPL_POLL_TIMEOUT_MS || 300000),
    deeplHttpTimeoutMs: Number(env.DEEPL_HTTP_TIMEOUT_MS || 30000),
    storageRoot: env.STORAGE_ROOT || "storage"
  };
}

