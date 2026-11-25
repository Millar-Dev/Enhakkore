import { departureStatus, slugify, type ResourceDef } from '@enhakkore/shared';
import { ApiError } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import type { ResourceHooks, Row } from './engine';
import { virtualToForm, virtualValues } from './engine';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The organizer record Enhakkore's own trips belong to. Created by the bootstrap. */
export const ENHAKKORE_ORGANIZER_SLUG = 'enhakkore';

export async function enhakkoreOrganizerId(): Promise<string> {
  const organizer = await prisma.organizer.findUnique({ where: { slug: ENHAKKORE_ORGANIZER_SLUG }, select: { id: true } });
  if (!organizer) throw new ApiError(500, 'The Enhakkore operator record is missing. Run the bootstrap.', 'not_bootstrapped');
  return organizer.id;
}

/** Finds or makes the legacy Destination row a trip needs, from its city or country. */
async function destinationFor(countryId: string | null, cityId: string | null, label: string | null): Promise<string> {
  const city = cityId ? await prisma.city.findUnique({ where: { id: cityId }, include: { country: true } }) : null;
  const country = city?.country ?? (countryId ? await prisma.country.findUnique({ where: { id: countryId } }) : null);
  const name = city?.name ?? label ?? country?.name ?? 'Worldwide';
  const slug = slugify(city ? `${city.name}-${city.country.code}` : country ? `country-${country.code}` : `place-${name}`);
  const existing = await prisma.destination.findUnique({ where: { slug } });
  if (existing) return existing.id;
  const created = await prisma.destination.create({
    data: {
      name,
      slug,
      country: country?.name ?? 'International',
      continent: country?.region ?? 'International',
      latitude: city?.latitude ?? country?.latitude ?? null,
      longitude: city?.longitude ?? country?.longitude ?? null,
    },
  });
  return created.id;
}

