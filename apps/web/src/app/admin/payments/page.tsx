'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Money } from '@enhakkore/shared';
import { DashboardShell, ADMIN_NAV } from '@/components/layout/DashboardShell';
import { Alert, Badge, Card, EmptyState, Icon, Skeleton, StatTile, cx } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, price } from '@/lib/format';

interface PaymentRow {
  id: string;
  reference: string | null;
  tripTitle: string | null;
  method: string;
  provider: string;
  providerRef: string | null;
  status: string;
  amount: Money;
  simulated: boolean;
  failureCode: string | null;
  createdAt: string;
}

interface PaymentResponse {
  items: PaymentRow[];
  total: number;
  commissionEarned: Money;
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'SUCCEEDED', label: 'Succeeded' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'FAILED', label: 'Failed' },
  { id: 'REFUNDED', label: 'Refunded' },
];

function PaymentsTable() {
  const params = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? 'all');
  const [data, setData] = useState<PaymentResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    (async () => {
      try {
        const result = await api.get<PaymentResponse>(`/admin/payments?status=${status}&pageSize=50`);
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setData({ items: [], total: 0, commissionEarned: { amount: 0, currency: 'TZS' } });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const settled = (data?.items ?? []).filter((row) => row.status === 'SUCCEEDED');
  const simulatedCount = (data?.items ?? []).filter((row) => row.simulated).length;
  const gross = settled.reduce((sum, row) => sum + row.amount.amount, 0);

  return (
    <>
      {/* The single most important thing an admin needs to know here. */}
      {simulatedCount > 0 && (
        <Alert tone="neutral" className="mb-6" title="No payment provider is connected">
          {simulatedCount} of the transactions below were settled by the in-process simulator, not a real
          payment rail. Nothing on this page represents money that has actually moved. Connecting a
          provider means adding an adapter in <code className="font-mono text-[0.8125rem]">apps/api/src/services/payments</code>{' '}
          and setting <code className="font-mono text-[0.8125rem]">PAYMENT_PROVIDER</code>.
        </Alert>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Transactions" value={data?.total ?? '—'} />
        <StatTile
          label="Settled value"
          value={data ? price({ amount: gross, currency: 'TZS' }, true) : '—'}
        />
        <StatTile
          label="Commission earned"
          value={data ? price(data.commissionEarned, true) : '—'}
          tone="brand"
        />
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setStatus(filter.id)}
            aria-pressed={status === filter.id}
            className={cx(
              'h-10 shrink-0 rounded-[--radius-pill] border px-4 text-[0.8125rem] font-semibold transition-all',
              status === filter.id
                ? 'border-ink bg-ink text-white'
                : 'border-line-strong bg-white text-ink-soft hover:border-ink',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {data === null ? (
        <Skeleton className="h-96 w-full" />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<Icon.ticket size={34} />}
          title="No transactions match"
          description="Try another status filter."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] text-left text-[0.875rem]">
              <thead className="border-b border-line bg-sand/50">
                <tr>
                  {['Date', 'Booking', 'Trip', 'Method', 'Provider ref', 'Status', 'Amount'].map(
                    (heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-5 py-3 text-[0.75rem] font-semibold text-ink-muted"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-5 py-4 text-ink-muted">
                      {formatDate(row.createdAt, 'long')}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-[0.8125rem]">
                      {row.reference ?? '—'}
                    </td>
                    <td className="px-5 py-4">{row.tripTitle ?? '—'}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-ink-muted">
                      {row.method.replace('_', ' ').toLowerCase()}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="font-mono text-[0.75rem] text-ink-muted">
                        {row.providerRef ?? '—'}
                      </span>
                      {row.simulated && (
                        <Badge tone="neutral" className="ml-2">
                          simulated
                        </Badge>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        tone={
                          row.status === 'SUCCEEDED'
                            ? 'success'
                            : row.status === 'PENDING'
                              ? 'warning'
                              : row.status === 'REFUNDED'
                                ? 'neutral'
                                : 'danger'
                        }
                      >
                        {row.status.toLowerCase()}
                      </Badge>
                      {row.failureCode && (
                        <p className="mt-1 text-[0.75rem] text-danger">{row.failureCode}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold tabular-nums">
                      {price(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

export default function AdminPaymentsPage() {
  return (
    <DashboardShell nav={ADMIN_NAV} allow={['ADMIN']} title="Payments" wide>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <PaymentsTable />
      </Suspense>
    </DashboardShell>
  );
}
