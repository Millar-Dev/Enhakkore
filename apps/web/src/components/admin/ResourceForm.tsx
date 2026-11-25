'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { STATUS_LABELS, type FieldDef, type ResourceDef } from '@enhakkore/shared';
import { SmartImage } from '@/components/public/SmartImage';
import { ApiError, api } from '@/lib/api';
import { can } from '@/lib/admin';
import { useSession } from '@/lib/session';
import { Panel, StatusPill, btn } from './AdminShell';
import { Field, LookupProvider } from './Fields';
import { ActivityParticipants, EventSales, TripDepartures } from './ResourceExtras';

/* eslint-disable @typescript-eslint/no-explicit-any */

function visible(field: FieldDef, values: Record<string, any>): boolean {
  if (!field.showIf) return true;
  return field.showIf.values.includes(values[field.showIf.field]);
}

/**
 * The editor for every content type. Sections follow the resource definition,
 * the action bar stays at the bottom of a phone screen, and destructive or
 * sensitive actions always ask first.
 */
export function ResourceForm({ resource, id }: { resource: ResourceDef; id?: string }) {
  const router = useRouter();
  const { user } = useSession();
  const [values, setValues] = useState<Record<string, any> | null>(id ? null : defaults(resource));
  const [row, setRow] = useState<Record<string, any> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const result = await api.get<{ values: Record<string, any>; row: Record<string, any> }>(`/cc/r/${resource.key}/${id}`);
    setValues(result.values);
    setRow(result.row);
    setDirty(false);
  }, [id, resource.key]);

  useEffect(() => {
    load().catch((caught) => setMessage({ tone: 'error', text: caught instanceof ApiError ? caught.message : 'Could not load.' }));
  }, [load]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const sections = useMemo(() => {
    const order: string[] = [];
    for (const field of resource.fields) {
      const section = field.section ?? 'Details';
      if (!order.includes(section)) order.push(section);
    }
    return order;
  }, [resource]);

  const confirmSensitive = () => !resource.sensitive || window.confirm('Payment details are shown to customers and donors. Save this change? It will be recorded in the audit log.');

  const save = async (override?: Record<string, any>) => {
    if (!values) return;
    if (!confirmSensitive()) return;
    setBusy(true);
    setErrors({});
    setMessage(null);
    const body = { values: { ...values, ...override }, ...(resource.sensitive ? { confirm: true } : {}) };
    try {
      if (id) {
        await api.patch(`/cc/r/${resource.key}/${id}`, body);
        await load();
        setMessage({ tone: 'ok', text: 'Saved.' });
      } else {
        const created = await api.post<{ id: string }>(`/cc/r/${resource.key}`, body);
        setDirty(false);
        router.replace(`/admin/r/${resource.key}/${created.id}?saved=1`);
      }
    } catch (caught) {
      if (caught instanceof ApiError) {
        setErrors(caught.fields);
        const first = Object.keys(caught.fields)[0];
        setMessage({ tone: 'error', text: first ? `${caught.message} (${Object.keys(caught.fields).length} to fix)` : caught.message });
      } else setMessage({ tone: 'error', text: 'Could not save. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: string, question?: string) => {
    if (!id) return save({ [resource.statusField!]: status });
    if (question && !window.confirm(question)) return;
    if (dirty && !window.confirm('You have unsaved changes. Save them first?')) return;
    if (dirty) await save();
    setBusy(true);
    try {
      await api.post(`/cc/r/${resource.key}/${id}/status`, { status, ...(resource.sensitive ? { confirm: true } : {}) });
      await load();
      setMessage({ tone: 'ok', text: `Now ${STATUS_LABELS[status]?.toLowerCase() ?? status.toLowerCase()}.` });
    } catch (caught) {
      setMessage({ tone: 'error', text: caught instanceof ApiError ? caught.message : 'Could not change the status.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const title = String(values?.[resource.titleField] ?? '');
    const typed = window.prompt(`Deleting cannot be undone. Type the name to confirm:\n\n${title}`);
    if (typed === null) return;
    if (typed.trim() !== title.trim()) return setMessage({ tone: 'error', text: 'The name did not match, so nothing was deleted.' });
    setBusy(true);
    try {
      await api.delete(`/cc/r/${resource.key}/${id}?confirm=yes`);
      router.replace(`/admin/r/${resource.key}`);
    } catch (caught) {
      setMessage({ tone: 'error', text: caught instanceof ApiError ? caught.message : 'Could not delete.' });
      setBusy(false);
    }
  };

  const duplicate = async () => {
    setBusy(true);
    try {
      const copy = await api.post<{ id: string }>(`/cc/r/${resource.key}/${id}/duplicate`, resource.sensitive ? { confirm: true } : {});
      router.push(`/admin/r/${resource.key}/${copy.id}`);
    } catch (caught) {
      setMessage({ tone: 'error', text: caught instanceof ApiError ? caught.message : 'Could not duplicate.' });
    } finally {
      setBusy(false);
    }
  };

  if (!values) return <p className="text-ink-muted">{message?.text ?? 'Loading…'}</p>;

  const status = row?.[resource.statusField ?? ''] ?? values[resource.statusField ?? ''];
  const canPublish = can(user, `${resource.permission}.publish`);
  const canDelete = can(user, `${resource.permission}.delete`) && !resource.protectDelete;
  const isPublished = status === resource.publishStatus || ['FULL', 'SOLD_OUT', 'COMPLETED'].includes(status);
  const publicHref = resource.publicPath && row ? resource.publicPath.replace('{slug}', row.slug ?? '').replace('{id}', row.id) : null;
  const statusFieldName = resource.statusField;

  return (
    <LookupProvider>
      <div className="grid gap-5 pb-28 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          {sections.map((section) => {
            const fields = resource.fields.filter((field) => (field.section ?? 'Details') === section && field.name !== statusFieldName && visible(field, values));
            if (fields.length === 0) return null;
            return (
              <Panel key={section} title={section}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map((field) => (
                    <Field
                      key={field.name}
                      field={field}
                      value={values[field.name]}
                      onChange={(next) => {
                        setValues((current) => ({ ...current!, [field.name]: next }));
                        setDirty(true);
                      }}
                      siblings={values}
                      errors={errors}
                      path={field.name}
                    />
                  ))}
                </div>
              </Panel>
            );
          })}
          {id && resource.key === 'activities' && <ActivityParticipants activityId={id} />}
          {id && resource.key === 'trips' && row && <TripDepartures tripValues={values} />}
          {id && resource.key === 'events' && <EventSales eventId={id} />}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Panel title="Status">
            {statusFieldName && (
              <>
                <div className="flex items-center justify-between">
                  <StatusPill status={String(status ?? 'DRAFT')} />
                  {row?.updatedAt && <span className="text-xs text-ink-muted">Saved {new Date(row.updatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>}
                </div>
                {canPublish && (
                  <label className="mt-4 grid gap-1 text-xs font-semibold text-ink-muted">
                    Set status
                    <select className="field" value={status ?? ''} onChange={(event) => (id ? setStatus(event.target.value) : (setValues({ ...values, [statusFieldName]: event.target.value }), setDirty(true)))}>
                      {(resource.statuses ?? []).map((item) => <option key={item} value={item}>{STATUS_LABELS[item] ?? item}</option>)}
                    </select>
                  </label>
                )}
                {!canPublish && <p className="mt-3 text-xs text-ink-muted">Your role can save drafts; someone with publish permission makes it live.</p>}
              </>
            )}
            <div className="mt-4 grid gap-2">
              {publicHref && isPublished && <a href={publicHref} target="_blank" rel="noreferrer" className={btn.secondary}>View on the website ↗</a>}
              <button type="button" className={btn.secondary} onClick={() => setPreview((value) => !value)}>{preview ? 'Hide preview' : 'Preview'}</button>
              {id && can(user, `${resource.permission}.create`) && resource.key !== 'countries' && <button type="button" className={btn.secondary} onClick={duplicate} disabled={busy}>Duplicate</button>}
              {id && resource.archiveStatus && status !== resource.archiveStatus && (canPublish || can(user, `${resource.permission}.edit`)) && (
                <button type="button" className={btn.secondary} disabled={busy} onClick={() => setStatus(resource.archiveStatus!, 'Archive this? It disappears from the website but is kept, and can be restored.')}>Archive</button>
              )}
              {id && resource.archiveStatus && status === resource.archiveStatus && (
                <button type="button" className={btn.secondary} disabled={busy} onClick={() => setStatus(resource.unpublishStatus ?? 'DRAFT')}>Restore</button>
              )}
              {id && canDelete && <button type="button" className={btn.danger} disabled={busy} onClick={remove}>Delete permanently</button>}
            </div>
          </Panel>
          {preview && <Preview resource={resource} values={values} />}
          {resource.key === 'activities' && values.source === 'COMMUNITY' && (
            <Panel title="Reviewing a submission">
              <ul className="list-disc space-y-1 pl-4 text-xs text-ink-soft">
                <li>Meeting place is public — never a home address.</li>
                <li>Date, time and city are clear.</li>
                <li>Price, if any, is stated, and nothing looks like a scam.</li>
                <li>Link the organiser’s account so they can manage requests.</li>
              </ul>
            </Panel>
          )}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-3 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 text-sm">
            {message ? <span className={message.tone === 'ok' ? 'font-semibold text-safari-700' : 'font-semibold text-danger'}>{message.text}</span> : dirty ? <span className="text-warning">Unsaved changes</span> : <Link href={`/admin/r/${resource.key}`} className="text-ink-muted">← All {resource.plural.toLowerCase()}</Link>}
          </div>
          <div className="flex gap-2">
            <button type="button" className={btn.secondary} disabled={busy} onClick={() => save()}>{busy ? 'Saving…' : id ? 'Save' : statusFieldName ? 'Save as draft' : 'Save'}</button>
            {statusFieldName && canPublish && !isPublished && resource.publishStatus && (
              <button type="button" className={btn.gold} disabled={busy} onClick={() => (id ? (dirty ? save({ [statusFieldName]: resource.publishStatus }) : setStatus(resource.publishStatus!)) : save({ [statusFieldName]: resource.publishStatus }))}>
                {resource.key === 'payment-methods' ? 'Save & enable' : 'Save & publish'}
              </button>
            )}
            {statusFieldName && canPublish && isPublished && resource.unpublishStatus && id && (
              <button type="button" className={btn.secondary} disabled={busy} onClick={() => setStatus(resource.unpublishStatus!, 'Take this off the website? It is kept as a draft.')}>Unpublish</button>
            )}
          </div>
        </div>
      </div>
    </LookupProvider>
  );
}

function defaults(resource: ResourceDef): Record<string, any> {
  const out: Record<string, any> = {};
  for (const field of resource.fields) {
    if (field.default !== undefined) out[field.name] = field.default;
    else if (['list', 'tags', 'gallery', 'multiselect', 'repeater'].includes(field.type)) out[field.name] = [];
  }
  if (resource.statusField && !out[resource.statusField]) out[resource.statusField] = resource.unpublishStatus ?? 'DRAFT';
  return out;
}

function Preview({ resource, values }: { resource: ResourceDef; values: Record<string, any> }) {
  const image = values[resource.imageField ?? 'coverImage'] ?? values.heroImage ?? values.poster;
  return (
    <Panel title="Preview (as a card)">
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="relative aspect-[4/3] bg-[color:var(--color-cream-deep)]">{image && <SmartImage src={image} alt="" fill sizes="320px" className="object-cover" />}</div>
        <div className="p-4">
          <p className="font-display text-xl text-acacia-700">{values[resource.titleField] || 'Untitled'}</p>
          <p className="mt-1 line-clamp-3 text-sm text-ink-muted">{values.summary || values.excerpt || values.description || ''}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-muted">The full page appears on the website once published.</p>
    </Panel>
  );
}
