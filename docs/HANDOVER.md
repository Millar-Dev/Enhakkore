# Enhakkore Travel & Impact — handover

This is the owner's guide: what was built, what was tested, what still needs
your approval or accounts, and how to run the website from your phone.

---

## 1. What has been completed

The site is organised around **four main categories — Explore, Experiences,
Travel, Impact** — with Search, Notifications and your account. The homepage
leads with an interactive globe and the brand message *Travel Further. Connect
Deeper. Create Impact.* The full requirement-by-requirement check is in
`docs/REQUIREMENTS-AUDIT.md`.

| Area | Address | What it does |
|---|---|---|
| Home | `/` | Globe hero (Explore the World · Join Enhakkore · Donate), Discover Enhakkore, What's happening now, Explore by interest, destinations, upcoming experiences and trips, Trending (real engagement only), Impact corner with WSC, Join. Order and visibility in the Homepage editor. |
| Explore | `/explore` | Stays, Food & dining, Venues & event spaces, Places & attractions. Each listing says who supplied its details; sponsored ones are labelled. **Hotel enquiry** and **restaurant reservation** forms, the business's verified WhatsApp, and its own booking link where available. |
| Experiences | `/experiences` | Search and location filters, Plan an event, Publish an activity, eight categories, upcoming and popular. **Gaming** (`/experiences/gaming`): free online tournaments and console sessions with team registration by invite code. **Communities** (`/experiences/communities`). Recurring activities with a separate registration list per session. |
| Travel | `/travel` | Trips with stages (Registration open … Trip confirmed), applications, and a **private real-time group chat** per departure (chat, trip information, itinerary, participants, documents). |
| Impact | `/impact`, `/donate` | WSC, the Mkuranga outreach, volunteering, donations (Selcom 0745341440). |
| Partner | `/partner` | Businesses apply by WhatsApp or form; your team verifies and publishes. |
| Account | `/account` | My experiences, enquiries & reservations, trip applications and groups, saved, notifications, profile. |

**The control centre** at `/admin` — see section 5.

**Your existing content was moved into the database, not lost:**
Arusha Escape (18–20 December 2026, TZS 270,000 / USD 250, 28 places, full itinerary, M-Pesa numbers, photo credits),
Napuru Gateway (24 October 2026, now shown as a **past trip**),
the Mkuranga outreach (completed, all photographs), and every logo and photo
in the media library marked "Original" (protected from deletion).
Old links such as `/packages/arusha-escape` redirect to the new pages.

**Logos.** The header, footer and every page use the original Enhakkore logo
file (`enhakkore-wordmark.webp`) and the original WSC logo (`wsc.webp`). They are
never stretched (sized by height only) and never recoloured. The earlier
recoloured copies are no longer used anywhere.

**Contacts.** Both WhatsApp numbers (+255 745 341 440 and +255 794 279 089),
Instagram (Travel and Impact) and TikTok are shown in the footer, contact page
and menu, and every WhatsApp button carries a message suited to the page.
No email, address or Facebook page is shown, because none was supplied for
the new site — you can add them in Settings → Contacts.

Contacts the **old** website listed, kept here so they are not lost (add any
you still use in Settings → Contacts): Malaysia +60 11-3936 9848,
Tanzania +255 672 302 026, and the contact email shown on the old site
(see `apps/web/src/content/contact.ts` in the git history).

---

## 2. What was tested

- **109 automated API tests pass**, including 16 for this rebuild (hotel and
  restaurant requests and their WhatsApp notice, partnerships, communities,
  tournaments and teams, weekly sessions, member submissions, two-factor
  sign-in, the popularity engine, archived trip groups), and **62 browser checks
  on an emulated Android phone**. The earlier tests: The
  new ones cover: staff can only do what their role allows (checked on the
  server); an activity added in Dar es Salaam and one in Lagos, Nigeria, each
  stored in its own time zone; Basketball as a main category; community
  submissions hidden until published; joining stops at the number of spaces;
  changing the Arusha price from the control centre; apply → approve → record
  payment → confirmed → private group opens, with income in the books; trip
  profit after a cost; event tickets that cannot be oversold, door check-in;
  spam bots refused; the donation account exactly as supplied; donations never
  counted as income; contact settings needing confirmation, with history and
  restore; revoked sessions stop working at once; partner roles see only their
  own listings; Connect requests, privacy and blocking.
