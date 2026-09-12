# Architecture

How the Enhakkore platform is put together, and why.

---

## The shape of the thing

Enhakkore is a **marketplace**, not a tour company with a website. That single
decision drives most of the architecture:

- Trips belong to organizers, not to the platform. Every listing carries an
  `organizerId` and every query that touches one is scoped by it.
- There is a supply side with its own workspace, a demand side with its own
  account area, and an administration layer that mediates between them.
- The platform's revenue is commission, recorded as its own ledger entity rather
  than inferred.

A second decision shapes the rest: **impact is not a separate product**. A
contribution is a line on a booking, a row in the same ledger, and a project is a
first-class entity that trips can point at. There is no separate charity system
bolted to the side.

---

## Three packages

```
packages/shared   ← domain vocabulary, money, DTOs      (no dependencies)
apps/api          ← Express + Prisma                    (depends on shared)
apps/web          ← Next.js                             (depends on shared)
```

`shared` compiles to `dist` and both apps consume it. It contains no runtime
logic beyond money formatting and a few derived helpers — it exists so the two
apps cannot disagree about what a `BookingStatus` is or what shape a `TripDetail`
has.

---

## Request lifecycle (API)

```
request
  → helmet, cors, json, rate limit
  → optionalAuth          resolve req.auth from the bearer token, never reject
  → route middleware      requireAuth / requireRole / requireOrganizer
  → zod schema            parse and coerce the body or query
  → service or prisma     the actual work
  → serializer            Prisma row → DTO from @enhakkore/shared
  → errorHandler          ZodError → 422 with field map, ApiError → its status
```

`optionalAuth` runs globally so any route can read `req.auth` when present
without opting in. Routes that *require* a session add `requireAuth` on top.

### Authorisation

The token carries a role claim, but **permissions are always decided from the
live database record**. `resolveUser` re-reads the user on every request. A
suspended or demoted account loses access on its next request, not when its token
happens to expire.

Layers, outermost first:

1. `requireAuth` — a valid token for an `ACTIVE` account
2. `requireRole(...)` / `requireOrganizer` / `requireAdmin` — account type
3. **Row-level scoping in the query itself** — an organizer's trip list is
   `where: { organizerId: req.auth.organizerId }`, not a filter applied after
   fetching

Layer 3 is the one that matters. The first two are convenience.

---

## Bookings: the critical path

`apps/api/src/services/bookings.ts` is the most important file in the codebase.

```
createBooking
  ├─ validate departure  published? open? not in the past?
  ├─ check seats         enough remaining for this party?
  ├─ price               unit × travellers, + impact contribution
  ├─ commission          rate × travel value only
  │
  ├─ TRANSACTION
  │   ├─ claim seats     conditional updateMany — the concurrency guard
  │   ├─ create booking  + traveller rows + commission row (PENDING)
  │   └─ refresh status  OPEN / FULL
  │
  ├─ charge              through the PaymentGateway seam
  ├─ record payment      always, success or failure
  │
  ├─ on success → confirmBooking
  │   ├─ status CONFIRMED
  │   ├─ commission EARNED
  │   ├─ donation row + project totals incremented
  │   └─ join (or lazily create) the departure's private group
  │
  └─ on failure → releaseBooking
      └─ seats returned immediately — a failed payment must not hold inventory
```

### The concurrency guard

```ts
await tx.tripDate.updateMany({
  where: { id, seatsBooked: { lte: capacity - travellers } },
  data:  { seatsBooked: { increment: travellers } },
});
// claimed.count === 0 means someone else took them first
```

A conditional update inside a transaction. Two people checking out for the last
seat cannot both succeed; the loser gets a clean error instead of an oversold
departure.

### Why commission is a row

`PlatformCommission` exists as its own table rather than being computed as
`booking.tripAmount * organizer.commissionRate`. If the rate is renegotiated,
historical reporting must not silently change. Cancellation sets the row to
`REVERSED` rather than deleting it, so the ledger remains an audit trail.

---

## Payments

The entire integration surface is one interface:

```ts
interface PaymentGateway {
  readonly name: string;
  readonly supports: PaymentMethod[];
  readonly isLive: boolean;          // false for anything that isn't real
  charge(request: ChargeRequest): Promise<ChargeResult>;
  refund(request: RefundRequest): Promise<RefundResult>;
}
```

