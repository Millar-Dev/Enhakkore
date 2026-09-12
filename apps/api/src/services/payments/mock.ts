import type { PaymentMethod } from '@enhakkore/shared';
import { paymentReference } from '../../lib/ids';
import type { ChargeRequest, ChargeResult, PaymentGateway, RefundRequest, RefundResult } from './types';

/**
 * In-process payment simulator for development and demos.
 *
 * NO REAL PAYMENT PROVIDER IS CONNECTED IN THIS BUILD. Nothing here talks to
 * M-Pesa, Airtel Money, Tigo Pesa, a card network or a bank. Every result it
 * returns is flagged `simulated: true` and stored that way, so a demo booking
 * can never be mistaken for a settled transaction.
 *
 * Failure paths are simulated deliberately: an amount ending in 13 fails, which
 * makes the "payment failed" UI reachable without a live sandbox.
 */
export class MockPaymentGateway implements PaymentGateway {
  readonly name = 'mock';
  readonly supports: PaymentMethod[] = ['MOCK', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER'];
  readonly isLive = false;

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    await delay(400);

    const providerRef = paymentReference('SIM');
    const forcedFailure = request.amount % 100 === 13;

    if (forcedFailure) {
      return {
        status: 'FAILED',
        providerRef,
        simulated: true,
        failureCode: 'INSUFFICIENT_FUNDS',
        message: 'The simulated payment was declined (insufficient funds).',
        raw: { simulated: true, bookingRef: request.reference, declinedAt: new Date().toISOString() },
      };
    }

    // Bank transfers are asynchronous everywhere in the real world, so the mock
    // mirrors that: the booking stays awaiting-payment until confirmation.
    if (request.method === 'BANK_TRANSFER') {
      return {
        status: 'PENDING',
        providerRef,
        simulated: true,
        message: 'Simulated bank transfer initiated. Awaiting confirmation.',
        raw: { simulated: true, bookingRef: request.reference, expectedWithinHours: 24 },
      };
    }

    return {
      status: 'SUCCEEDED',
      providerRef,
      simulated: true,
      message: 'Simulated payment approved.',
      raw: {
        simulated: true,
        bookingRef: request.reference,
        method: request.method,
        instrument: request.instrument ? maskInstrument(request.instrument) : null,
        settledAt: new Date().toISOString(),
      },
    };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    await delay(250);
    return {
      status: 'REFUNDED',
      providerRef: request.providerRef,
      simulated: true,
      message: 'Simulated refund issued.',
    };
  }
}

/** Keeps only the last four characters of a phone number or card token. */
function maskInstrument(value: string): string {
  const tail = value.slice(-4);
  return `${'•'.repeat(Math.max(0, value.length - 4))}${tail}`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
