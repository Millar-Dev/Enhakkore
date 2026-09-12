'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CustomTripRequestDto, Paginated } from '@enhakkore/shared';
import { TRAVEL_STYLE_LABELS } from '@enhakkore/shared';
import { DashboardShell, ADMIN_NAV } from '@/components/layout/DashboardShell';
import { Alert, Badge, Button, Card, EmptyState, Icon, Skeleton, cx } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { dateRange, formatDate, price } from '@/lib/format';

const FILTERS = [
  { id: 'NEW', label: 'New' },
  { id: 'all', label: 'All' },
  { id: 'MATCHING', label: 'Matching' },
  { id: 'QUOTED', label: 'Quoted' },
  { id: 'CONVERTED', label: 'Converted' },
  { id: 'CLOSED', label: 'Closed' },
];

const NEXT_STATUS: Record<string, { label: string; value: string }[]> = {
  NEW: [{ label: 'Start matching', value: 'MATCHING' }],
  MATCHING: [{ label: 'Mark quoted', value: 'QUOTED' }],
  QUOTED: [
    { label: 'Mark converted', value: 'CONVERTED' },
    { label: 'Close', value: 'CLOSED' },
  ],
};

export default function AdminRequestsPage() {
  const [status, setStatus] = useState('NEW');
  const [requests, setRequests] = useState<CustomTripRequestDto[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRequests(null);
    try {
      const result = await api.get<Paginated<CustomTripRequestDto>>(
        `/admin/requests?status=${status}&pageSize=50`,
      );
      setRequests(result.items);
    } catch {
      setRequests([]);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function move(request: CustomTripRequestDto, next: string) {
    setBusyId(request.id);
    setError(null);
    try {
      await api.post(`/admin/requests/${request.id}/status`, { status: next });
      setNotice(`Request moved to ${next.toLowerCase()}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'We could not update that request.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardShell nav={ADMIN_NAV} allow={['ADMIN']} title="Custom trip requests" wide>
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

      <Alert tone="neutral" className="mb-6">
        Matching is manual today: read the request, pick verified operators who run that route, and put them
        in touch. The data model already supports routing one request to several operators and collecting
        competing quotes when that flow is built.
      </Alert>

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

      {requests === null ? (
        <div className="space-y-4">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-44 w-full" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<Icon.compass size={34} />}
          title={status === 'NEW' ? 'No new requests' : 'Nothing here'}
          description="Requests from the private trips form land here as soon as they are submitted."
        />
      ) : (
        <div className="space-y-5">
          {requests.map((request) => (
            <Card key={request.id} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        request.status === 'NEW'
                          ? 'warning'
                          : request.status === 'CONVERTED'
                            ? 'success'
                            : 'neutral'
                      }
                    >
                      {request.status.toLowerCase()}
                    </Badge>
                    <Badge tone="neutral">{TRAVEL_STYLE_LABELS[request.style]}</Badge>
                  </div>

                  <h2 className="mt-2.5 text-h3">{request.destination}</h2>

                  <p className="mt-1.5 text-[0.875rem] text-ink-muted">
                    {request.travellers} {request.travellers === 1 ? 'traveller' : 'travellers'}
                    {request.startDate && request.endDate && (
                      <> · {dateRange(request.startDate, request.endDate)}</>
                    )}
                    {request.budget && <> · budget {price(request.budget)} per person</>}
                  </p>

                  <p className="mt-1 text-[0.8125rem] text-ink-muted">
                    {request.contactName} ·{' '}
                    <a href={`mailto:${request.contactEmail}`} className="hover:text-acacia-700">
                      {request.contactEmail}
                    </a>{' '}
                    · received {formatDate(request.createdAt, 'long')}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {(NEXT_STATUS[request.status] ?? []).map((action) => (
                    <Button
                      key={action.value}
                      size="sm"
                      variant={action.value === 'CLOSED' ? 'secondary' : 'primary'}
                      onClick={() => move(request, action.value)}
                      disabled={busyId === request.id}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>

              {request.accommodation && (
                <p className="mt-4 text-[0.875rem] text-ink-soft">
                  <span className="font-semibold">Accommodation:</span> {request.accommodation}
                </p>
              )}

              {request.activities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {request.activities.map((activity) => (
                    <Badge key={activity} tone="neutral">
                      {activity}
                    </Badge>
                  ))}
                </div>
              )}

              {request.notes && (
                <p className="mt-4 rounded-[--radius-field] bg-sand px-4 py-3 text-[0.875rem] leading-relaxed text-ink-soft">
                  {request.notes}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
