import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

type Tx = Prisma.TransactionClient;

/**
 * Writes a verified payment into the finance ledger.
 *
 * Booking and ticket payments recorded by the team land here automatically,
 * so the books never depend on someone remembering to enter them twice.
 * Donations never come through this function — they are not income.
 */
export async function ledgerIncome(
  tx: Tx | typeof prisma,
  input: {
    amount: number;
    currency: string;
    division: 'TRAVEL' | 'EVENTS' | 'EXPERIENCES' | 'CATERING';
    category: string;
    relatedType: string;
    relatedId: string;
    relatedLabel: string;
    paymentMethod: string;
    reference?: string | null;
    counterparty: string;
    date: Date;
    bookingId?: string;
    registrationId?: string;
    paymentId?: string;
    actorId: string;
    notes?: string | null;
  },
) {
  return tx.financeTransaction.create({
    data: {
      type: 'INCOME',
      date: input.date,
      amount: input.amount,
      currency: input.currency,
      division: input.division,
      category: input.category,
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      relatedLabel: input.relatedLabel,
      paymentMethod: input.paymentMethod,
      reference: input.reference ?? null,
      counterparty: input.counterparty,
      notes: input.notes ?? null,
      status: 'VERIFIED',
      bookingId: input.bookingId ?? null,
      registrationId: input.registrationId ?? null,
      paymentId: input.paymentId ?? null,
      createdById: input.actorId,
      verifiedById: input.actorId,
      verifiedAt: new Date(),
    },
  });
}

export async function ledgerRefund(
  tx: Tx | typeof prisma,
  input: {
    amount: number;
    currency: string;
    division: string;
    relatedType: string;
    relatedId: string;
    relatedLabel: string;
    counterparty: string;
    reference?: string | null;
    paymentMethod?: string | null;
    bookingId?: string;
    registrationId?: string;
    actorId: string;
    notes?: string | null;
  },
) {
  return tx.financeTransaction.create({
    data: {
      type: 'REFUND',
      date: new Date(),
      amount: input.amount,
      currency: input.currency,
      division: input.division,
      category: 'REFUND',
      relatedType: input.relatedType,
      relatedId: input.relatedId,
      relatedLabel: input.relatedLabel,
      paymentMethod: input.paymentMethod ?? null,
      reference: input.reference ?? null,
      counterparty: input.counterparty,
      notes: input.notes ?? null,
      status: 'VERIFIED',
      bookingId: input.bookingId ?? null,
      registrationId: input.registrationId ?? null,
      createdById: input.actorId,
      verifiedById: input.actorId,
      verifiedAt: new Date(),
    },
  });
}

/** Sums rows by currency. Different currencies are never added together. */
export function byCurrency<T extends { currency: string; amount: number }>(rows: T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) out[row.currency] = (out[row.currency] ?? 0) + row.amount;
  return out;
}