- **Browser tests on an emulated Android phone (Pixel 7)**: signing in to the
  control centre, adding an activity in Lagos (including adding the city from
  the form), seeing it on the public site in Lagos time, changing a trip price,
  recording an expense, settings, media library, and opening every admin
  screen; joining as a member, requesting to join an activity, applying for
  Arusha Escape, registering for an event, sending a catering enquiry, saving
  to the wishlist.
- **Every public page** checked on phone and desktop: loads, no sideways
  scrolling, no page errors.
- The website's production build (`next build`) completes.

Not tested here: the real live servers (Render, Vercel, Neon), real
Cloudinary uploads, and real devices — this was done in a development copy.

---

## 3. What still needs you (approval, accounts or decisions)

1. **Create your owner account on the live site.** Demonstration accounts
   cannot sign in on the live site. In Render → the API service → Environment,
   add `OWNER_EMAIL`, `OWNER_PASSWORD` (12+ characters, unique) and optionally
   `OWNER_NAME`, then redeploy. Then turn on two-factor sign-in at
   `/admin/two-factor`.
2. **Check and publish the Arusha Escape.** As the brief asked, it was imported
   as a **draft awaiting your final verification**: accommodation is marked "not
   yet booked", transport and meals "provisional", maximum 28 travellers,
   departure Mlimani City on Friday morning. Until you publish it (Travel —
   trips → Arusha Escape → Publish), the Travel page shows no upcoming trip.
3. **Saturday Community Jog** is a draft too. Add the beach, the route distance
   and the meeting instructions, add the Saturday sessions (Events & activities
   → the jog → Sessions → repeat weekly), then publish.
4. **Automatic WhatsApp notices** need the WhatsApp Business Platform (Meta):
   a Meta Business account, a WhatsApp Business number registered for the
   Cloud API, a permanent access token and an approved message template with
   one body variable. Put `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`
   and `WHATSAPP_TEMPLATE_NAME` on the API in Render. Until then every enquiry is
   still saved and shown, marked "Automatic WhatsApp not set up", and the
   Notifications screen says so.
5. **Connect Cloudinary** (free plan) so uploaded photos, videos and chat files
   survive deploys — `docs/DEPLOYMENT.md` Part G.
6. **Confirm the donation account** (Settings → Impact & donations) and
   **review the twelve policy drafts** with a lawyer (Settings → Legal), then tick
   "Reviewed".
7. **Add real Explore listings, games and communities.** None were invented.
   The games list (Free Fire, PUBG Mobile, eFootball, EA SPORTS FC…) is ready under
   Categories & games.
8. **Send the missing media**: Mkuranga videos, Meru Eco Camp, Cultural Heritage
   and AIM Mall photos and their dates.
6. **Seats already sold off-site.** Arusha Escape starts with 0 seats taken.
   If you have sold places by WhatsApp, set "Seats taken" on the departure.
7. **Meru Eco Camp.** There was no separate Meru Eco Camp trip record in the
   project — only as a stop on the Arusha Escape itinerary. If it was a
   separate past trip, add it under Travel with its date and photos and it
   will appear as a past trip.
8. **Napuru Gateway photo.** No photo of that day was supplied; it uses the
   credited Napuru Waterfalls photograph. Replace it with your own.
9. **Visitor analytics** is not connected. Vercel Web Analytics is the simplest
   (Vercel → project → Analytics → Enable). Set `ANALYTICS_DASHBOARD_URL` on the
   API to show a link on the overview.
10. **Existing demonstration data** in the live database is hidden from the
    public site and from the control centre's counts and money totals, but
    still stored. Removing it is a separate, permanent step — ask a developer
    when you want it done.

## 4. Paid services

Nothing new is required. What the platform uses:

| Service | Used for | Cost |
|---|---|---|
| Vercel | Website | Free Hobby plan is fine to start; Pro ($20/month) for commercial use and more traffic. |
| Render | API | Free plan sleeps when idle (first visit after a quiet spell takes ~30–60 s). Starter ($7/month) keeps it awake — recommended once you take real applications. |
| Neon | Database | Free plan; paid plans add longer backup history. |
| Cloudinary | Photos and videos | Free plan (25 credits/month) is plenty to start. |
| Domain | Your own address | Whatever your registrar charges. |
| Optional: Resend | Password-reset emails | Free up to 3,000 emails/month. |

No payment gateway is connected and none is pretended: customers pay by the
methods you list, and you record verified payments.

## 5. Running the website from your phone

