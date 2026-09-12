import type { PaymentMethod, PaymentStatus } from '@enhakkore/shared';

export interface ChargeRequest {
  bookingId: string;
  reference: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  /** Mobile-money MSISDN or card token handle — never raw card data. */
  instrument?: string;
  customer: { id: string; name: string; email: string };
  metadata?: Record<string, string>;
}

export interface ChargeResult {
  status: PaymentStatus;
  providerRef: string;
  /** True when no real money moved. Persisted so support can tell them apart. */
  simulated: boolean;
  failureCode?: string;
  message: string;
  /** Redacted provider payload kept for reconciliation. */
  raw: Record<string, unknown>;
}

export interface RefundRequest {
  providerRef: string;
  amount: number;
  currency: string;
  reason?: string;
}

export interface RefundResult {
  status: PaymentStatus;
  providerRef: string;
  simulated: boolean;
  message: string;
}

/**
 * The seam every payment rail plugs into. Adding M-Pesa, Airtel Money, Tigo Pesa,
 * Stripe or a bank transfer means writing one of these and registering it in
 * ./index.ts — no route, service or UI code changes.
 */
export interface PaymentGateway {
  readonly name: string;
  /** Methods this gateway can actually process right now. */
  readonly supports: PaymentMethod[];
  /** False for every gateway that does not move real money. */
  readonly isLive: boolean;
  charge(request: ChargeRequest): Promise<ChargeResult>;
  refund(request: RefundRequest): Promise<RefundResult>;
}
