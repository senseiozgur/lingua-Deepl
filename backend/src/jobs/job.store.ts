import crypto from "crypto";
import { JobRecord } from "./job.types";

export class JobStore {
  private readonly jobs = new Map<string, JobRecord>();

  create(input: Omit<JobRecord, "id">): JobRecord {
    const id = crypto.randomUUID();
    const record: JobRecord = { id, ...input };
    this.jobs.set(id, record);
    return record;
  }

  get(id: string): JobRecord | undefined {
    return this.jobs.get(id);
  }

  update(id: string, patch: Partial<JobRecord>): JobRecord | undefined {
    const existing = this.jobs.get(id);
    if (!existing) {
      return undefined;
    }

    const next = { ...existing, ...patch };
    this.jobs.set(id, next);
    return next;
  }
}