Sign in at **`/signin`**, then open **`/admin`** (or tap your name → Control centre).
The ☰ button opens the menu; the search box at the top finds any section by
name ("WhatsApp", "prices", "expenses").

- **Add an activity anywhere (e.g. Nigeria):** Activities → Add → title,
  category, description, organiser → Country "Nigeria" → City → "+ Add a new
  city…" if needed → date and time *in that city's local time* → **Save &
  publish**.
- **Community submissions:** people send details on WhatsApp → you add the
  activity with "Who organises it: A community member" and status *Pending
  review* → check the safety list on the right → publish. Link the organiser's
  Enhakkore account and they can approve participants themselves
  (`/account/hosting`).
- **Change a trip price or date:** Travel — trips → the trip → Price /
  Departure dates → Save. Each date has its own seats, price, deadline and
  private group.
- **Trip applications:** Trip applications → open one → Approve → when money
  arrives, **Record a verified payment** (it also goes into Finance). When paid
  in full the booking confirms itself and the traveller can open the departure's
  private group. *Roster & budget* shows who has paid, costs and profit.
- **Publish an event:** Events → Add → poster, date/time, ticket types →
  Save & publish. Registrations → record payments; at the door type the
  reference to check people in.
- **Update a business listing:** Discover — places → the place → edit → Save.
  Set "Who provided these details" honestly.
- **Photos:** Media library → Upload (from your camera roll). Any photo field
  lets you upload or reuse library photos.
- **Money:** Finance → + Income / + Expense (attach a receipt photo). Reports
  show totals, monthly, by division, per trip and per event, outstanding
  payments — **per currency**. *Export CSV* opens in Excel.
- **Donations:** Donations → Record → verify only after checking the statement.
- **Homepage, contacts, WhatsApp messages, logos, menu, policies:** Website
  settings. Every change is logged; *Change history* → *Restore previous value*
  undoes a mistake.
- **Payment details:** Payment settings — bank/mobile-money accounts and where
  each is shown (trips, events, experiences, catering, donations).
- **Your team:** Staff & roles → Give someone access → choose a role. Edit what
  each role can do in the permissions grid. Revoke access any time.
- **Security:** Security & audit → who changed what, active sessions (sign
  anyone out), failed sign-ins.

## 6. Connecting your own domain

1. Vercel → your project → Settings → Domains → Add `yourdomain.com` (and
   `www.yourdomain.com`). Vercel shows the DNS records to add.
2. At your registrar, add those records (usually an A record and a CNAME).
3. Render → enhakkore-api → Environment → `CORS_ORIGIN`: add
   `https://yourdomain.com,https://www.yourdomain.com` (comma-separated,
   keep the old Vercel address too while switching). Redeploy.
4. Vercel → Environment Variables → add `SITE_URL=https://yourdomain.com`
   (used for link previews), redeploy.

## 7. Backups, security and maintenance

- **Backups:** Neon keeps point-in-time history (length depends on plan) —
  restore from Neon's dashboard. Once a month, export Finance, Donations,
  Members and the Audit log as CSV and keep them safely.
- **Passwords:** long and unique for the owner; staff get a one-time password
  and should change it. Everyone with team access should turn on two-factor sign-in (`/admin/two-factor`).
- **If a phone is lost or an account is misused:** Security → sign that person
  out everywhere; suspend or revoke access; reset the password.
- **Permissions are enforced by the server**, not just hidden buttons. Only the
  owner can create roles or give access.
- **Keep it updated:** ask a developer every few months to update dependencies
  (`npm audit`) and redeploy.

## 8. Known limitations (honest list)

- No online card or mobile-money payment processing — payments are recorded by
  hand after checking. Third-party bookings are enquiries only.
- No live hotel room availability — listings say availability must be
  confirmed with the property.
- No private chat between individual members; trip departure groups have
  real-time chat.
- Member notifications are in-app. The team gets WhatsApp notices once the
  WhatsApp Business Platform is connected; emails are only password resets.
- Currency conversion is not done — every total is shown per currency.
- The older "Ask Enhakkore" question box was removed from public pages because
  it answered from fixed files and could quote out-of-date prices now that
  prices are edited in the control centre.
- The third-party tour-operator marketplace is a later phase. Its screens were
  removed from the website and operator sign-up is closed; the database and API
  keep the groundwork (set `ENABLE_MARKETPLACE=true` on the API to reopen it).
- The mobile app is not built; the API is ready to serve one.
