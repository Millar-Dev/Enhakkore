# API reference

Base URL: `http://localhost:4000/api`

Authentication is a bearer token: `Authorization: Bearer <token>`.

Errors are always `{ "error": { "code", "message", "fields"? } }`. Validation
failures return 422 with `fields` as a `{ path: message }` map, which the web
forms feed straight into inline errors.

Money is always `{ "amount": <integer in minor units>, "currency": "TZS" }`.

---

## Public

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | Includes `payments.live` — whether a real gateway is connected |
| `GET` | `/stats` | Public counters for the homepage; carries `isDemoData` |
| `GET` | `/trips` | Marketplace search. Published listings only |
| `GET` | `/trips/upcoming` | Trips with an open upcoming departure |
| `GET` | `/trips/:slug` | Full detail. Drafts visible only to their owner or an admin |
| `GET` | `/trips/:slug/reviews` | Paginated |
| `GET` | `/destinations` | All, with published trip counts |
| `GET` | `/destinations/search?q=` | Typeahead, min 2 characters, capped at 8 |
| `GET` | `/organizers/:slug` | Public profile plus published trips |
| `GET` | `/impact/projects` | Active, funded and completed projects |
| `GET` | `/impact/projects/:slug` | Detail with allocation, updates, linked trips |
| `GET` | `/impact/projects/:slug/updates` | Published updates only |
| `GET` | `/impact/summary` | Derived totals; carries `isDemoData` |
| `POST` | `/impact/projects/:slug/donate` | Works signed-in or as a guest |
| `POST` | `/requests` | Custom trip request |

### `GET /trips` — query parameters

`q` `destination` `country` `type` `style` `organizer` `minPrice` `maxPrice`
`minDuration` `maxDuration` `from` `to` `minGroup` `maxGroup` `availableOnly`
`featured` `sort` `page` `pageSize`

`type` and `style` accept comma-separated lists. `from`/`to`/`minGroup`/
`maxGroup`/`availableOnly` constrain the **departures** — a trip matches when at
least one of its departures qualifies.

`sort`: `recommended` (default) · `price_asc` · `price_desc` · `rating` ·
`newest` · `date`

Returns `{ items, total, page, pageSize, totalPages }`.

---

## Auth

| Method | Path | Notes |
|---|---|---|
| `POST` | `/auth/register` | `accountType: TRAVELER \| ORGANIZER`; operators also send `companyName` |
| `POST` | `/auth/login` | Rate limited to 20 per 15 minutes |
| `GET` | `/auth/session` | Re-reads the live user record |
| `POST` | `/auth/password` | Requires the current password |

Register and login return `{ token, user, organizer }`.

New operator accounts are created with `verificationStatus: UNSUBMITTED`. They
can build drafts but cannot submit a listing for review.

---

## Traveller — requires a session

| Method | Path | Notes |
|---|---|---|
| `PATCH` | `/me` | Profile |
| `GET` | `/me/stats` | Trips completed, destinations, contributions |
| `GET` | `/me/donations` | Contribution history |
| `GET` | `/me/saved` · `POST /me/saved/:tripId` | Saved trips; POST toggles |
| `GET` | `/me/notifications` · `POST /me/notifications/read` | |
| `POST` | `/me/reviews` | Requires a **completed** booking |
| `GET` | `/me/reviews` | |
| `GET` | `/bookings` | `scope=upcoming \| past \| all` |
| `GET` | `/bookings/quote/:tripDateId` | Pricing before anything is created. Returns trip context and `gateway.isLive` |
| `POST` | `/bookings` | Create and charge |
| `GET` | `/bookings/:reference` | Traveller, the trip's organizer, or an admin |
| `POST` | `/bookings/:reference/cancel` | Releases seats, refunds where possible |
| `GET` | `/requests/mine` | |

### `POST /bookings`

```json
{
  "tripDateId": "…",
  "travellers": 2,
  "impactAmount": 20000,
  "impactProjectId": "…",
  "travellerDetails": [{ "fullName": "…", "email": "…", "phone": "…" }],
  "notes": "…",
  "paymentMethod": "MOBILE_MONEY",
  "paymentInstrument": "+255…"
}
```

`travellerDetails.length` must equal `travellers`.

- **201** — payment succeeded, booking `CONFIRMED`, group joined
- **402** — payment pending or failed; the response still carries the booking
- **409** `not_enough_seats` — someone else took them first

---

## Trip groups — requires membership

