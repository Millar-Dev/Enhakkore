# Deployment

Enhakkore is three things that have to know about each other:

```
PostgreSQL   the data          → Neon          free
apps/api     Express + Prisma  → Render        free
apps/web     Next.js           → Vercel        free
```

**The web app cannot work alone.** Every trip, project and figure it shows comes
from the API. Deploy only the front end and you get the layout and the empty
states — nothing else.

Work in the order below. Each step produces a value the next one needs.

---

# Part 1 — Walkthrough

Roughly 30 minutes, no card required at any point.

## Step 1 · Database (Neon)

1. Go to <https://neon.tech> and sign up with GitHub.
2. **Create project.** Name it `enhakkore`. Region: pick the one nearest you —
   `AWS eu-central-1 (Frankfurt)` is the closest to East Africa.
3. When it finishes, Neon shows a **connection string**. Copy it. It looks like:

   ```
   postgresql://enhakkore_owner:npg_XXXXXXXX@ep-cool-name-123456.eu-central-1.aws.neon.tech/enhakkore?sslmode=require
   ```

4. Keep that tab open, or paste it somewhere safe. This is `DATABASE_URL`.

> Treat it like a password. Anyone holding it can read and delete your data.
> Never commit it, never paste it into a chat or an issue.

## Step 2 · Create the tables and load the demo content

**You do not write any SQL, and you do not touch Neon's editor.** Neon gives you
an empty database; Prisma creates all 23 tables from `apps/api/prisma/schema.prisma`.

### 2a · Put the connection string in a file

Create `apps/api/.env.production` with one line — your string from Step 1:

```bash
DATABASE_URL="postgresql://…your neon string…"
```

There is an `.env.production.example` next to it to copy. The real file is
gitignored, so it cannot be committed.

> Why a file rather than typing it on the command line: `DATABASE_URL="…" npm run …`
> is Bash syntax. In PowerShell or cmd it fails in a confusing way.

### 2b · Create the tables

From the repository root:

```bash
npm run remote:push
```

### 2c · Load the demonstration content

```bash
npm run remote:seed
```

You should see the counts — 18 users, 11 trips, 6 projects.

Both commands print which database they are targeting, with the password
redacted, so you can confirm before anything happens. They switch the schema to
Postgres, do the work, and restore your local SQLite setup afterwards — even if
they fail. `npm run dev` keeps working exactly as before.

To look at what landed, `npm run remote:studio` opens a browser table view.

> **On seeding a deployed database.** This is a demonstration deployment, so
> seeding is the right call: an empty site shows nobody anything, and every
> figure it creates is labelled as demo content in the interface. When you take
> real bookings, start from an empty database and never run the seed against it.

## Step 3 · API (Render)

1. Go to <https://render.com> and sign up with GitHub.
2. **New → Web Service**, and connect the `Millar-Dev/Enhakkore` repository.
   Grant Render access to it when GitHub asks.
3. Settings:

   | Field | Value |
   |---|---|
   | Name | `enhakkore-api` |
   | Region | Frankfurt |
   | Branch | `main` |
   | Root Directory | *(leave empty)* |
   | Runtime | Node |
   | Build Command | `npm install && npm run build:api` |
   | Start Command | `npm run start --workspace @enhakkore/api` |
   | Instance Type | Free |

4. **Advanced → Health Check Path:** `/api/health`
5. Add the environment variables from Part 2 below. Leave `CORS_ORIGIN` as
   `http://localhost:3000` for now — you do not have the Vercel URL yet.
6. **Create Web Service.** First build takes 3–5 minutes.
7. When it goes live, Render gives you a URL like
   `https://enhakkore-api.onrender.com`. Open `<that URL>/api/health`. You want:

   ```json
   {"status":"ok","payments":{"provider":"mock","live":false},"demoData":true}
   ```

   Copy that base URL — the next step needs it.

> **Render's free tier sleeps** after 15 minutes of no traffic, and the next
> request takes ~50 seconds to wake it. Fine for sharing a link; annoying in a
> live demo. Open the API URL a minute before you present, or move to Render's
> $7/month Starter plan, which does not sleep.

## Step 4 · Web (Vercel)

1. In your existing Vercel project → **Settings → General**.
2. **Root Directory:** clear it so it is the repository root, **not** `apps/web`.
   This is what caused your build failure.
3. **Settings → Environment Variables.** Add the two from Part 2, using your
   Render URL. Note `NEXT_PUBLIC_API_URL` ends in `/api` and
   `NEXT_PUBLIC_REALTIME_URL` does not.
4. **Deployments → Redeploy.** Both variables are read in the browser, so they
   must be present *at build time* — setting them without redeploying changes
   nothing.
