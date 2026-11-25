# Enhakkore Travel & Impact — handover

This is the owner's guide: what was built, what was tested, what still needs
your approval or accounts, and how to run the website from your phone.

---

## 1. What has been completed

**The public website**, rebuilt around the five divisions plus Connect:

| Area | Address | What it does |
|---|---|---|
| Home | `/` | Hero, search, Weekend Radar, activities by group (Basketball is a main category), trips, events, Find your people, places, experiences, catering, an interactive globe, stories, What's new, Impact with WSC, social links. Section order and visibility are set in the control centre. |
| Enhakkore Travel | `/travel`, `/travel/<trip>` | Upcoming and past trips, itinerary, prices (with separate prices per visitor type, never converted), inclusions, items still being confirmed, payment numbers with copy buttons, cancellation policy, **apply for places**. |
| Discover | `/discover`, `/discover/<place>` | Places and businesses with "Verified by Enhakkore / Submitted by the business / Not yet verified" labels, sponsored and hidden-gem badges, opening hours, contact links, Google Maps link, member reviews (moderated), deals, and enquiry forms (general, room or table). |
| Experiences | `/experiences` | Listings with provider, duration, price or "on request", enquiry form. |
| Events | `/events` | Enhakkore-hosted vs third-party clearly marked; ticket types, live remaining places, **registration with a reference**, payment instructions, external ticket links. |
| Activities | `/activities`, `/activities/host` | Filters by country, city, category, in-person/online, level, spaces, past/upcoming. **Host an activity** opens WhatsApp with the message already written. Members **request to join**; organisers approve. |
| Connect | `/connect` | Member profiles (photo, city, interests), discovery by country/city/interest, connection requests, accept/decline/remove, block, report. Members only; no email, phone or address is ever shown. |
| Impact | `/impact`, `/impact/mkuranga-outreach`, `/donate` | WSC presented as its own organisation; the Mkuranga outreach with all 18 original photographs; donate page with **Account name: Selcom, Account number: 0745341440** exactly, copy button, WhatsApp confirmation. |
| Catering | `/catering` | Lunchboxes, group catering, private chef — packages you add, plus a custom request form and WhatsApp ordering. |
| Also | `/destinations`, `/weekend`, `/community` (stories, polls, challenges), `/deals`, `/search`, `/contact`, `/legal/*`, `/account/*` (applications, hosting, wishlist, profile) | |

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
No email, address or Facebook page is shown, because none was supplied —
you can add them in Settings → Contacts.

---

## 2. What was tested

- **90 automated API tests pass**, including the 71 that already existed. The
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

1. **Create your owner account on the live site.** For security, the old
   demonstration accounts (including `admin@enhakkore.com`, whose password was
   published in the code) **can no longer sign in on the live site**. In
   Render → enhakkore-api → Environment, add `OWNER_EMAIL`, `OWNER_PASSWORD`
   (12+ characters, unique) and optionally `OWNER_NAME`, then redeploy. Your
   account is created on that deploy. You can then remove `OWNER_PASSWORD`.
2. **Deploy.** Merge this branch; Render rebuilds the API (it applies the new
   database tables automatically and loads the starting content), Vercel
   rebuilds the website.
3. **Connect Cloudinary** (free plan) so uploaded photos and videos survive
   deploys — `docs/DEPLOYMENT.md` Part G. Until then the overview shows a
   warning, and uploads are lost on the next deploy.
4. **Confirm the donation account.** Confirm that the Selcom account
   0745341440 is authorised to receive donations for the stated project, then
   tick "Donation account confirmed" in Settings → Impact & donations. Until
   you do, the Donate page asks donors to confirm with you first.
5. **Write your policies.** Terms, privacy, cancellation — Settings → Legal.
   Until written, those pages say plainly they are not yet published. Have a
   lawyer review them.
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
  and should change it. Two-factor sign-in is **not** built yet.
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
- No in-app chat between members yet (the data model is ready for it); trip
  departure groups do have chat.
- Notifications are in-app only; email/SMS/WhatsApp notifications are not sent.
- Currency conversion is not done — every total is shown per currency.
- Two-factor sign-in is not available.
- The older "Ask Enhakkore" question box was removed from public pages because
  it answered from fixed files and could quote out-of-date prices now that
  prices are edited in the control centre.
- The older tour-operator marketplace screens still exist (owner only, under
  "Marketplace (older screens)") but are not linked from the public menu.
- The mobile app is not built; the API is ready to serve one.
