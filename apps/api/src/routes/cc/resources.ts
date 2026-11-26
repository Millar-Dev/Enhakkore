import { Router, type Request } from 'express';
import { z } from 'zod';
import { resourceByKey, type ResourceDef } from '@enhakkore/shared';
import { ApiError, pageParams, paginated, route } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { textContains } from '../../lib/search';
import { assertPermission, can } from '../../middleware/auth';
import { audit, changedFields } from '../../services/audit';
import { buildData, ensureSlug, toForm, toPublic, type Row, type SaveContext } from '../../services/resources/engine';
import { HAS_PUBLISHED_AT, hooksFor } from '../../services/resources/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * One router for every content type in the control centre:
 *
 *   GET    /cc/r/:resource            list, search, filter, sort, page
 *   GET    /cc/r/:resource/:id        one item, as form values
 *   POST   /cc/r/:resource            create
 *   PATCH  /cc/r/:resource/:id        update (only the fields sent)
 *   POST   /cc/r/:resource/:id/status publish, unpublish, archive, restore…
 *   POST   /cc/r/:resource/:id/duplicate
 *   DELETE /cc/r/:resource/:id?confirm=yes
 *
 * Each action checks its own permission on the server (`<module>.view`,
 * `.create`, `.edit`, `.publish`, `.delete`), every change is written to the
 * audit trail, and partner roles only ever see the listings assigned to them.
 */
export const resourcesRouter = Router();

function resolve(req: Request): ResourceDef {
  const resource = resourceByKey(String(req.params.resource));
  if (!resource) throw ApiError.notFound('No such section.');
  return resource;
}

function delegate(resource: ResourceDef): any {
  return (prisma as any)[resource.model];
}

/** Conditions every query carries: the resource's own, plus ownership for partner roles. */
function scopeWhere(req: Request, resource: ResourceDef): Row {
  const hooks = hooksFor(resource);
  const where: Row = { ...(hooks.baseWhere ?? {}) };
  if (req.auth?.scope === 'OWN') {
    if (!resource.ownerField) throw ApiError.forbidden('Your role only covers the listings assigned to you.');
    where[resource.ownerField] = req.auth.id;
  }
  return where;
}

async function findScoped(req: Request, resource: ResourceDef, id: string): Promise<Row> {
  const hooks = hooksFor(resource);
  const row = await delegate(resource).findFirst({
    where: { ...scopeWhere(req, resource), id },
    ...(hooks.include ? { include: hooks.include } : {}),
  });
  if (!row) throw ApiError.notFound('That item does not exist, or is not yours to manage.');
  return row;
}

async function adminRow(resource: ResourceDef, row: Row): Promise<Row> {
  return toPublic(resource, row, { includePrivate: true });
}

resourcesRouter.get(
  '/:resource',
  route(async (req, res) => {
    const resource = resolve(req);
    assertPermission(req, `${resource.permission}.view`);
    const hooks = hooksFor(resource);
    const page = pageParams(req.query as Record<string, unknown>, 25, 100);
    const where: Row = scopeWhere(req, resource);

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) where.OR = resource.searchFields.map((field) => ({ [field]: textContains(q) }));

    const filterable = new Set([...resource.filters, ...(resource.statusField ? [resource.statusField] : [])]);
    for (const key of filterable) {
      const value = req.query[key];
      if (typeof value !== 'string' || value === '' || value === 'all') continue;
      const field = resource.fields.find((item) => item.name === key);
      where[key] = field?.type === 'boolean' ? value === 'true' : value;
    }

    const sortField = typeof req.query.sort === 'string' ? req.query.sort : resource.defaultSort.field;
    const sortable = new Set(['createdAt', 'updatedAt', ...resource.fields.map((field) => field.name)]);
    const orderBy = {
      [sortable.has(sortField) ? sortField : resource.defaultSort.field]:
        req.query.dir === 'asc' || req.query.dir === 'desc' ? req.query.dir : resource.defaultSort.dir,
    };

    const [rows, total, counts] = await Promise.all([
      delegate(resource).findMany({
        where,
        orderBy,
        skip: page.skip,
        take: page.take,
        ...(hooks.include ? { include: stripHeavyIncludes(hooks.include) } : {}),
      }),
      delegate(resource).count({ where }),
      resource.statusField
        ? delegate(resource).groupBy({ by: [resource.statusField], where: scopeWhere(req, resource), _count: { _all: true } })
        : Promise.resolve([]),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of counts as Row[]) statusCounts[row[resource.statusField!]] = row._count._all;

    res.json({
      ...paginated(await Promise.all(rows.map((row: Row) => adminRow(resource, row))), total, page),
      statusCounts,
    });
  }),
);