5. Vercel gives you a URL like `https://enhakkore.vercel.app`. Copy it.

## Step 5 · Close the loop

The API is still only accepting requests from `localhost`, so the live site will
fail on anything signed-in.

1. Render → your service → **Environment**.
2. Change `CORS_ORIGIN` to your Vercel URL, with no trailing slash:

   ```
   https://enhakkore.vercel.app
   ```

3. Save. Render redeploys automatically.

## Step 6 · Check it

Open your Vercel URL. You should see trips on the homepage. Then sign in with
`michael@traveller.demo` / `Enhakkore2026!` and open **My trips** — that proves
the database, the API, CORS and authentication are all talking to each other.

If the homepage renders but has no trips, the browser console will say which of
the two things is wrong: a CORS error means Step 5; a failed request to
`localhost:4000` means Step 4 did not take, so redeploy.

---

# Part 2 — The environment variables

## Render (the API)

Render lets you paste several at once — use **Add from .env**.

```bash
NODE_ENV=production
DATABASE_URL=postgresql://REPLACE_WITH_YOUR_NEON_CONNECTION_STRING
JWT_SECRET=REPLACE_WITH_YOUR_GENERATED_SECRET
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
SEED_DEMO_DATA=false
PAYMENT_PROVIDER=mock
```

Notes:

- **`DATABASE_URL`** — the Neon string from Step 1.
- **`JWT_SECRET`** — signs session tokens. Generate your own:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

  The API refuses to start in production if this is left as the development
  placeholder (`apps/api/src/env.ts`). If you ever change it, everyone is
  signed out — that is the point of it.
- **`CORS_ORIGIN`** — replace with the Vercel URL in Step 5. Comma-separate for
  several origins. No trailing slash.
- **`PORT`** — do not set it. Render assigns one and the API reads it.

## Vercel (the web app)

```bash
NEXT_PUBLIC_API_URL=https://enhakkore-api.onrender.com/api
NEXT_PUBLIC_REALTIME_URL=https://enhakkore-api.onrender.com
```

Replace both hosts with your actual Render URL. The `/api` suffix on the first
one matters — the API mounts every route under it.

Anything prefixed `NEXT_PUBLIC_` is compiled into the JavaScript sent to the
browser, so it is public by definition. Never put a secret behind that prefix.

---

# Part 3 — Reference

## Why the API is not on Vercel

- **Long-lived connections.** Socket.IO backs the trip group chat. Serverless
  functions cannot hold a websocket open.
- **Connection pooling.** Prisma expects a process that survives between
  requests.
- **SQLite is development-only.** Serverless filesystems are ephemeral and
  read-only; the seeded `dev.db` cannot travel with the code.

## How the database provider is chosen

`apps/api/scripts/sync-datasource.js` reads `DATABASE_URL` and sets the Prisma
provider to match — `postgresql://` → `postgresql`, `file:` → `sqlite`. It runs
before every generate, push and build.

So the same repository runs on SQLite locally and Postgres on Render with no
edit and nothing to remember. The committed schema stays `sqlite`; the host
rewrites it during its own build.

## Deploying by blueprint instead

`render.yaml` at the repository root describes the service. Render Dashboard →
**New → Blueprint** → point at the repository, then fill in the three values
marked `sync: false`. Same result as Step 3, fewer fields to type.

## Verifying

```bash
curl https://your-api.onrender.com/api/health
curl https://your-api.onrender.com/api/trips
```

## Costs

| | Free tier | When you outgrow it |
|---|---|---|
| Neon | 0.5 GB storage | ~$19/mo |
| Render | sleeps after 15 min idle | $7/mo Starter, always on |
| Vercel | generous for this | $20/mo Pro |

Nothing here needs a card to start.

## What is still missing for real operation

Deploying makes the platform reachable. It does not make it ready to take money.

1. **A payment provider.** `PAYMENT_PROVIDER=mock` settles nothing. Implement
   `PaymentGateway` (`apps/api/src/services/payments/types.ts`) and register it.
2. **Terms and a privacy policy**, drafted and reviewed. `/legal/*` currently
   says plainly that they are outstanding.
3. **Email delivery.** `services/notifications.ts` writes in-app notifications
   only; it is the single fan-out point when you add email or push.
4. **File upload** for organizer documents and trip images — both take URLs now.
5. **Backups and monitoring** on the database.
6. **A real verification check** on your first operators.
7. **Licensed photography** replacing the placeholders catalogued in
   `apps/api/prisma/images.ts`.

Until 1 and 2 are done, keep every pre-launch disclosure in the interface.
