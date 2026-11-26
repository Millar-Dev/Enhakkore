import type { Request } from 'express';
import {
  SUPPORTED_CURRENCIES,
  isValidTimeZone,
  localToUtc,
  slugify,
  storedFields,
  toMajor,
  toMinor,
  utcToLocalInput,
  type FieldDef,
  type ResourceDef,
} from '@enhakkore/shared';
import { Prisma } from '@prisma/client';
import { ApiError } from '../../lib/http';
import { prisma } from '../../lib/prisma';

/** Column rules straight from the database schema: may it be null, does it have a default. */
const COLUMNS = new Map<string, Map<string, { required: boolean; hasDefault: boolean }>>(
  Prisma.dmmf.datamodel.models.map((model) => [
    model.name.charAt(0).toLowerCase() + model.name.slice(1),
    new Map(model.fields.map((field) => [field.name, { required: field.isRequired, hasDefault: field.hasDefaultValue }])),
  ]),
);

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The generic content engine behind the admin control centre.
 *
 * Every content type is described once in @enhakkore/shared (fields, labels,
 * statuses, permissions). This file turns a form submission into a database
 * row — validating each value, converting money to minor units and local times
 * to UTC — and turns a row back into form values. Nothing a browser sends is
 * stored without passing through here.
 */

export type Row = Record<string, any>;

export interface SaveContext {
  req: Request;
  resource: ResourceDef;
  /** The raw form values. */
  input: Row;
  /** The row being edited, or null when creating. */
  existing: Row | null;
}

export interface ResourceHooks {
  /** Prisma `include` for list and detail reads. */
  include?: Row;
  /** Extra conditions every query on this resource carries (e.g. trips run by Enhakkore). */
  baseWhere?: Row;
  /** Fields whose combination the slug must be unique within. */
  slugScope?: string[];
  /** Adjust the data about to be written. */
  beforeSave?(ctx: SaveContext, data: Row): Promise<void>;
  /** Write related rows (departures, tickets…) after the main row is saved. */
  afterSave?(ctx: SaveContext, record: Row): Promise<void>;
  /** Add virtual fields to the admin's form values. */
  loadVirtual?(record: Row): Promise<Row>;
  /** Throw to refuse a delete, with a reason the owner can act on. */
  beforeDelete?(record: Row): Promise<void>;
}

const URLISH = /^(https?:\/\/|\/)[^\s]*$/i;
const EMAILISH = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
}

/** Date-only values are stored at noon UTC, so no time zone can move them to another day. */
function dateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

interface CoerceEnv {
  /** Values of sibling fields (already raw), for currency and time zone lookups. */
  siblings: Row;
  /** The parent row's raw values, for `../currency` in a repeater. */
  parent?: Row;
  existing: Row | null;
  /** Fallback zone for datetime fields. */
  zone: string;
  errors: Record<string, string>;
  path: string;
}

function currencyFor(field: FieldDef, env: CoerceEnv): string {
  const key = field.currencyField ?? 'currency';
  const raw = key.startsWith('../') ? env.parent?.[key.slice(3)] : env.siblings[key] ?? env.existing?.[key];
  return typeof raw === 'string' && raw ? raw.toUpperCase() : 'TZS';
}

function zoneFor(field: FieldDef, env: CoerceEnv): string {
  const raw = field.timezoneField ? env.siblings[field.timezoneField] ?? env.existing?.[field.timezoneField] : null;
  return isValidTimeZone(raw) ? raw : env.zone;
}

function optionValues(field: FieldDef): string[] | null {
  return field.options ? field.options.map((option) => option.value) : null;
}

/**
 * Converts one submitted value into what is stored. Records a message in
 * `env.errors` and returns undefined when the value is not acceptable.
 */
