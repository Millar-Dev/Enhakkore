'use client';

import { useState } from 'react';
import { AdminShell, Panel, btn } from '@/components/admin/AdminShell';
import { api } from '@/lib/api';
import { can } from '@/lib/admin';
import { downloadCsv } from '@/lib/download';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/useApi';

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function SecurityPage() {
  const { user } = useSession();
  const [tab, setTab] = useState<'audit' | 'sessions' | 'logins' | 'backups'>('audit');
  const [q, setQ] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const audit = useApi<{ items: any[] }>(`/cc/people/security/audit?pageSize=100${q ? `&q=${encodeURIComponent(q)}` : ''}${sensitive ? '&sensitive=true' : ''}`);
  const sessions = useApi<any[]>('/cc/people/security/sessions?scope=all');
  const logins = useApi<{ items: any[] }>('/cc/people/security/logins?pageSize=100');

  return (
    <AdminShell title="Security & audit" permission="security.view" actions={can(user, 'security.export') ? <button className={btn.secondary} onClick={() => downloadCsv('/cc/people/export/audit.csv', 'enhakkore-audit.csv')}>Export audit log</button> : undefined}>
      <div className="mb-5 flex flex-wrap gap-2">
        {[['audit', 'Change history'], ['sessions', 'Active sessions'], ['logins', 'Sign-in attempts'], ['backups', 'Backups & recovery']].map(([key, label]) => <button key={key} className={`chip ${tab === key ? 'chip-active' : ''}`} onClick={() => setTab(key as typeof tab)}>{label}</button>)}
      </div>
      {tab === 'audit' && (
        <Panel>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row"><input className="field" placeholder="Search changes or people" value={q} onChange={(event) => setQ(event.target.value)} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sensitive} onChange={(event) => setSensitive(event.target.checked)} /> Sensitive only (payments, permissions, money, exports)</label></div>
          <ul className="divide-y divide-line text-sm">
            {(audit.data?.items ?? []).map((row) => (
              <li key={row.id} className="py-2.5">
                <details>
                  <summary className="cursor-pointer"><span className={row.sensitive ? 'font-semibold text-warning' : 'font-semibold'}>{row.summary}</span><span className="block text-xs text-ink-muted">{row.actorName} · {new Date(row.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}{row.ip ? ` · ${row.ip}` : ''}</span></summary>
                  {(row.before || row.after) && (
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {row.before && <pre className="max-h-64 overflow-auto rounded-lg bg-danger-soft p-2 text-[0.6875rem]">Before: {JSON.stringify(JSON.parse(row.before), null, 2)}</pre>}
                      {row.after && <pre className="max-h-64 overflow-auto rounded-lg bg-safari-50 p-2 text-[0.6875rem]">After: {JSON.stringify(JSON.parse(row.after), null, 2)}</pre>}
                    </div>
                  )}
                </details>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {tab === 'sessions' && (
        <Panel>
          <ul className="divide-y divide-line text-sm">
            {(sessions.data ?? []).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div><p className="font-semibold">{row.user.name} <span className="text-xs font-normal text-ink-muted">{row.user.email} · {row.user.role.toLowerCase()}</span>{row.current && <span className="ml-2 rounded-full bg-acacia-50 px-2 text-xs text-acacia-700">this device</span>}</p><p className="text-xs text-ink-muted">{row.userAgent?.slice(0, 80) ?? 'Unknown device'} · {row.ip ?? ''} · last active {new Date(row.lastSeenAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p></div>
                {can(user, 'security.edit') && !row.current && (
                  <div className="flex gap-2">
                    <button className={btn.secondary} onClick={async () => { await api.post(`/cc/people/security/sessions/${row.id}/revoke`); await sessions.reload(); }}>Sign out</button>
                    <button className={btn.danger} onClick={async () => { if (window.confirm(`Sign ${row.user.name} out on every device?`)) { await api.post(`/cc/people/security/users/${row.user.id}/revoke-all`); await sessions.reload(); } }}>Everywhere</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {tab === 'logins' && (
        <Panel>
          <ul className="divide-y divide-line text-sm">
            {(logins.data?.items ?? []).map((row) => (
              <li key={row.id} className="py-2"><span className={row.success ? 'text-safari-700' : 'font-semibold text-danger'}>{row.success ? '✓' : '✕'} {row.email}</span><span className="block text-xs text-ink-muted">{row.reason.replace(/_/g, ' ')} · {new Date(row.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} · {row.ip ?? ''}</span></li>
            ))}
          </ul>
        </Panel>
      )}
      {tab === 'backups' && (
        <Panel title="Backups & recovery">
          <div className="space-y-3 text-sm leading-relaxed text-ink-soft">
            <p><strong>Database.</strong> The live database runs on Neon (PostgreSQL), which keeps a point-in-time restore history. How far back depends on your Neon plan — check it under Neon → your project → Settings → Storage / History retention. To restore, use Neon’s “Restore” (branch from a point in time).</p>
            <p><strong>Your own copies.</strong> Export finance, donations, members and this audit log as CSV regularly (monthly is sensible) and keep them somewhere safe. The full steps are in the handover document (docs/HANDOVER.md).</p>
            <p><strong>Photos and videos</strong> uploaded here are stored by the image service (Cloudinary) once it is connected; until then, uploads are not durable — see the alert on the overview page.</p>
            <p><strong>If an account is compromised:</strong> sign that person out everywhere (Active sessions), suspend the account (Customers & members) or revoke staff access (Staff & roles), then have them reset their password from the sign-in page.</p>
            <p><strong>Two-factor sign-in</strong> is not available yet. Use a long, unique password for the owner account.</p>
          </div>
        </Panel>
      )}
    </AdminShell>
  );
}
