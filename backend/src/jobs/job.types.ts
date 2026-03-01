export type JobStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";

export interface JobBillingSummary {
  request_id: string | null;
  billing_request_id: string | null;
  charged_units: number;
  charged: boolean;
  refunded: boolean;
}

export interface JobRecord {
  id: string;
  status: JobStatus;
  progress_pct: number;
  input_file_path: string;
  output_file_path: string | null;
  file_name: string;
  source_lang: string | null;
  target_lang: string;
  error_code: string | null;
  billing: JobBillingSummary;
}

