'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Paginated, PublicUser } from '@enhakkore/shared';
import { DashboardShell, ADMIN_NAV } from '@/components/layout/DashboardShell';
import { Alert, Avatar, Badge, Button, Card, EmptyState, Icon, Skeleton, cx } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useSession } from '@/lib/session';

interface AdminUser extends PublicUser {
  bookingCount: number;
}

const ROLES = [
  { id: 'all', label: 'All' },
  { id: 'TRAVELER', label: 'Travellers' },
  { id: 'ORGANIZER', label: 'Operators' },
  { id: 'ADMIN', label: 'Admins' },
];

export default function AdminUsersPage() {
  const { user: me } = useSession();
  const [role, setRole] = useState('all');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setUsers(null);
    try {
      const result = await api.get<Paginated<AdminUser>>(
        `/admin/users?role=${role}&q=${encodeURIComponent(search)}&pageSize=50`,
      );
      setUsers(result.items);
    } catch {
      setUsers([]);
    }
  }, [role, search]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  async function setStatus(user: AdminUser, status: 'ACTIVE' | 'SUSPENDED') {
    if (status === 'SUSPENDED') {
      const confirmed = window.confirm(
        `Suspend ${user.name}?\n\nThey lose access immediately. If they are an operator, their live listings are unpublished too.`,
      );
      if (!confirmed) return;
    }

    setBusyId(user.id);
    setError(null);
    setNotice(null);
    try {
      await api.post(`/admin/users/${user.id}/status`, { status });
      setNotice(`${user.name} is now ${status.toLowerCase()}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That change could not be saved.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardShell nav={ADMIN_NAV} allow={['ADMIN']} title="Users" wide>
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
            placeholder="Search name or email…"
            aria-label="Search users"
            className="h-11 w-full rounded-[--radius-field] border border-line-strong pl-10 pr-3.5 text-[0.875rem] focus:border-acacia-600 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {ROLES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRole(item.id)}
              aria-pressed={role === item.id}
              className={cx(
                'h-11 shrink-0 rounded-[--radius-pill] border px-4 text-[0.8125rem] font-semibold transition-all',
                role === item.id
                  ? 'border-ink bg-ink text-white'
                  : 'border-line-strong bg-white text-ink-soft hover:border-ink',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {users === null ? (
        <Skeleton className="h-96 w-full" />
      ) : users.length === 0 ? (
        <EmptyState icon={<Icon.users size={34} />} title="No users match" description="Try another filter." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-[0.875rem]">
              <thead className="border-b border-line bg-sand/50">
                <tr>
                  {['User', 'Role', 'Location', 'Bookings', 'Joined', 'Status', ''].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-5 py-3 text-[0.75rem] font-semibold text-ink-muted"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} src={user.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium">{user.name}</p>
                          <p className="truncate text-[0.75rem] text-ink-muted">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={user.role === 'ADMIN' ? 'dark' : user.role === 'ORGANIZER' ? 'brand' : 'neutral'}>
                        {user.role.toLowerCase()}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-ink-muted">
                      {[user.city, user.country].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-5 py-4 tabular-nums">{user.bookingCount}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-ink-muted">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={user.status === 'ACTIVE' ? 'success' : 'danger'}>
                        {user.status.toLowerCase()}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      {user.id === me?.id ? (
                        <span className="text-[0.75rem] text-ink-faint">You</span>
                      ) : user.status === 'ACTIVE' ? (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setStatus(user, 'SUSPENDED')}
                          disabled={busyId === user.id}
                        >
                          Suspend
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setStatus(user, 'ACTIVE')}
                          disabled={busyId === user.id}
                        >
                          Reinstate
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