const tripHooks = (resource: ResourceDef): ResourceHooks => ({
  include: {
    country: true,
    city: true,
    departures: { orderBy: { startDate: 'asc' } },
    itinerary: { orderBy: { dayNumber: 'asc' } },
  },
  baseWhere: { organizer: { slug: ENHAKKORE_ORGANIZER_SLUG } },
  async beforeSave(ctx, data) {
    if (!ctx.existing) data.organizerId = await enhakkoreOrganizerId();
    const countryId = data.countryId ?? ctx.existing?.countryId ?? null;
    const cityId = data.cityId ?? ctx.existing?.cityId ?? null;
    if ('countryId' in data || 'cityId' in data || !ctx.existing) {
      data.destinationId = await destinationFor(countryId, cityId, data.destinationLabel ?? ctx.existing?.destinationLabel ?? null);
    }
    // The older gallery column, kept in step for pages that still read it.
    if (typeof data.galleryItems === 'string') {
      const items = JSON.parse(data.galleryItems) as { src?: string }[];
      data.gallery = JSON.stringify(items.map((item) => item.src).filter(Boolean));
    }
    // Validate departures and itinerary before anything is written.
    (ctx as any).virtual = await virtualValues(resource, ctx.input, ctx.existing);
    const departures = (ctx as any).virtual.departures as Row[] | undefined;
    for (const [index, departure] of (departures ?? []).entries()) {
      if (new Date(departure.endDate) < new Date(departure.startDate)) {
        throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', {
          [`departures.${index}.endDate`]: 'Ends before it starts.',
        });
      }
    }
    // Refuse impossible changes before the trip itself is written, so a save
    // either goes through whole or not at all.
    if (departures && ctx.existing) {
      const current = await prisma.tripDate.findMany({
        where: { tripId: ctx.existing.id },
        include: { _count: { select: { bookings: true } } },
      });
      for (const [index, row] of departures.entries()) {
        const match = current.find((departure) => departure.id === row.id);
        if (!match) continue;
        const taken = typeof row.seatsBooked === 'number' ? row.seatsBooked : match.seatsBooked;
        if (Number(row.capacity) < taken) {
          throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', {
            [`departures.${index}.capacity`]: `${taken} seats are already taken.`,
          });
        }
        // Seats held by live applications on the site can only be released by
        // deciding those applications, never by editing the number.
        const held = await prisma.booking.aggregate({
          where: { tripDateId: match.id, status: { in: ['APPLIED', 'PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED'] } },
          _sum: { travellers: true },
        });
        if (taken < (held._sum.travellers ?? 0)) {
          throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', {
            [`departures.${index}.seatsBooked`]: `${held._sum.travellers} places are held by applications on the site.`,
          });
        }
      }
      for (const [index, row] of departures.entries()) {
        if (!row.id && typeof row.seatsBooked === 'number' && row.seatsBooked > Number(row.capacity)) {
          throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', {
            [`departures.${index}.seatsBooked`]: 'More than the seats available.',
          });
        }
      }
      const kept = new Set(departures.map((row) => row.id).filter(Boolean));
      if (current.some((departure) => !kept.has(departure.id) && departure._count.bookings > 0)) {
        throw new ApiError(
          409,
          'A departure you removed already has applications or bookings. Close it to new bookings instead of removing it.',
          'departure_in_use',
        );
      }
    }
  },
  async afterSave(ctx, record) {
    const virtual = ((ctx as any).virtual ?? {}) as Row;

    if (Array.isArray(virtual.departures)) {
      const current = await prisma.tripDate.findMany({
        where: { tripId: record.id },
        include: { _count: { select: { bookings: true } } },
      });
      const keep = new Set<string>();
      for (const row of virtual.departures as Row[]) {
        const match = row.id ? current.find((departure) => departure.id === row.id) : undefined;
        const capacity = Number(row.capacity);
        const data = {
          startDate: new Date(row.startDate),
          endDate: new Date(row.endDate),
          capacity,
          price: row.price ?? null,
          bookingDeadline: row.bookingDeadline ? new Date(row.bookingDeadline) : null,
          expectedParticipants: row.expectedParticipants ?? null,
        };
        if (match) {
          const taken = typeof row.seatsBooked === 'number' ? row.seatsBooked : match.seatsBooked;
          keep.add(match.id);
          await prisma.tripDate.update({
            where: { id: match.id },
            data: {
              ...data,
              seatsBooked: taken,
              status: row.status === 'CLOSED' ? 'CLOSED' : departureStatus(taken, capacity),
            },
          });
        } else {
          const taken = typeof row.seatsBooked === 'number' ? row.seatsBooked : 0;
          const created = await prisma.tripDate.create({
            data: { ...data, seatsBooked: taken, tripId: record.id, status: row.status === 'CLOSED' ? 'CLOSED' : departureStatus(taken, capacity) },
          });
          keep.add(created.id);
        }
      }
      for (const departure of current) {
        if (keep.has(departure.id)) continue;
        if (departure._count.bookings > 0) {
          throw new ApiError(
            409,
            'A departure you removed already has applications or bookings. Close it to new bookings instead of removing it.',
            'departure_in_use',
          );
        }
        await prisma.tripDate.delete({ where: { id: departure.id } });
      }
    }

    if (Array.isArray(virtual.itinerary)) {
      await prisma.itineraryDay.deleteMany({ where: { tripId: record.id } });
      for (const [index, day] of (virtual.itinerary as Row[]).entries()) {
        await prisma.itineraryDay.create({
          data: {
            tripId: record.id,
            dayNumber: index + 1,
            title: String(day.title ?? `Day ${index + 1}`),
            label: day.label || null,
            summary: day.summary || null,
            accommodation: day.accommodation || null,
            stops: JSON.stringify(day.stops ?? []),
            activities: JSON.stringify(((day.stops ?? []) as Row[]).map((stop) => stop.name).filter(Boolean)),
          },
        });
      }
    }
  },
  async loadVirtual(record) {
    const departuresField = resource.fields.find((field) => field.name === 'departures')!;
    const itineraryField = resource.fields.find((field) => field.name === 'itinerary')!;
    const departures = (record.departures ?? []).map((departure: Row) => ({
      id: departure.id,
      startDate: departure.startDate,
      endDate: departure.endDate,
      capacity: departure.capacity,
      seatsBooked: departure.seatsBooked,
      price: departure.price,
      bookingDeadline: departure.bookingDeadline,
      expectedParticipants: departure.expectedParticipants,
      status: departure.status === 'CLOSED' ? 'CLOSED' : 'OPEN',
    }));
    const itinerary = (record.itinerary ?? []).map((day: Row) => ({
      title: day.title,
      label: day.label,
      summary: day.summary,
      accommodation: day.accommodation,
      stops: JSON.stringify(safeArray(day.stops)),
    }));
    return {
      departures: virtualToForm(departuresField, departures, record),
      itinerary: virtualToForm(itineraryField, itinerary, record),
    };
  },
  async beforeDelete(record) {
    const bookings = await prisma.booking.count({ where: { tripId: record.id } });
    if (bookings > 0) {
      throw new ApiError(409, 'This trip has applications or bookings, so it is kept for the records. Archive it instead.', 'in_use');
    }
  },
});

function safeArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const eventHooks = (resource: ResourceDef): ResourceHooks => ({
  include: { country: true, city: true, category: true, tickets: { orderBy: { sortOrder: 'asc' } } },
  async beforeSave(ctx, data) {
    (ctx as any).virtual = await virtualValues(resource, ctx.input, ctx.existing);
    const start = data.startsAt ?? ctx.existing?.startsAt;
    const end = data.endsAt ?? ctx.existing?.endsAt;
    if (start && end && new Date(end) < new Date(start)) {
      throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', { endsAt: 'Ends before it starts.' });
    }
  },
  async afterSave(ctx, record) {
    const rows = ((ctx as any).virtual ?? {}).tickets as Row[] | undefined;
    if (!Array.isArray(rows)) return;
    const current = await prisma.eventTicket.findMany({
      where: { eventId: record.id },
      include: { _count: { select: { registrations: true } } },
    });
    const keep = new Set<string>();
    for (const [index, row] of rows.entries()) {
      const match = row.id ? current.find((ticket) => ticket.id === row.id) : undefined;
      const data = {
        name: String(row.name ?? 'Ticket'),
        description: row.description || null,
        price: Number(row.price ?? 0),
        currency: String(row.currency ?? 'TZS'),
        capacity: row.capacity ?? null,
        active: row.active !== false,
        sortOrder: index,
      };
      if (match) {
        if (data.capacity !== null && data.capacity < match.sold) {
          throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', {
            [`tickets.${index}.capacity`]: `${match.sold} already sold.`,
          });
        }
        keep.add(match.id);
        await prisma.eventTicket.update({ where: { id: match.id }, data });
      } else {
        const created = await prisma.eventTicket.create({ data: { ...data, eventId: record.id } });
        keep.add(created.id);
      }
    }
    for (const ticket of current) {
      if (keep.has(ticket.id)) continue;
      if (ticket._count.registrations > 0) {
        await prisma.eventTicket.update({ where: { id: ticket.id }, data: { active: false } });
      } else {
        await prisma.eventTicket.delete({ where: { id: ticket.id } });
      }
    }
  },
  async loadVirtual(record) {
    const field = resource.fields.find((item) => item.name === 'tickets')!;
    return { tickets: virtualToForm(field, record.tickets ?? [], record) };
  },
  async beforeDelete(record) {
    const registrations = await prisma.eventRegistration.count({ where: { eventId: record.id } });
    if (registrations > 0) {
      throw new ApiError(409, 'This event has registrations, so it is kept for the records. Archive it instead.', 'in_use');
    }
  },
});

const GEO_INCLUDE = { country: true, city: true, category: true };

export function hooksFor(resource: ResourceDef): ResourceHooks {
  switch (resource.key) {
    case 'trips':
      return tripHooks(resource);
    case 'events':
      return eventHooks(resource);
    case 'activities':
      return {
        include: GEO_INCLUDE,
        async beforeSave(ctx, data) {
          if (!ctx.existing) data.createdById = ctx.req.auth?.id ?? null;
          const capacity = data.capacity ?? ctx.existing?.capacity;
          const taken = data.spotsTaken ?? ctx.existing?.spotsTaken ?? 0;
          if (capacity && taken > capacity) {
            throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', { spotsTaken: 'More than the spaces available.' });
          }
        },
      };
    case 'places':
    case 'experiences':
      return {
        include: GEO_INCLUDE,
        async beforeDelete(record) {
          if (resource.key === 'places') {
            const deals = await prisma.deal.count({ where: { placeId: record.id } });
            if (deals > 0) throw new ApiError(409, 'Deals are linked to this place. Remove them first, or archive the place.', 'in_use');
          }
        },
      };
    case 'stories':
    case 'deals':
    case 'challenges':
    case 'polls':
      return {
        include: { country: true, city: true },
        async beforeSave(_ctx, data) {
          if (resource.key === 'polls' && typeof data.options === 'string' && JSON.parse(data.options).length < 2) {
            throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', { options: 'Give at least two choices.' });
          }
        },
      };
    case 'impact':
      return {
        async beforeSave(ctx, data) {
          if ('goal' in data && (data.goal === null || data.goal === undefined)) data.goal = 0;
          if (!ctx.existing && data.goal === undefined) data.goal = 0;
          if ('country' in data && !data.country) data.country = 'Tanzania';
        },
        async beforeDelete(record) {
          const donations = await prisma.donation.count({ where: { projectId: record.id } });
          if (donations > 0) throw new ApiError(409, 'This project has donation records, so it is kept. Archive it instead.', 'in_use');
        },
      };
    case 'categories':
      return { slugScope: ['kind'] };
    case 'cities':
      return {
        include: { country: true },
        slugScope: ['countryId'],
        async beforeDelete(record) {
          const used = await Promise.all([
            prisma.activity.count({ where: { cityId: record.id } }),
            prisma.place.count({ where: { cityId: record.id } }),
            prisma.event.count({ where: { cityId: record.id } }),
            prisma.trip.count({ where: { cityId: record.id } }),
          ]);
          if (used.some((count) => count > 0)) throw new ApiError(409, 'Listings use this city. Archive it instead.', 'in_use');
        },
      };
    case 'countries':
      return {
        async beforeSave(ctx, data) {
          if (!ctx.existing) {
            const code = String(data.code ?? '').toUpperCase();
            if (!/^[A-Z]{2}$/.test(code)) {
              throw new ApiError(422, 'Please check the highlighted fields.', 'validation_error', { code: 'Two letters, e.g. NG.' });
            }
            data.code = code;
          }
        },
      };
    default:
      return {};
  }
}

/** Models with a `publishedAt` column, stamped the first time they go live. */
export const HAS_PUBLISHED_AT = new Set(['activity', 'place', 'experience', 'event', 'cateringPackage', 'story', 'deal', 'challenge', 'trip']);
