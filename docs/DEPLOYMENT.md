# Deployment

Enhakkore is three pieces that have to know about each other:

```
PostgreSQL  (the data)          → Neon     free
apps/api    (Express + Prisma)  → Render   free
apps/web    (Next.js)           → Vercel   free
```

The web app cannot work on its own. Every trip, project and number it shows
comes from the API, and the API gets them from the database.

You never run a database command. The Render build creates every table itself
and, on a brand-new empty database only, loads the demonstration content.

Work through the parts **in order**. Each one gives you something the next one
needs. Checked against each site's documentation in September 2026.

---

## Part A · Neon: copy your connection string (5 minutes)

1. Go to <https://console.neon.tech> and sign in.
2. Open your project.
3. Click **Connect**, near the top of the page. A window called
   **Connect to your branch** opens.
4. Leave **Branch**, **Compute**, **Database** and **Role** as they are.
5. Turn the **Connection pooling** switch **OFF**. It is on by default. With it
   off, the address no longer contains `-pooler`.
6. Copy the connection string with the copy button. It starts with
   `postgresql://` and contains your password, beginning `npg_`. If you see
   `****` where the password should be, reveal it first, or use the copy button,
   which copies the real value.
7. On your computer, open `D:\Enhakkore\.env.render` in Notepad. (File Explorer
   → `D:\Enhakkore` → right-click `.env.render` → **Open with** → **Notepad**.)
8. Replace `PASTE_YOUR_NEON_CONNECTION_STRING_HERE` with the string. Save.

> `.env.render` is gitignored, so it cannot be committed. It already contains
> a freshly generated `JWT_SECRET`. The connection string is a password: do not
> paste it into chats, issues or screenshots.

---

## Part B · Vercel: fix the build and get your address (10 minutes)

1. Go to <https://vercel.com> and sign in. Open your **Enhakkore** project.
2. Click **Settings** in the sidebar, then **Build and Deployment**.
3. Under **Framework Settings**, check that **Framework Preset** is **Next.js**.
   Make sure the **Override** switches next to **Build Command**,
   **Output Directory** and **Install Command** are all **off**.
4. Scroll to **Root Directory**. Type `apps/web` and click **Save**.

   > This is what caused your original build error. `apps/web` is the folder
   > whose `package.json` lists Next.js. The repository root does not, and
   > Vercel then fails with "No Next.js version detected".

5. Click **Deployments** in the sidebar. On the top deployment, click the
   **⋯** menu, then **Redeploy**, then **Redeploy** again to confirm.
6. Wait 2–4 minutes until the status says **Ready**.
7. Go back to the project's main page. Under **Domains**, copy the address.
   It looks like `https://enhakkore.vercel.app`.
8. In `.env.render`, replace `PASTE_YOUR_VERCEL_ADDRESS_HERE` with that address.
   Save.

**Check:** open the address. You should see the Enhakkore homepage design with
no trips on it yet. That is expected: the API does not exist yet.

---

## Part C · Render: deploy the API (15 minutes, most of it waiting)

1. Go to <https://render.com> and click **Get Started**. Sign up with
   **GitHub** and approve the access request.
2. In the Render Dashboard, click **+ New**, then **Web Service**.
3. Under **Git Provider**, choose **GitHub**. If `Enhakkore` is not listed:
   1. Click **Configure account** (or **Connect GitHub**). GitHub opens.
   2. Choose your account, **Millar-Dev**.
   3. Select **Only select repositories**, pick **Millar-Dev/Enhakkore**, then
      click **Install** (or **Save**).
   4. You are sent back to Render, and the repository now appears.
4. Click **Enhakkore**, then **Connect**.
5. Fill in the form exactly:

   | Field | Value |
   |---|---|
   | Name | `enhakkore-api` |
   | Project | leave empty |
   | Language | `Node` |
   | Branch | `main` |
   | Region | **Frankfurt (EU Central)** |
   | Root Directory | leave **empty** |
   | Build Command | `npm install --include=dev && npm run deploy:api` |
   | Start Command | `npm run start --workspace @enhakkore/api` |
   | Instance Type | **Free** |

6. Under **Environment Variables**, click **Add from .env**. Paste the **entire**
   contents of `.env.render` (Notepad: Ctrl+A, then Ctrl+C) and confirm. You
   should see 7 variables. If there is no **Add from .env** button, click
   **+ Add Environment Variable** once per line: the part before `=` is the
   **Key**, the part after is the **Value**.
7. Open **Advanced**. Set **Health Check Path** to `/api/health`.
8. Click the button at the bottom (**Deploy Web Service**).
9. Watch the log. The first build takes 5–8 minutes. You want to see:

   ```
   › empty database — loading demonstration content
   ```

   and then **Your service is live**.

10. Copy the address at the top of the page, e.g.
    `https://enhakkore-api.onrender.com`.

**Check:** open that address with `/api/health` on the end. You should see
something beginning `{"status":"ok"`.

> You should not need a card for the **Free** instance. If Render asks for
> payment details, stop and ask rather than entering them.

---

## Part D · Vercel: connect the website to the API (5 minutes)

