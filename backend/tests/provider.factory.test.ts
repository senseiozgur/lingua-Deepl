import { createProvider } from "../src/providers/provider.factory";
import { DeepLProvider } from "../src/providers/deepl.provider";

describe("provider factory", () => {
  it("selects deepl by env-like config", () => {
    const provider = createProvider({
      provider: "deepl",
      deeplApiKey: "test-key",
      deeplApiBaseUrl: "https://api-free.deepl.com",
      deeplPollIntervalMs: 1,
      deeplPollTimeoutMs: 100,
      deeplHttpTimeoutMs: 100
    });

    expect(provider).toBeInstanceOf(DeepLProvider);
  });
});

