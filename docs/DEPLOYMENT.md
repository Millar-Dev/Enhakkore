# Deployment

Enhakkore is two deployable pieces plus a database:

```
apps/web   Next.js          → Vercel (or any Next host)
apps/api   Express + Prisma → a host that runs a persistent Node process
                              (Render, Railway, Fly.io)
database   PostgreSQL       → Neon, Supabase, Railway, RDS
```

**The web app cannot work on its own.** Every trip, project and booking it shows
comes from the API. Deploying only the front end gives you a site that renders
its layout and its empty states — no trips, no projects, no numbers.

---

## Why the API needs its own host

It is not a Next.js API route set, and it should not be squeezed into one:

- **Long-lived connections.** Socket.IO backs the trip group chat. Serverless
  functions cannot hold a websocket open.
- **A real filesystem and connection pool.** Prisma with a pooled Postgres
  connection expects a process that stays alive between requests.
- **SQLite is development-only.** Serverless filesystems are ephemeral and
  read-only. The seeded `dev.db` cannot follow the code to production.

Render, Railway and Fly.io all run this shape of service on a free or cheap
tier.

---

## 1 — Database

Create a PostgreSQL database (Neon and Supabase both have a usable free tier)
and take the connection string.

Then switch Prisma's provider:

```prisma
// apps/api/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Column types are already compatible — the schema was written so this is the only
change. Then:

```bash
cd apps/api
npx prisma migrate dev --name init   # generates the first real migration
npx prisma migrate deploy            # run this on the host
```

Optionally, once you are on Postgres, convert the JSON-string columns
(`gallery`, `includes`, `allocation`, …) to native `Json` and simplify
`src/lib/json.ts` to pass-throughs. Nothing else reads the encoding.

**Do not seed demonstration data into a production database.** `npm run db:seed`
creates fictional operators, projects and contribution totals. It is for
development only.

---

## 2 — API

| Setting | Value |
|---|---|
| Root directory | repository root |
| Build command | `npm run build:api` |
| Start command | `npm run start --workspace @enhakkore/api` |
| Health check | `/api/health` |

### Environment

```bash
DATABASE_URL=postgresql://…            # your Postgres instance
NODE_ENV=production
PORT=4000                              # or whatever the host assigns
JWT_SECRET=…                           # see below — the API refuses to boot without a real one
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://your-web-domain    # comma-separated for several
SEED_DEMO_DATA=false
PAYMENT_PROVIDER=mock                  # until a real gateway is implemented
```

Generate the signing key:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`apps/api/src/env.ts` throws on boot if `NODE_ENV=production` and `JWT_SECRET`
is still the development placeholder. That is deliberate.

---

## 3 — Web (Vercel)

`vercel.json` at the repository root configures this, but the **Root Directory
in your Vercel project settings must be the repository root**, not `apps/web`.
Pointing it at `apps/web` is what causes:

```
Module not found: Can't resolve '@enhakkore/shared'
```

npm then installs only the web app's own dependencies, so the workspace sibling
is never linked or compiled.

| Setting | Value |
|---|---|
| Root directory | `.` (repository root) |
| Framework preset | Next.js |
| Install command | `npm install` |
| Build command | `npm run build:web` |
| Output directory | `apps/web/.next` |

`build:web` compiles `@enhakkore/shared` before running `next build`, and
`packages/shared` also has a `prepare` script so `npm install` builds it too.
Either path alone is enough.

### Environment

```bash
NEXT_PUBLIC_API_URL=https://your-api-domain/api
NEXT_PUBLIC_REALTIME_URL=https://your-api-domain
```

Both are read in the browser, so they must be set at **build** time, not just at
runtime. Redeploy after changing them.

---

## 4 — Order of operations

1. Create the database, take the connection string.
2. Switch the Prisma provider to `postgresql`, commit.
3. Deploy the API. Run `prisma migrate deploy`. Confirm `/api/health` responds
   and reports `"live": false` for payments.
4. Set `NEXT_PUBLIC_API_URL` on Vercel to that API's URL.
5. Deploy the web app.
6. Set `CORS_ORIGIN` on the API to the web domain. Redeploy the API.

Step 6 is easy to forget — the browser will show CORS failures on every
authenticated request until it is done.

---

## Verifying a deployment

```bash
curl https://your-api-domain/api/health
# → {"status":"ok","payments":{"provider":"mock","live":false},"demoData":false}

curl https://your-api-domain/api/trips
# → {"items":[],"total":0,…} on a fresh production database
```

A production database with no data is correct and expected. Trips appear once a
real operator is verified and publishes a listing.

---

## What is still missing for real operation

Deploying makes the platform reachable. It does not make it ready to take money.

1. **A payment provider.** `PAYMENT_PROVIDER=mock` settles nothing. Implement
   `PaymentGateway` (`apps/api/src/services/payments/types.ts`) and register it.
2. **Terms and a privacy policy**, drafted and reviewed. `/legal/*` currently
   states plainly that they are outstanding.
3. **Email delivery.** `services/notifications.ts` writes in-app notifications
   only; it is the single fan-out point when you add email or push.
4. **File upload** for organizer documents and trip images — both currently
   accept URLs.
5. **Backups and monitoring** on the database.
6. **A real verification check** on the first operators.
7. **Licensed photography** replacing the Unsplash placeholders catalogued in
   `apps/api/prisma/images.ts`.

Until 1 and 2 are done, keep every pre-launch disclosure in the interface.