1. Vercel → your project → **Environment Variables** (sidebar).
2. Click **Add Environment Variable**.
3. **Name:** `API_URL`
4. **Value:** your Render address from Part C, e.g. `https://enhakkore.onrender.com`.
   Copy it from the top of your Render service page. Adding `/api` is optional;
   both work.
5. Type: **Config** or **Secret** both work for `API_URL`. **Config** is better:
   the address is not secret, and you will be able to read it back later.
6. Environments: tick **Production** and **Preview**. Click **Save**.
7. **Deployments** → **⋯** on the top deployment → **Redeploy** → **Redeploy**.

   > Required. Vercel only uses a variable in deployments made *after* it was
   > saved.

8. Wait until it says **Ready**.

> **Why `API_URL` and not `NEXT_PUBLIC_API_URL`:** Vercel refuses a
> `NEXT_PUBLIC_` variable created with the **Secret** type, because anything
> named `NEXT_PUBLIC_` is sent to every visitor's browser. The website accepts
> either name. `NEXT_PUBLIC_API_URL` also works if you create it as **Config**.
> Any other name, such as `NEXT_RENDER_API_URL`, is ignored.

> **The website needs only this one variable.** `DATABASE_URL`, `JWT_SECRET`,
> `NODE_ENV`, `PORT` and the rest belong on **Render**, not Vercel. If you
> added them to Vercel, delete them there (**⋯** → **Delete**). They do nothing
> for the website and only widen who can reach your database password.

---

## Part E · Check everything works

1. Open your Vercel address. Trips, impact projects and numbers should appear.
   If the page is slow the first time, wait a minute: Render's free tier sleeps
   after 15 minutes without visitors and takes about a minute to wake up.
2. Click **Sign in**. Use `michael@traveller.demo` and `Enhakkore2026!`.
3. Open **My trips**. If bookings show, the database, API, website and sign-in
   are all connected. You are deployed.

---

## If something goes wrong

| What you see | Cause | Fix |
|---|---|---|
| Vercel: "No Next.js version detected" | Root Directory is not `apps/web` | Part B step 4, then redeploy |
| Vercel: "Can't resolve '@enhakkore/shared'" | Old settings or an old commit | Check Root Directory is `apps/web`, then redeploy the newest deployment |
| Render log: `prisma: not found` or `tsc: not found` | Build Command missing `--include=dev` | Render → Settings → Build Command, copy it again from Part C |
| Render log: `P1001 Can't reach database server` | Wrong or placeholder connection string | Part A again, then Render → **Environment** → edit `DATABASE_URL` → **Save, rebuild, and deploy** |
| Render log mentions `channel_binding` | Connection option not supported | Delete `&channel_binding=require` from `DATABASE_URL` and save |
| Render: `JWT_SECRET is still the development placeholder` | Variables not added | Part C step 6 |
| Website loads but shows no trips, or sign-in says "We could not reach Enhakkore" | `API_URL` missing, misspelled, pointing at the wrong address, or not redeployed | Part D, including the redeploy. Check the address matches your Render page exactly |
| Vercel refuses a `NEXT_PUBLIC_…` name | That name cannot be a **Secret** | Name it `API_URL` instead (Part D) |
| Browser console says **CORS** | `CORS_ORIGIN` does not match your Vercel address | Render → **Environment** → fix `CORS_ORIGIN` → **Save, rebuild, and deploy** |
| First page load takes ~1 minute | Render free tier waking up | Normal. Open the site a minute before a demo, or use Render's paid Starter plan |

---

## Reference

### What the Render build does

`npm run deploy:api` does the following:

1. Builds the shared package and the API.
2. Sets the Prisma provider from `DATABASE_URL`
   (`apps/api/scripts/sync-datasource.js`): Postgres on Render, SQLite locally,
   with no manual edit.
3. Creates or updates the tables (`prisma db push`).
4. Runs the seed with `--if-empty`. It loads demonstration content only when
   the database has no users, so a redeploy never wipes data. With
   `SEED_DEMO_DATA=false` it never seeds.

### Before taking real bookings

- Set `SEED_DEMO_DATA=false` on Render and start from an empty database.
- Connect a real payment provider: implement `PaymentGateway` in
  `apps/api/src/services/payments`. `PAYMENT_PROVIDER=mock` moves no money.
- Publish reviewed terms and a privacy policy. `/legal/*` currently says they
  are outstanding.
- Replace the placeholder photography listed in `apps/api/prisma/images.ts`.
- Keep every pre-launch disclosure in the interface until these are done.

### Optional tools

`npm run remote:push`, `remote:seed` and `remote:studio` run database commands
from your own machine against the connection string in
`apps/api/.env.production`. The deployment above does not need them.
`remote:studio` is useful for looking at the live data in a browser table.

### Costs

| | Free tier | When you outgrow it |
|---|---|---|
| Neon | 0.5 GB storage | paid plans from ~$19/month |
| Render | sleeps after 15 min idle, 750 instance hours/month | Starter ~$7/month, always on |
| Vercel | Hobby plan | Pro $20/month |
