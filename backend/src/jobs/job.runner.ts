import crypto from "crypto";
import { BillingAdapter } from "../billing/billing.adapter";
import { TranslationProvider } from "../providers/provider.interface";
import { LocalStorage } from "../storage/local.storage";
import { JobStore } from "./job.store";
import { JobRecord } from "./job.types";

export class JobRunner {
  constructor(
    private readonly jobs: JobStore,
    private readonly provider: TranslationProvider,
    private readonly billing: BillingAdapter,
    private readonly storage: LocalStorage
  ) {}

  runAsync(jobId: string): void {
    void this.run(jobId);
  }

  async run(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "PENDING") {
      return;
    }

    const requestId = crypto.randomUUID();
    this.persist(job.id, {
      status: "PROCESSING",
      progress_pct: 5,
      error_code: null,
      billing: { ...job.billing, request_id: requestId }
    });

    let charged = false;
    let billingRequestId: string | undefined;
    try {
      const charge = await this.billing.charge({
        request_id: requestId,
        job_id: job.id,
        units: 1
      });
      charged = true;
      billingRequestId = charge.billing_request_id;
      this.persist(job.id, {
        progress_pct: 15,
        billing: {
          ...this.ensureJob(jobId).billing,
          billing_request_id: charge.billing_request_id,
          charged_units: charge.charged_units,
          charged: true
        }
      });

      const sourceBuffer = await this.storage.readFile(job.input_file_path);
      const translated = await this.provider.translateDocument({
        fileBuffer: sourceBuffer,
        fileName: job.file_name,
        sourceLang: job.source_lang || undefined,
        targetLang: job.target_lang
      });

      const outputPath = await this.storage.saveOutput(job.id, translated.outputBuffer);
      this.persist(job.id, {
        status: "READY",
        progress_pct: 100,
        output_file_path: outputPath
      });
    } catch (err) {
      const normalized = this.provider.normalizeError(err);
      if (charged) {
        await this.billing.refund({
          request_id: requestId,
          job_id: job.id,
          billing_request_id: billingRequestId,
          reason: normalized.code
        });
        this.persist(job.id, {
          billing: { ...this.ensureJob(jobId).billing, refunded: true }
        });
      }

      this.persist(job.id, {
        status: "FAILED",
        progress_pct: 100,
        error_code: normalized.code
      });
    }
  }

  private persist(jobId: string, patch: Partial<JobRecord>): void {
    const updated = this.jobs.update(jobId, patch);
    if (!updated) {
      throw new Error("Job not found");
    }
  }

  private ensureJob(jobId: string): JobRecord {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }
    return job;
  }
}

