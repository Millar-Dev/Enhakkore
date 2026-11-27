'use client';

import { useState } from 'react';
import { AdminShell, Panel, StatusPill, btn } from '@/components/admin/AdminShell';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useApi } from '@/lib/useApi';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Staff and their roles. Only the owner can give access, change a role's
 * permissions or revoke access — the API enforces this as well.
 */
export default function StaffPage() {
  const { user } = useSession();
  const owner = user?.role === 'ADMIN';
  const staff = useApi<any[]>('/cc/people/staff');
  const roles = useApi<{ roles: any[]; modules: { key: string; label: string }[]; actions: { key: string; label: string }[] }>('/cc/people/roles');
  const [editing, setEditing] = useState<any | null>(null);
  const [invite, setInvite] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const saveRole = async () => {
    try {
      if (editing.id) await api.patch(`/cc/people/roles/${editing.id}`, { name: editing.name, description: editing.description, permissions: editing.permissions, scope: editing.scope });
      else await api.post('/cc/people/roles', { name: editing.name, description: editing.description, permissions: editing.permissions, scope: editing.scope });
      setEditing(null);
      await roles.reload();
    } catch (caught) {
      setNotice(caught instanceof ApiError ? caught.message : 'Could not save the role.');
    }
  };
  const toggle = (permission: string) => setEditing((role: any) => ({ ...role, permissions: role.permissions.includes(permission) ? role.permissions.filter((item: string) => item !== permission) : [...role.permissions, permission] }));

  return (
    <AdminShell title="Staff & roles" permission="staff.view" actions={owner ? <button className={btn.gold} onClick={() => setInvite(true)}>+ Give someone access</button> : undefined}>
      {notice && <p className="mb-4 rounded-lg bg-[#fdf4e3] p-3 text-sm text-warning">{notice}</p>}
      {invite && (
        <Panel title="Give a team member access" className="mb-5">
          <form
            className="grid gap-3 sm:grid-cols-3"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              try {
                const result = await api.post<any>('/cc/people/staff', { email: String(form.get('email')), name: String(form.get('name') ?? '') || undefined, roleId: String(form.get('roleId')) });
                setInvite(false);
                setNotice(result.temporaryPassword ? `Account created for ${result.email}. One-time password: ${result.temporaryPassword} — give it to them privately; they should change it after signing in. It will not be shown again.` : `${result.email} now has access.`);
                await staff.reload();
              } catch (caught) {
                setNotice(caught instanceof ApiError ? Object.values(caught.fields)[0] ?? caught.message : 'Could not give access.');
              }
            }}
          >
            <input name="email" type="email" required placeholder="Their email" className="field" />
            <input name="name" placeholder="Their name (for a new account)" className="field" />
            <select name="roleId" required className="field">{(roles.data?.roles ?? []).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>
            <div className="flex gap-2 sm:col-span-3"><button className={btn.primary}>Give access</button><button type="button" className={btn.secondary} onClick={() => setInvite(false)}>Cancel</button></div>
          </form>
        </Panel>
      )}
      <Panel title="Team" className="mb-5">
        <ul className="divide-y divide-line text-sm">
          {(staff.data ?? []).map((person) => (
            <li key={person.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div><p className="font-semibold">{person.name} <span className="text-xs font-normal text-ink-muted">{person.email}</span></p><p className="text-xs text-ink-muted">{person.role === 'ADMIN' ? 'Owner — every permission' : person.adminRole?.name ?? 'No role'} · {person.activeSessions} active session{person.activeSessions === 1 ? '' : 's'} · last sign-in {person.lastLoginAt ? new Date(person.lastLoginAt).toLocaleDateString('en-GB') : 'never'}</p></div>
              <div className="flex flex-wrap items-center gap-2">
                {person.status !== 'ACTIVE' && <StatusPill status={person.status} />}
                {owner && person.role === 'STAFF' && (
                  <>
                    <select className="field h-10 w-48" defaultValue={person.adminRole?.id} onChange={async (event) => { await api.patch(`/cc/people/staff/${person.id}`, { roleId: event.target.value }); await staff.reload(); }}>
                      {(roles.data?.roles ?? []).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                    <button className={btn.danger} onClick={async () => { if (window.confirm(`Revoke ${person.name}'s access to the control centre? They keep an ordinary member account.`)) { await api.patch(`/cc/people/staff/${person.id}`, { roleId: null }); await staff.reload(); } }}>Revoke access</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Roles" actions={owner ? <button className={btn.secondary} onClick={() => setEditing({ name: '', description: '', permissions: [], scope: 'ALL' })}>+ New role</button> : undefined}>
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          {(roles.data?.roles ?? []).map((role) => (
            <li key={role.id} className="rounded-xl border border-line p-3">
              <p className="font-semibold">{role.name} <span className="text-xs font-normal text-ink-muted">· {role._count.users} {role._count.users === 1 ? 'person' : 'people'}{role.scope === 'OWN' ? ' · own listings only' : ''}</span></p>
              <p className="text-xs text-ink-muted">{role.description}</p>
              {owner && (
                <div className="mt-2 flex gap-2">
                  <button className="inline-flex min-h-10 items-center text-xs font-semibold text-acacia-600 underline" onClick={() => setEditing({ ...role })}>Edit permissions</button>
                  {role._count.users === 0 && <button className="text-xs font-semibold text-danger underline" onClick={async () => { if (window.confirm(`Delete the role “${role.name}”?`)) { await api.delete(`/cc/people/roles/${role.id}?confirm=yes`); await roles.reload(); } }}>Delete</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {editing && roles.data && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <p className="text-lg font-bold text-acacia-700">{editing.id ? `Edit “${editing.name}”` : 'New role'}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input className="field" placeholder="Role name" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
              <select className="field" value={editing.scope} onChange={(event) => setEditing({ ...editing, scope: event.target.value })}><option value="ALL">Sees everything in its sections</option><option value="OWN">Sees only listings assigned to them (partners)</option></select>
              <input className="field sm:col-span-2" placeholder="What this role is for" value={editing.description ?? ''} onChange={(event) => setEditing({ ...editing, description: event.target.value })} />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={editing.permissions.includes('*')} onChange={() => toggle('*')} /> Everything (super administrator)</label>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs">
                <thead><tr><th className="py-2 text-left">Section</th>{roles.data.actions.map((action) => <th key={action.key}>{action.label}</th>)}</tr></thead>
                <tbody className="divide-y divide-line">
                  {roles.data.modules.map((module) => (
                    <tr key={module.key}>
                      <td className="py-2 pr-2">{module.label}</td>
                      {roles.data!.actions.map((action) => {
                        const key = `${module.key}.${action.key}`;
                        const all = editing.permissions.includes(`${module.key}.*`) || editing.permissions.includes('*');
                        return <td key={action.key} className="text-center"><input type="checkbox" disabled={all} checked={all || editing.permissions.includes(key)} onChange={() => toggle(key)} aria-label={`${module.label}: ${action.label}`} /></td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex gap-2"><button className={btn.primary} onClick={() => { if (window.confirm('Save these permissions? Changes apply to everyone with this role on their next action.')) void saveRole(); }}>Save role</button><button className={btn.secondary} onClick={() => setEditing(null)}>Cancel</button></div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