/** Lists don't need every departure and ticket, only the names of related rows. */
function stripHeavyIncludes(include: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(include)) {
    if (['country', 'city', 'category'].includes(key)) out[key] = value;
  }
  if ('departures' in include) out.departures = { orderBy: { startDate: 'asc' }, select: { startDate: true, endDate: true, seatsBooked: true, capacity: true } };
  return out;
}

resourcesRouter.get(
  '/:resource/:id',
  route(async (req, res) => {
    const resource = resolve(req);
    assertPermission(req, `${resource.permission}.view`);
    const hooks = hooksFor(resource);
    const row = await findScoped(req, resource, String(req.params.id));
    const values = toForm(resource, row);
    if (hooks.loadVirtual) Object.assign(values, await hooks.loadVirtual(row));
    res.json({ values, row: await adminRow(resource, row) });
  }),
);

const statusOnlyPermission = (resource: ResourceDef, req: Request, from: string | null, to: string | null) => {
  if (!resource.statusField || from === to) return;
  if (to === resource.archiveStatus || from === resource.archiveStatus) {
    if (!can(req, `${resource.permission}.publish`) && !can(req, `${resource.permission}.edit`)) {
      throw ApiError.forbidden('You do not have permission to archive or restore this.');
    }
    return;
  }
  assertPermission(req, `${resource.permission}.publish`);
};

/** Partner roles cannot reassign a listing, sponsor it, or vouch for its details. */
function restrictForPartner(req: Request, resource: ResourceDef, data: Row): void {
  if (req.auth?.scope !== 'OWN') return;
  if (resource.ownerField) data[resource.ownerField] = req.auth.id;
  for (const key of ['sponsored', 'featured', 'lastVerifiedAt']) delete data[key];
  if ('infoSource' in data) data.infoSource = 'BUSINESS_SUBMITTED';
}

function requireConfirmation(req: Request, resource: ResourceDef): void {
  if (resource.sensitive && req.body?.confirm !== true) {
    throw new ApiError(428, 'This is a sensitive change. Confirm it to continue.', 'confirmation_required');
  }
}

async function save(req: Request, resource: ResourceDef, existing: Row | null): Promise<Row> {
  const hooks = hooksFor(resource);
  const input: Row = (req.body?.values ?? req.body ?? {}) as Row;
  const data = await buildData(resource, input, existing, { partial: !!existing });
  restrictForPartner(req, resource, data);

  // Status changes need the publish permission; without it a new item starts
  // as a draft (or pending review) and an edit leaves the status alone.
  if (resource.statusField) {
    const from = existing?.[resource.statusField] ?? null;
    const to = data[resource.statusField] ?? from;
    if (existing) {
      if (to !== from) statusOnlyPermission(resource, req, from, to);
    } else if (to && to !== resource.unpublishStatus && to !== 'DRAFT' && to !== 'PENDING_REVIEW') {
      if (!can(req, `${resource.permission}.publish`)) data[resource.statusField] = resource.unpublishStatus ?? 'DRAFT';
    }
    if (HAS_PUBLISHED_AT.has(resource.model) && data[resource.statusField] === resource.publishStatus && !existing?.publishedAt) {
      data.publishedAt = new Date();
    }
  }

  await ensureSlug(resource, data, existing, hooks);
  const ctx: SaveContext = { req, resource, input, existing };
  if (hooks.beforeSave) await hooks.beforeSave(ctx, data);

  const record = existing
    ? await delegate(resource).update({ where: { id: existing.id }, data })
    : await delegate(resource).create({ data });
  if (hooks.afterSave) await hooks.afterSave(ctx, record);

  const diff = changedFields(existing, record);
  await audit(req, {
    action: existing ? 'update' : 'create',
    entityType: resource.key,
    entityId: record.id,
    summary: `${existing ? 'Edited' : 'Created'} ${resource.label.toLowerCase()} “${record[resource.titleField] ?? record.id}”`,
    before: existing ? diff.before : undefined,
    after: diff.after,
    sensitive: !!resource.sensitive,
  });
  return record;
}