function coerceField(field: FieldDef, raw: unknown, env: CoerceEnv): unknown {
  const key = env.path ? `${env.path}.${field.name}` : field.name;
  const fail = (message: string) => {
    env.errors[key] = message;
    return undefined;
  };

  if (isEmpty(raw)) {
    if (field.required) return fail(`${field.label} is required.`);
    switch (field.type) {
      case 'boolean':
        return false;
      case 'list':
      case 'tags':
      case 'multiselect':
      case 'gallery':
      case 'repeater':
        return [];
      default:
        return null;
    }
  }

  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'phone':
    case 'color': {
      const value = String(raw).trim();
      if (field.max && value.length > field.max) return fail(`${field.label} is too long (${field.max} characters at most).`);
      return value;
    }
    case 'email': {
      const value = String(raw).trim().toLowerCase();
      if (!EMAILISH.test(value)) return fail('Enter a valid email address.');
      return value;
    }
    case 'url':
    case 'image':
    case 'video': {
      const value = String(raw).trim();
      if (!URLISH.test(value)) return fail('Enter a full link starting with https://, or choose a file from the media library.');
      if (value.length > 2000) return fail('That link is too long.');
      return value;
    }
    case 'timezone': {
      const value = String(raw).trim();
      if (!isValidTimeZone(value)) return fail('Not a recognised time zone (e.g. Africa/Dar_es_Salaam, Africa/Lagos).');
      return value;
    }
    case 'select': {
      const value = String(raw);
      const allowed = optionValues(field);
      if (allowed && !allowed.includes(value)) return fail(`Choose one of the options for ${field.label}.`);
      return value;
    }
    case 'currency': {
      const value = String(raw).toUpperCase();
      if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(value)) return fail('Choose a supported currency.');
      return value;
    }
    case 'number':
    case 'integer': {
      const value = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''));
      if (!Number.isFinite(value)) return fail(`${field.label} must be a number.`);
      if (field.type === 'integer' && !Number.isInteger(value)) return fail(`${field.label} must be a whole number.`);
      if (field.min !== undefined && value < field.min) return fail(`${field.label} must be at least ${field.min}.`);
      if (field.max !== undefined && value > field.max) return fail(`${field.label} must be at most ${field.max}.`);
      return value;
    }
    case 'money': {
      const value = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''));
      if (!Number.isFinite(value) || value < 0) return fail(`${field.label} must be a positive amount.`);
      if (value > 1e12) return fail(`${field.label} is too large.`);
      return toMinor(value, currencyFor(field, env));
    }
    case 'boolean':
      return raw === true || raw === 'true' || raw === 1 || raw === '1' || raw === 'on';
    case 'date': {
      const date = dateOnly(String(raw));
      if (!date) return fail(`${field.label} must be a date.`);
      return date;
    }
    case 'datetime': {
      const date = localToUtc(String(raw).slice(0, 19), zoneFor(field, env));
      if (!date) return fail(`${field.label} must be a date and time.`);
      return date;
    }
    case 'list':
    case 'tags':
    case 'gallery':
    case 'multiselect': {
      const items = (Array.isArray(raw) ? raw : String(raw).split('\n'))
        .map((item) => String(item ?? '').trim())
        .filter(Boolean);
      if (items.length > 200) return fail(`${field.label} has too many items.`);
      if (field.type === 'gallery' && items.some((item) => !URLISH.test(item))) return fail('Every gallery item must be a photo link.');
      const allowed = optionValues(field);
      if (field.type === 'multiselect' && allowed && items.some((item) => !allowed.includes(item))) {
        return fail(`Choose from the options for ${field.label}.`);
      }
      if (items.some((item) => item.length > 2000)) return fail(`An item in ${field.label} is too long.`);
      return Array.from(new Set(items));
    }
    case 'repeater': {
      if (!Array.isArray(raw)) return fail(`${field.label} must be a list.`);
      if (raw.length > 200) return fail(`${field.label} has too many rows.`);
      return raw.map((row, index) => {
        const source = row && typeof row === 'object' ? (row as Row) : {};
        const out: Row = {};
        for (const sub of field.fields ?? []) {
          const value = coerceField(sub, source[sub.name], {
            ...env,
            siblings: source,
            parent: env.siblings,
            path: `${key}.${index}`,
          });
          if (value !== undefined) out[sub.name] = value instanceof Date ? value.toISOString() : value;
        }
        return out;
      });
    }
    case 'country':
    case 'city':
    case 'category':
    case 'place':
    case 'user':
    case 'ref':
      return String(raw).trim();
    default:
      return raw;
  }
}

/** JSON-encoded on SQLite, which has no array or JSON columns. */
function isJsonColumn(field: FieldDef): boolean {
  return ['list', 'tags', 'gallery', 'multiselect', 'repeater'].includes(field.type);
}