Only `MockPaymentGateway` is registered today. It settles in-process, flags every
result `simulated: true`, and simulates failure paths deliberately (an amount
ending in 13 declines) so the failure UI is reachable without a sandbox.

`isLive` is surfaced through `/api/health` and the booking quote endpoint, which
is how the checkout and the admin payments screen know to state that nothing
real is happening.

**Adding a provider:** implement the interface in
`src/services/payments/providers/<name>.ts`, add it to the registry in
`payments/index.ts`, set `PAYMENT_PROVIDER=<name>`. Nothing else changes.

---

## Trip groups

One conversation per **departure**, not per trip — the people on the September
departure are not the people on the October one.

The group is created lazily on the first confirmed booking, so empty groups never
exist. Membership is derived:

- traveller with a `CONFIRMED` booking on that departure
- the organizer running the trip
- admins, read-only, for moderation

Every route goes through one `authorize()` function. A request for a group the
viewer is not in returns **404, not 403** — otherwise the response tells you the
group exists and who might be in it.

Messages are persisted over REST; the socket layer (`realtime/socket.ts`) only
pushes rows that are already saved, so a dropped connection loses nothing. The
web client currently polls while the tab is visible; swapping to sockets replaces
one function.

---

## Web rendering strategy

| Area | Rendering | Why |
|---|---|---|
| Home, explore, trip detail, impact, marketing | Server components, `revalidate` 60–120s | Fast first paint, indexable, no auth needed |
| Account, organizer, admin | Client components + session context | Personalised, interactive, no SEO value |
| Checkout, group chat | Client components | Stateful, session-bound |

`apiGet` (server) returns `null` on failure instead of throwing, so a page can
render its own "we could not load this" state rather than a 500. Every caller
handles null — that is the point.

`api.*` (client) attaches the stored bearer token and throws `ApiError` carrying
the status, a code and a field map, which forms feed straight into inline
validation.

---

## Money

Every amount is `{ amount: number, currency: string }` where `amount` is an
integer in the currency's **minor unit**. TZS has 0 decimals, USD has 2. The
registry in `packages/shared/src/money.ts` holds both.

Formatting is deterministic and dependency-free so the server and browser produce
identical strings — no hydration mismatch on a price. Dates are formatted with an
explicit UTC timezone for the same reason.

Adding a market: one row in `CURRENCIES`, plus an FX rate source when
multi-currency pricing arrives. No other code knows about TZS specifically.

---

## Status values

Prisma does not support enums on SQLite, so statuses are `String` columns
constrained by unions in `@enhakkore/shared`:

```ts
export const TRIP_STATUSES = ['DRAFT','PENDING_REVIEW','APPROVED','PUBLISHED','REJECTED','ARCHIVED'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];
```

TypeScript enforces them at both ends. Moving to PostgreSQL can convert them to
native enums with identical values.

### Lifecycles

```
Trip:      DRAFT → PENDING_REVIEW → PUBLISHED → ARCHIVED
                        ↓
                    REJECTED → (edit) → PENDING_REVIEW

Organizer: UNSUBMITTED → PENDING → VERIFIED
                            ↓         ↓
                        REJECTED   SUSPENDED → listings archived

Booking:   PENDING_PAYMENT → CONFIRMED → COMPLETED
                  ↓              ↓
              CANCELLED      REFUNDED        (both release seats)
```

Editing a published listing sends it back to `PENDING_REVIEW`. Adding a departure
date to an existing trip does not — dates are inventory, not content.

---

## Extension points

| Want to add | Touch |
|---|---|
| A payment rail | One `PaymentGateway` adapter + registry entry |
| A currency | One row in `CURRENCIES` |
| Email / SMS / push | `services/notifications.ts` — the single fan-out point |
| A new trip type or impact category | The union in `shared/src/domain.ts` + its label map |
| PostgreSQL | `provider` in `schema.prisma` + `DATABASE_URL` |
| Operator quoting on custom requests | `CustomTripRequest` already has the status pipeline |
| Map of impact projects | `latitude` / `longitude` already stored on every project |

Each of these was designed as a seam rather than discovered as one.
