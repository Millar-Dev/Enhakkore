'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { BookingDto, Paginated } from '@enhakkore/shared';
import { BOOKING_STATUS_LABELS } from '@enhakkore/shared';
import { DashboardShell, ADMIN_NAV } from '@/components/layout/DashboardShell';
import { Alert, Badge, Button, Card, EmptyState, Icon, Skeleton, cx } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { dateRange, formatDate, price } from '@/lib/format';

interface AdminBooking extends BookingDto {
  traveller: { name: string; email: string };
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'PENDING_PAYMENT', label: 'Awaiting payment' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'CANCELLED', label: 'Cancelled' },
  { id: 'REFUNDED', label: 'Refunded' },
];

export default function AdminBookingsPage() {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [bookings, setBookings] = useState<AdminBooking[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBookings(null);
    try {
      const result = await api.get<Paginated<AdminBooking>>(
        `/admin/bookings?status=${status}&q=${encodeURIComponent(search)}&pageSize=50`,
      );
      setBookings(result.items);
    } catch {
      setBookings([]);
    }
  }, [status, search]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  async function refund(booking: AdminBooking) {
    const reason = window.prompt(
      `Refund ${booking.reference} (${price(booking.totalAmount)})?\n\nThis releases the seats and reverses the commission. Give a reason — the traveller is notified.`,
    );
    if (!reason) return;

    setBusyId(booking.id);
    setError(null);
    setNotice(null);
    try {
      const result = await api.post<{ simulated: boolean }>(`/admin/bookings/${booking.id}/refund`, {
        reason,
      });
      setNotice(
        result.simulated
          ? `${booking.reference} refunded. This was a simulated reversal — no money moved.`
          : `${booking.reference} refunded.`,
      );
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That refund could not be processed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardShell nav={ADMIN_NAV} allow={['ADMIN']} title="Bookings" wide>
      {notice && (
        <Alert tone="success" className="mb-6">
          {notice}
        </Alert>
      )}
      {error && (
        <Alert tone="danger" className="mb-6" role="alert">
          {error}
        </Alert>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Icon.search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by reference…"
            aria-label="Search bookings by reference"
            className="h-11 w-full rounded-[--radius-field] border border-line-strong pl-10 pr-3.5 text-[0.875rem] focus:border-acacia-600 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatus(filter.id)}
              aria-pressed={status === filter.id}
              className={cx(
                'h-11 shrink-0 rounded-[--radius-pill] border px-4 text-[0.8125rem] font-semibold transition-all',
                status === filter.id
                  ? 'border-ink bg-ink text-white'
                  : 'border-line-strong bg-white text-ink-soft hover:border-ink',
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {bookings === null ? (
        <Skeleton className="h-96 w-full" />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={<Icon.ticket size={34} />}
          title="No bookings match"
          description="Try another status, or clear the search."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] text-left text-[0.875rem]">
              <thead className="border-b border-line bg-sand/50">
                <tr>
                  {['Reference', 'Traveller', 'Trip', 'Departure', 'Booked', 'Status', 'Total', ''].map(
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
                {bookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-line last:border-0">
                    <td className="whitespace-nowrap px-5 py-4">
                      <Link
                        href={`/account/bookings/${booking.reference}`}
                        className="font-mono text-[0.8125rem] hover:text-acacia-700"
                      >
                        {booking.reference}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium">{booking.traveller.name}</p>
                      <p className="text-[0.75rem] text-ink-muted">{booking.traveller.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium">{booking.trip.title}</p>
                      <p className="text-[0.75rem] text-ink-muted">
                        {booking.trip.organizer.companyName}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-ink-muted">
                      {dateRange(booking.departure.startDate, booking.departure.endDate)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-ink-muted">
                      {formatDate(booking.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <Badge
                        tone={
                          booking.status === 'CONFIRMED'
                            ? 'success'
                            : booking.status === 'COMPLETED'
                              ? 'brand'
                              : booking.status === 'PENDING_PAYMENT'
                                ? 'warning'
                                : 'danger'
                        }
                      >
                        {BOOKING_STATUS_LABELS[booking.status]}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <p className="font-semibold tabular-nums">{price(booking.totalAmount)}</p>
                      <p className="text-[0.75rem] text-ink-muted">
                        fee {price(booking.platformFee)}
                        {booking.impactAmount.amount > 0 && (
                          <span className="text-clay-600"> · +{price(booking.impactAmount)}</span>
                        )}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      {(booking.status === 'CONFIRMED' || booking.status === 'PENDING_PAYMENT') && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => refund(booking)}
                          disabled={busyId === booking.id}
                        >
                          Refund
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </DashboardShell>
  );
}