/** Checks that referenced rows exist — a category of the right kind, a city in the chosen country. */
async function checkReferences(resource: ResourceDef, data: Row, errors: Record<string, string>): Promise<void> {
  for (const field of storedFields(resource)) {
    const id = data[field.name];
    if (!id || typeof id !== 'string') continue;
    if (field.type === 'country') {
      if (!(await prisma.country.findUnique({ where: { id }, select: { id: true } }))) errors[field.name] = 'Choose a country from the list.';
    } else if (field.type === 'city') {
      const city = await prisma.city.findUnique({ where: { id }, select: { countryId: true } });
      if (!city) errors[field.name] = 'Choose a city from the list.';
      else if (data.countryId && city.countryId !== data.countryId) errors[field.name] = 'That city is not in the chosen country.';
    } else if (field.type === 'category') {
      const category = await prisma.category.findUnique({ where: { id }, select: { kind: true } });
      if (!category || (field.categoryKind && category.kind !== field.categoryKind)) errors[field.name] = 'Choose a category from the list.';
    } else if (field.type === 'place') {
      if (!(await prisma.place.findUnique({ where: { id }, select: { id: true } }))) errors[field.name] = 'Choose a place from the list.';
    } else if (field.type === 'user') {
      if (!(await prisma.user.findUnique({ where: { id }, select: { id: true } }))) errors[field.name] = 'Choose an account from the list.';
    }
  }
}

/** The zone a resource's times are entered in: its own field, its city's, its country's, or Dar es Salaam. */
async function defaultZone(input: Row, existing: Row | null): Promise<string> {
  const own = input.timezone ?? existing?.timezone;
  if (isValidTimeZone(own)) return own;
  const cityId = input.cityId ?? existing?.cityId;
  if (cityId) {
    const city = await prisma.city.findUnique({ where: { id: cityId }, include: { country: true } });
    if (city?.timezone && isValidTimeZone(city.timezone)) return city.timezone;
    if (city?.country.timezone && isValidTimeZone(city.country.timezone)) return city.country.timezone;
  }
  const countryId = input.countryId ?? existing?.countryId;
  if (countryId) {
    const country = await prisma.country.findUnique({ where: { id: countryId } });
    if (country && isValidTimeZone(country.timezone)) return country.timezone;
  }
  return 'Africa/Dar_es_Salaam';
}

/**
 * Turns submitted form values into the data to write.
 *
 * On update only the fields present in the submission change, so a partial
 * save (e.g. a status toggle) never wipes other fields.
 */
export async function buildData(
  resource: ResourceDef,
  input: Row,
  existing: Row | null,
  options: { partial: boolean },
): Promise<Row> {
  const errors: Record<string, string> = {};
  const data: Row = {};
  const zone = await defaultZone(input, existing);

  for (const field of storedFields(resource)) {
    if (field.readOnly && existing) continue;
    const present = Object.prototype.hasOwnProperty.call(input, field.name);
    if (options.partial && !present) continue;
    if (!present && !field.required && field.default !== undefined && !existing) {
      data[field.name] = field.default;
      continue;
    }
    const value = coerceField(field, present ? input[field.name] : field.default, {
      siblings: input,
      existing,
      zone,
      errors,
      path: '',
    });
    if (value === undefined) continue;
    if (value === null) {
      // An empty value for a column that cannot be empty: leave the stored
      // value (or the database default) in place rather than fail the save.
      const column = COLUMNS.get(resource.model)?.get(field.name);
      if (column?.required) {
        // The slug is made from the title just before saving.
        if (column.hasDefault || existing || field.name === resource.slugField) continue;
        errors[field.name] = `${field.label} is required.`;
        continue;
      }
    }
    data[field.name] = isJsonColumn(field) ? JSON.stringify(value) : value;
  }

  // A time zone left empty is filled from the city, so times always have one.
  if (resource.fields.some((field) => field.name === 'timezone' && field.section === 'Date & time') && !data.timezone && !existing?.timezone) {
    data.timezone = zone;
  }

  await checkReferences(resource, data, errors);

  if (Object.keys(errors).length > 0) {
    throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', errors);
  }
  return data;
}

/** Validates the virtual (repeater) fields a hook will store elsewhere, returning clean rows. */
export async function virtualValues(resource: ResourceDef, input: Row, existing: Row | null): Promise<Row> {
  const errors: Record<string, string> = {};
  const out: Row = {};
  const zone = await defaultZone(input, existing);
  for (const field of resource.fields.filter((item) => item.virtual)) {
    if (!Object.prototype.hasOwnProperty.call(input, field.name)) continue;
    const value = coerceField(field, input[field.name], { siblings: input, existing, zone, errors, path: '' });
    if (value !== undefined) out[field.name] = value;
  }
  if (Object.keys(errors).length > 0) {
    throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', errors);
  }
  return out;
}