resourcesRouter.post(
  '/:resource',
  route(async (req, res) => {
    const resource = resolve(req);
    assertPermission(req, `${resource.permission}.create`);
    requireConfirmation(req, resource);
    const record = await save(req, resource, null);
    res.status(201).json({ id: record.id, row: await adminRow(resource, record) });
  }),
);

resourcesRouter.patch(
  '/:resource/:id',
  route(async (req, res) => {
    const resource = resolve(req);
    assertPermission(req, `${resource.permission}.edit`);
    requireConfirmation(req, resource);
    const existing = await findScoped(req, resource, String(req.params.id));
    const record = await save(req, resource, existing);
    res.json({ id: record.id, row: await adminRow(resource, record) });
  }),
);

const statusSchema = z.object({ status: z.string().min(2).max(40), confirm: z.boolean().optional(), note: z.string().max(2000).optional() });

resourcesRouter.post(
  '/:resource/:id/status',
  route(async (req, res) => {
    const resource = resolve(req);
    if (!resource.statusField || !resource.statuses) throw ApiError.badRequest('This item has no status.');
    const { status, note } = statusSchema.parse(req.body);
    if (!resource.statuses.includes(status)) throw ApiError.badRequest('That is not a status this item can have.');
    requireConfirmation(req, resource);
    const existing = await findScoped(req, resource, String(req.params.id));
    const from = existing[resource.statusField];
    statusOnlyPermission(resource, req, from, status);

    const data: Row = { [resource.statusField]: status };
    if (HAS_PUBLISHED_AT.has(resource.model) && status === resource.publishStatus && !existing.publishedAt) data.publishedAt = new Date();
    if (note && resource.fields.some((field) => field.name === 'reviewNotes')) data.reviewNotes = note;

    const record = await delegate(resource).update({ where: { id: existing.id }, data });
    await audit(req, {
      action: 'status',
      entityType: resource.key,
      entityId: record.id,
      summary: `Changed ${resource.label.toLowerCase()} “${record[resource.titleField]}” from ${from} to ${status}`,
      before: { status: from },
      after: { status, ...(note ? { note } : {}) },
      sensitive: !!resource.sensitive,
    });
    res.json({ id: record.id, row: await adminRow(resource, record) });
  }),
);

resourcesRouter.post(
  '/:resource/:id/duplicate',
  route(async (req, res) => {
    const resource = resolve(req);
    assertPermission(req, `${resource.permission}.create`);
    requireConfirmation(req, resource);
    const hooks = hooksFor(resource);
    const existing = await findScoped(req, resource, String(req.params.id));
    const values = toForm(resource, existing);
    if (hooks.loadVirtual) {
      const virtual = await hooks.loadVirtual(existing);
      // A copy starts without departures' bookings: same dates, fresh seats.
      if (Array.isArray(virtual.departures)) {
        virtual.departures = virtual.departures.map((row: Row) => ({ ...row, id: undefined, seatsBooked: 0 }));
      }
      if (Array.isArray(virtual.tickets)) virtual.tickets = virtual.tickets.map((row: Row) => ({ ...row, id: undefined }));
      Object.assign(values, virtual);
    }
    values[resource.titleField] = `${values[resource.titleField]} (copy)`;
    if (resource.slugField) values[resource.slugField] = '';
    if (resource.statusField) values[resource.statusField] = resource.unpublishStatus ?? 'DRAFT';
    if ('featured' in values) values.featured = false;
    delete values.id;
    if (resource.key === 'countries') throw ApiError.badRequest('Countries cannot be duplicated.');
    req.body = { values };
    const record = await save(req, resource, null);
    res.status(201).json({ id: record.id });
  }),
);

