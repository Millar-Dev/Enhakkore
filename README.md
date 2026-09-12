# ENHAKKORE — Travel & Impact

**Travel together. Experience more. Give back.**

A travel marketplace and social-impact platform. Travellers discover trips, join
other travellers on them, and can direct a contribution to a named community
project. Independent tour operators list and run the trips; Enhakkore connects
the two sides and takes a commission on confirmed bookings.

It begins in Tanzania, but nothing in the architecture is hard-coded to it.

```
DISCOVER  →  JOIN  →  CONNECT  →  TRAVEL  →  GIVE BACK
```

---

## ⚠ This is a pre-launch build

Read this before showing the site to anyone.

- **No payment provider is connected.** Checkout runs through an in-process
  simulator. Every payment record it writes is flagged `simulated` and surfaced
  as such in the UI. No money moves.
- **No organisation has been verified.** The "Verified operator" badge on demo
  accounts was set by the seed script, not by a real check.
- **No funds have been raised or disbursed.** Impact totals, contributor counts
  and project progress are demonstration data.
- **Reviews are fictional.** They are seeded, and labelled as demo content.

The interface says all of this in the places where a visitor might otherwise
assume otherwise — the footer, the impact pages, the checkout, the admin
payments screen and `/trust`. Keep those disclosures until the corresponding
thing is genuinely true.

---

## Quick start

Requires Node 20+ (developed on Node 26).

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
npm run db:push
npm run db:seed
npm run dev
```

- Web — <http://localhost:3000>
- API — <http://localhost:4000/api>

### Demo accounts

All use the password `Enhakkore2026!`

| Role | Email | What it shows |
|---|---|---|
| Admin | `admin@enhakkore.com` | Review queues, platform reporting, impact administration |
| Operator | `trips@tanzuexpeditions.demo` | Verified — runs the Mikumi trip, has bookings and a live group |
| Operator | `team@baharinomad.demo` | Pending verification — shows the blocked state |
| Traveller | `michael@traveller.demo` | Bookings, a trip group with history, impact contributions |
| Traveller | `sarah@traveller.demo` | A second traveller in the same group |

The sign-in page lists these and fills them in on one click.

---

## What is built

### Traveller
Browse and filter the marketplace · trip detail with itinerary, inclusions,
organizer profile and who else is going · checkout with an optional impact
contribution · booking confirmation and management · cancellation with refund ·
per-departure private group chat with organizer announcements · impact history ·
saved trips · reviews tied to completed bookings · custom trip requests.

### Tour operator
Account creation · verification submission · create-trip flow (basics →
itinerary → inclusions → dates) · draft and submit-for-review lifecycle ·
departure management with live seat counts · booking list with traveller
details · announcements that notify a whole departure · revenue and commission
reporting.

### Admin
Work queue · organizer verification decisions · trip listing review · booking
management and refunds · payment ledger · impact project creation and progress
updates · user management and suspension · custom trip request pipeline ·
platform reporting.

---

## Architecture

```
enhakkore/
├── apps/
│   ├── api/          Express + Prisma + SQLite + JWT + Socket.IO
│   │   ├── prisma/   schema, demo seed, image catalogue
│   │   └── src/
│   │       ├── routes/        one router per resource
│   │       ├── services/      bookings, payments, notifications, stats
│   │       ├── serializers/   Prisma rows → wire DTOs
│   │       ├── middleware/    auth, role guards, error handling
│   │       └── realtime/      socket layer for trip groups
│   └── web/          Next.js 15 App Router + React 19 + Tailwind 4
│       └── src/
│           ├── app/          routes
│           ├── components/   ui primitives, layout, trips, impact, brand
│           └── lib/          api client, session, formatting
└── packages/
    └── shared/       domain vocabulary, money primitives, DTOs