function parseJson(value: unknown, fallback: unknown): unknown {
  if (typeof value !== 'string') return value ?? fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toFormValue(field: FieldDef, value: unknown, row: Row, parent: Row | null, zone: string): unknown {
  if (value === null || value === undefined) {
    return isJsonColumn(field) ? [] : field.type === 'boolean' ? false : '';
  }
  switch (field.type) {
    case 'money': {
      const key = field.currencyField ?? 'currency';
      const currency = (key.startsWith('../') ? parent?.[key.slice(3)] : row[key]) ?? 'TZS';
      return toMajor(Number(value), String(currency));
    }
    case 'date':
      return (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);
    case 'datetime': {
      const tz = field.timezoneField && isValidTimeZone(row[field.timezoneField]) ? row[field.timezoneField] : zone;
      return utcToLocalInput(value as string | Date, tz);
    }
    case 'repeater': {
      const rows = (parseJson(value, []) as Row[]) ?? [];
      return rows.map((item) => {
        const out: Row = { ...item };
        for (const sub of field.fields ?? []) out[sub.name] = toFormValue(sub, item?.[sub.name], item ?? {}, row, zone);
        return out;
      });
    }
    case 'list':
    case 'tags':
    case 'gallery':
    case 'multiselect':
      return parseJson(value, []);
    default:
      return value instanceof Date ? value.toISOString() : value;
  }
}

/** A stored row as the admin form shows it: money in major units, times in local time. */
export function toForm(resource: ResourceDef, row: Row): Row {
  const zone = isValidTimeZone(row.timezone) ? row.timezone : 'Africa/Dar_es_Salaam';
  const out: Row = { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt };
  for (const field of storedFields(resource)) {
    out[field.name] = toFormValue(field, row[field.name], row, null, zone);
  }
  return out;
}

/** Converts a virtual repeater's stored rows into form values. */
export function virtualToForm(field: FieldDef, rows: Row[], parent: Row): Row[] {
  const zone = isValidTimeZone(parent.timezone) ? parent.timezone : 'Africa/Dar_es_Salaam';
  return rows.map((item) => {
    const out: Row = { ...item };
    for (const sub of field.fields ?? []) out[sub.name] = toFormValue(sub, item?.[sub.name], item, parent, zone);
    return out;
  });
}

/**
 * Public shape of a row: JSON columns parsed, private fields removed. Money
 * stays in minor units with its currency, for the website to format.
 */
export function toPublic(resource: ResourceDef, row: Row, options: { includePrivate?: boolean } = {}): Row {
  const out: Row = { id: row.id, createdAt: row.createdAt, updatedAt: row.updatedAt };
  for (const field of storedFields(resource)) {
    if (field.private && !options.includePrivate) continue;
    const value = row[field.name];
    out[field.name] = isJsonColumn(field) ? parseJson(value, []) : value instanceof Date ? value.toISOString() : (value ?? null);
  }
  if (row.publishedAt !== undefined) out.publishedAt = row.publishedAt;
  if (row.country) out.country = { id: row.country.id, name: row.country.name, slug: row.country.slug, code: row.country.code };
  if (row.city) out.city = { id: row.city.id, name: row.city.name, slug: row.city.slug };
  if (row.category) out.category = { id: row.category.id, name: row.category.name, slug: row.category.slug, group: row.category.group, icon: row.category.icon };
  return out;
}

/** A slug that no other row uses, made from the title when none is given. */
export async function ensureSlug(
  resource: ResourceDef,
  data: Row,
  existing: Row | null,
  hooks: ResourceHooks,
): Promise<void> {
  if (!resource.slugField) return;
  const field = resource.slugField;
  const requested = typeof data[field] === 'string' && data[field] ? slugify(data[field]) : null;
  if (!requested && existing?.[field]) {
    delete data[field];
    return;
  }
  const base = requested || slugify(String(data[resource.titleField] ?? existing?.[resource.titleField] ?? 'item')) || 'item';
  const delegate = (prisma as any)[resource.model];
  const scope: Row = {};
  for (const key of hooks.slugScope ?? []) scope[key] = data[key] ?? existing?.[key];

  let candidate = base;
  for (let attempt = 2; attempt < 200; attempt += 1) {
    const clash = await delegate.findFirst({ where: { ...scope, [field]: candidate }, select: { id: true } });
    if (!clash || clash.id === existing?.id) break;
    if (requested && attempt === 2 && existing) {
      // The owner asked for this exact address and it is taken: say so rather than silently change it.
      throw new ApiError(422, 'Another item already uses that web address.', 'validation_error', { [field]: 'Already in use — try another.' });
    }
    candidate = `${base}-${attempt}`;
  }
  data[field] = candidate;
}