| Method | Path | Notes |
|---|---|---|
| `GET` | `/conversations` | Groups the viewer belongs to, with unread counts |
| `GET` | `/conversations/:id` | Members, pinned messages, `canPost` |
| `GET` | `/conversations/:id/messages` | `limit`, `before`; marks read |
| `POST` | `/conversations/:id/messages` | `kind: TEXT \| ANNOUNCEMENT \| IMAGE` |
| `POST` | `/conversations/:id/messages/:messageId/pin` | Organizer or admin |
| `POST` | `/conversations/:id/read` | |

Requesting a group you are not in returns **404**, not 403 — group existence must
not be probeable. Only the organizer may post `ANNOUNCEMENT`. Admins can read for
moderation but cannot post.

### Realtime

Socket.IO at `ws://localhost:4000/realtime`, authenticated with the same bearer
token in `handshake.auth.token`.

```
client → conversation:join     (conversationId)   membership re-checked server-side
client → conversation:leave    (conversationId)
client → conversation:typing   (conversationId)
server → message:new           { conversationId, message }
server → conversation:joined   { conversationId }
server → conversation:error    { conversationId, message }
```

Sockets only push rows that are already persisted, so REST remains the source of
truth and a dropped connection loses nothing.

---

## Organizer — requires an organizer account

All under `/organizers/me`.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/` | Profile plus verification status |
| `PATCH` | `/` | Profile |
| `GET` | `/stats` | Bookings, revenue, commission, impact raised |
| `POST` | `/verification` | Submits for admin review. Grants nothing |
| `GET` | `/trips` | `status` filter |
| `POST` | `/trips` | `submit: true` requires a **verified** account |
| `GET` | `/trips/:id` | Own trips only |
| `PATCH` | `/trips/:id` | Editing a published listing returns it to `PENDING_REVIEW` |
| `POST` | `/trips/:id/departures` | Does not trigger re-review |
| `POST` | `/trips/:id/archive` | Refused while upcoming bookings exist |
| `GET` | `/bookings` | `status`, `tripId` filters |
| `POST` | `/announcements` | Posts to a departure's group and notifies everyone |

---

## Admin — requires an admin account

| Method | Path | Notes |
|---|---|---|
| `GET` | `/admin/stats` · `/admin/queue` | Reporting and the work queue |
| `GET` | `/admin/users` | `role`, `status`, `q` |
| `POST` | `/admin/users/:id/status` | Suspending an operator archives their listings |
| `GET` | `/admin/organizers` | Includes submitted verification details |
| `POST` | `/admin/organizers/:id/verification` | `VERIFIED \| REJECTED \| SUSPENDED`. **The only path to a badge** |
| `POST` | `/admin/organizers/:id/commission` | Negotiated rate, 0–0.5 |
| `GET` | `/admin/trips` | `status`, `q` |
| `POST` | `/admin/trips/:id/review` | Refused with `organizer_unverified` if the operator is not verified |
| `POST` | `/admin/trips/:id/feature` | Homepage placement |
| `GET` | `/admin/bookings` | `status`, `q` by reference |
| `POST` | `/admin/bookings/:id/refund` | Reverses payment, releases seats, reverses commission |
| `GET` | `/admin/payments` | Includes `simulated` and commission earned |
| `GET` `POST` `PATCH` | `/admin/impact/projects` | Allocation lines must total 100% |
| `POST` | `/admin/impact/projects/:id/updates` | Notifies every contributor |
| `GET` | `/admin/reviews` · `POST /admin/reviews/:id/visibility` | Hiding recalculates ratings |
| `GET` | `/admin/requests` · `POST /admin/requests/:id/status` | Custom trip pipeline |

---

## Rate limits

| Scope | Limit |
|---|---|
| Global | 300 requests / minute / IP |
| `/auth/register`, `/auth/login`, `/auth/password` | 20 / 15 minutes / IP |

Exceeding either returns 429 with `code: rate_limited`.

---

## Status codes

| Code | Meaning |
|---|---|
| 200 / 201 | Success |
| 400 | Malformed request |
| 401 | No session, or an invalid token |
| 402 | Payment pending or declined (the booking still exists) |
| 403 | Authenticated, but not permitted |
| 404 | Not found — **or** deliberately hidden (trip groups, unpublished trips) |
| 409 | Conflict — duplicate email, seats already taken |
| 422 | Validation failed; `fields` carries per-input messages |
| 429 | Rate limited |
| 500 | Server error; logged in full, opaque to the client |
