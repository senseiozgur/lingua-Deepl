import express from "express";
import path from "path";
import { BillingStub } from "./billing/billing.stub";
import { JobRunner } from "./jobs/job.runner";
import { JobStore } from "./jobs/job.store";
import { createProvider } from "./providers/provider.factory";
import { createJobsRouter } from "./routes/jobs.routes";
import { LocalStorage } from "./storage/local.storage";
import { AppConfig } from "./config";

export function createApp(config: AppConfig) {
  const app = express();
  app.use(express.json());

  const jobs = new JobStore();
  const billing = new BillingStub();
  const provider = createProvider({
    provider: config.translationProvider,
    deeplApiKey: config.deeplApiKey,
    deeplApiBaseUrl: config.deeplApiBaseUrl,
    deeplPollIntervalMs: config.deeplPollIntervalMs,
    deeplPollTimeoutMs: config.deeplPollTimeoutMs,
    deeplHttpTimeoutMs: config.deeplHttpTimeoutMs
  });
  const storage = new LocalStorage(path.resolve(process.cwd(), config.storageRoot));
  const runner = new JobRunner(jobs, provider, billing, storage);

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use("/jobs", createJobsRouter({ jobs, runner, storage }));

  return app;
}
