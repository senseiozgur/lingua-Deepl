import crypto from "crypto";
import {
  BillingAdapter,
  BillingChargeInput,
  BillingChargeResult,
  BillingRefundInput,
  BillingRefundResult
} from "./billing.adapter";

export class BillingStub implements BillingAdapter {
  private readonly charges = new Map<string, BillingChargeResult>();
  private readonly refunds = new Map<string, BillingRefundResult>();

  async charge(input: BillingChargeInput): Promise<BillingChargeResult> {
    const existing = this.charges.get(input.request_id);
    if (existing) {
      return { ...existing, already_charged: true };
    }

    const billingRequestId = `bill_${input.request_id}`;
    const result: BillingChargeResult = {
      billing_request_id: billingRequestId,
      charged_units: input.units,
      already_charged: false
    };
    this.charges.set(input.request_id, result);
    return result;
  }

  async refund(input: BillingRefundInput): Promise<BillingRefundResult> {
    const refundRequestId = `refund_${input.request_id}`;
    const existing = this.refunds.get(refundRequestId);
    if (existing) {
      return existing;
    }

    const result: BillingRefundResult = {
      refund_id: crypto.createHash("sha1").update(refundRequestId).digest("hex"),
      refunded: true
    };
    this.refunds.set(refundRequestId, result);
    return result;
  }
}