resourcesRouter.delete(
  '/:resource/:id',
  route(async (req, res) => {
    const resource = resolve(req);
    assertPermission(req, `${resource.permission}.delete`);
    if (req.query.confirm !== 'yes') {
      throw new ApiError(428, 'Deleting cannot be undone. Confirm to continue.', 'confirmation_required');
    }
    if (resource.protectDelete) {
      throw ApiError.badRequest(`${resource.plural} cannot be deleted. Set the status to Draft or Archived to hide one.`);
    }
    const hooks = hooksFor(resource);
    const existing = await findScoped(req, resource, String(req.params.id));
    if (hooks.beforeDelete) await hooks.beforeDelete(existing);
    await delegate(resource).delete({ where: { id: existing.id } });
    await audit(req, {
      action: 'delete',
      entityType: resource.key,
      entityId: existing.id,
      summary: `Deleted ${resource.label.toLowerCase()} “${existing[resource.titleField] ?? existing.id}”`,
      before: toPublic(resource, existing, { includePrivate: true }),
      sensitive: true,
    });
    res.json({ ok: true });
  }),
);

const bulkSchema = z.object({
  action: z.enum(['publish', 'unpublish', 'archive', 'delete']),
  ids: z.array(z.string().min(5)).max(500).optional(),
  /** Apply to every record marked DEMO (instead of `ids`). */
  allDemo: z.boolean().optional(),
});

/**
 * Bulk publish, unpublish, archive or delete — either the selected rows or
 * every DEMO record of this kind. Each row is checked and logged as if it had
 * been changed on its own; rows that cannot be deleted are skipped and listed.
 */
resourcesRouter.post(
  '/:resource/bulk',
  route(async (req, res) => {
    const resource = resolve(req);
    const input = bulkSchema.parse(req.body);
    const needed = input.action === 'delete' ? 'delete' : input.action === 'archive' ? 'edit' : 'publish';
    assertPermission(req, `${resource.permission}.${needed}`);
    if (input.action === 'delete' && req.query.confirm !== 'yes') {
      throw new ApiError(428, 'Deleting cannot be undone. Confirm to continue.', 'confirmation_required');
    }
    const hasDemo = resource.fields.some((field) => field.name === 'isDemo');
    if (input.allDemo && !hasDemo) throw ApiError.badRequest('These records have no DEMO marker.');
    if (!input.allDemo && !input.ids?.length) throw ApiError.badRequest('Select at least one row.');
    const where: Row = { ...scopeWhere(req, resource), ...(input.allDemo ? { isDemo: true } : { id: { in: input.ids } }) };
    const rows: Row[] = await delegate(resource).findMany({ where });
    const status = input.action === 'publish' ? resource.publishStatus : input.action === 'unpublish' ? resource.unpublishStatus : resource.archiveStatus;
    if (input.action !== 'delete' && (!resource.statusField || !status)) throw ApiError.badRequest('This kind of record has no such status.');
    const hooks = hooksFor(resource);
    const done: string[] = [];
    const skipped: { id: string; title: string; reason: string }[] = [];
    for (const row of rows) {
      try {
        if (input.action === 'delete') {
          if (resource.protectDelete) throw ApiError.badRequest('Cannot be deleted.');
          if (hooks.beforeDelete) await hooks.beforeDelete(row);
          await delegate(resource).delete({ where: { id: row.id } });
        } else {
          const data: Row = { [resource.statusField!]: status };
          if (HAS_PUBLISHED_AT.has(resource.model) && status === resource.publishStatus && !row.publishedAt) data.publishedAt = new Date();
          await delegate(resource).update({ where: { id: row.id }, data });
        }
        done.push(row.id);
      } catch (error) {
        skipped.push({ id: row.id, title: String(row[resource.titleField] ?? row.id), reason: error instanceof Error ? error.message : 'Could not change it.' });
      }
    }
    await audit(req, {
      action: input.action === 'delete' ? 'delete' : 'status',
      entityType: resource.key,
      summary: `Bulk ${input.action}: ${done.length} ${resource.plural.toLowerCase()}${input.allDemo ? ' (all DEMO records)' : ''}`,
      after: { ids: done, skipped: skipped.length },
      sensitive: input.action === 'delete',
    });
    res.json({ done: done.length, skipped });
  }),
);
