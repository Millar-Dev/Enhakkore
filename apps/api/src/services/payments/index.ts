import { env } from '../../env';
import { MockPaymentGateway } from './mock';
import type { PaymentGateway } from './types';

export * from './types';

/**
 * Gateway registry. Exactly one gateway is registered today — the simulator.
 *
 * To connect a real rail:
 *   1. Implement PaymentGateway in ./providers/<name>.ts
 *   2. Register it below
 *   3. Set PAYMENT_PROVIDER=<name> in the environment
 *
 * Until that happens, `gateway.isLive` is false everywhere and the API surfaces
 * that fact to the client so the checkout can label itself honestly.
 */
const registry: Record<string, () => PaymentGateway> = {
  mock: () => new MockPaymentGateway(),
};

let cached: PaymentGateway | null = null;

export function paymentGateway(): PaymentGateway {
  if (cached) return cached;
  const factory = registry[env.paymentProvider];
  if (!factory) {
    const available = Object.keys(registry).join(', ');
    throw new Error(`Unknown PAYMENT_PROVIDER "${env.paymentProvider}". Available: ${available}`);
  }
  cached = factory();
  return cached;
}
