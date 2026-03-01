export interface BillingChargeInput {
  request_id: string;
  job_id: string;
  units: number;
}

export interface BillingChargeResult {
  billing_request_id: string;
  charged_units: number;
  already_charged: boolean;
}

export interface BillingRefundInput {
  request_id: string;
  job_id: string;
  billing_request_id?: string;
  reason: string;
}

export interface BillingRefundResult {
  refund_id: string;
  refunded: boolean;
}

export interface BillingAdapter {
  charge(input: BillingChargeInput): Promise<BillingChargeResult>;
  refund(input: BillingRefundInput): Promise<BillingRefundResult>;
}