```

### Decisions worth knowing

**Money is never a float.** Every amount is an integer in the currency's minor
unit, stored alongside its currency code. `packages/shared/src/money.ts` holds
the currency registry; adding a market is a row there plus an FX source.

**Public pages render on the server, signed-in areas on the client.** The
marketplace is server-rendered for speed and indexing. Account, organizer and
admin areas are client components using the session context. The split is the
reason a cold trip page is fast and a dashboard is interactive.

**The DTOs in `@enhakkore/shared` are the contract.** Both apps import them, so
changing a serializer without updating its consumer is a compile error rather
than a runtime surprise.

**Seat allocation is transactional.** `createBooking` claims seats with a
conditional `updateMany` inside a transaction, so two people checking out for the
last seat cannot both succeed. The loser gets "those seats were just taken",
not an oversold departure.

**Commission excludes impact contributions.** The platform's cut is calculated on
travel value only, and is written to its own ledger row (`PlatformCommission`)
rather than derived on the fly — so a rate change never rewrites history.
Cancellations reverse the row instead of deleting it.

**Payment providers plug into one seam.** `PaymentGateway` in
`apps/api/src/services/payments/types.ts` is the whole interface. Adding M-Pesa,
Airtel Money, Tigo Pesa or a card processor means writing one adapter and
registering it — no route, service or UI change.

**Trip groups are gated on bookings.** Membership comes from a confirmed booking
on that departure, or from organising the trip. Requesting a group you are not in
returns 404, not 403, so group existence cannot be probed.

**Reviews require a completed booking.** Enforced by a unique constraint on
`bookingId` and by the route. This is why there are few of them and why they are
worth reading.

---

## Database

SQLite for zero-setup development. Prisma does not support enums or JSON columns
on SQLite, so status fields are strings constrained by the unions in
`@enhakkore/shared`, and structured lists are JSON strings read through
`apps/api/src/lib/json.ts`.

**Moving to PostgreSQL:** change `provider` in `apps/api/prisma/schema.prisma`,
point `DATABASE_URL` at your instance, and run `npx prisma migrate dev`. Column
types are already compatible. Optionally convert the JSON-string columns to
native `Json` and simplify `lib/json.ts` to pass-throughs.

### Core entities

`User` · `Organizer` · `OrganizerVerification` · `Payout` · `Destination` ·
`Trip` · `ItineraryDay` · `TripDate` · `SavedTrip` · `Booking` ·
`BookingTraveller` · `Payment` · `PlatformCommission` · `Review` ·
`Conversation` · `ConversationMember` · `Message` · `ImpactProject` ·
`Donation` · `ImpactUpdate` · `CustomTripRequest` · `Notification` ·
`PlatformSetting`

Key relationships: one organizer → many trips · one trip → many dated departures
→ many bookings · one departure → exactly one private group → many members ·
one impact project → many donations and many dated updates · one booking → at
most one review.

### Commands

```bash
npm run db:push     # apply schema without a migration
npm run db:seed     # load demonstration content
npm run db:reset    # wipe, re-apply, re-seed
npm run db:studio -w @enhakkore/api   # browse the data
```

---

## Imagery

Demo photography is served from Unsplash and catalogued in
`apps/api/prisma/images.ts`, where each key is named for what is actually in the
frame. It is generic travel and landscape photography — **not** pictures of any
Enhakkore trip, operator, community or project.

Before launch, replace it with commissioned photography on your own CDN and
update `images.remotePatterns` in `apps/web/next.config.ts`.

Avatars are rendered from initials rather than stock portraits, so no real
person's face stands in for a fictional traveller.

---

## Design system

Defined once in `apps/web/src/app/globals.css` as Tailwind v4 `@theme` tokens.

White ground, generous space, strong typographic hierarchy. Colour is used
sparingly and always means something:

| Token | Role |
|---|---|
| `ink` | Structure, primary action, headings |
| `acacia` | The brand — the mark, links, "this is Enhakkore" |
| `clay` | Impact only — contributions and progress toward a goal |
| `sand` | Quiet surfaces that separate without a line |

Type is Plus Jakarta Sans with negative tracking on display sizes. Primitives
live in `apps/web/src/components/ui`.

The brand mark is a spring — the name's meaning — drawn as ripples moving out
from a source, with one line leaving the centre and travelling beyond them.
Three elements, so it survives 16px as a favicon and a circular crop as an
avatar.

---

## Security

- Passwords hashed with bcrypt (cost 12). Login compares against a dummy hash
  when the account does not exist, so timing and response cannot enumerate
  accounts.
- Every request re-reads the user's live role and status rather than trusting the
  token's claims, so a suspension takes effect immediately.
- Role guards on every non-public route. A traveller reaching `/api/admin/*`
  gets 403; an anonymous request gets 401.
- Organizers can only ever read or write their own trips and bookings.
- Rate limiting globally, and tighter on credential endpoints.
- Helmet, CORS restricted to configured origins, 1MB body cap.
- No card numbers, bank credentials or mobile-money PINs are collected or stored
  anywhere in the codebase.

Client-side role checks exist for UX only. The API decides independently.

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | API and web together |
| `npm run build` | Build all three packages |
| `npm run typecheck` | TypeScript across the workspace |
| `npm run setup` | install + db:push + db:seed |

---

## Before going live

1. Write and review real terms and a privacy policy (`/legal/*` currently says
   plainly that they are outstanding).
2. Connect a payment provider — implement `PaymentGateway`, register it, set
   `PAYMENT_PROVIDER`.
3. Move to PostgreSQL and take backups.
4. Replace demo imagery with licensed photography.
5. Wire email and push notification delivery — `services/notifications.ts` is
   the single fan-out point.
6. Connect file upload for organizer documents and trip images.
7. Set a real `JWT_SECRET`; the API refuses to boot in production with the
   placeholder.
8. Run a real verification check on the first operators.
9. Remove the demo seed and every demo disclosure the data no longer needs.

---

## Roadmap

International expansion beyond East Africa · operator quoting on custom trip
requests · richer traveller community · map view of impact projects (coordinates
are already stored) · loyalty and rewards · mobile apps · personalised
recommendations · deeper impact reporting and third-party audit.

The foundation for each of these is in the data model already.
