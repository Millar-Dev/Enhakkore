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

## Design (latest)

The whole site follows the navy-and-gold references (no purple anywhere: DEMO labels
are amber, trip badges navy and gold): a dark header with the original
emblem (prepared for dark backgrounds, artwork unchanged), a homepage hero whose
background is a real WebGL globe (NASA night-Earth imagery served from the site, gold
city lights and arcs, drag/pinch/wheel zoom), **Locate** mode with four groups and their subcategories,
pins and detail cards, alternating navy and ivory sections, an Explore page with photo
tiles, filters and a worldwide country → city location picker (also on Experiences,
Travel, Gaming, Communities and Search), and a navy-and-gold control centre.

## R6 — members, organisers, passes and chats

- **Accounts:** sign-up asks for a unique **username**, country and city (the default
  discovery location, changeable any time). Members are shown by @username; phone and
  email are never shown. Profiles have a cover photo, image cropping, and per-field
  visibility (Everyone / Members / Only me). Public card: `/u/<username>`.
- **Account Centre** (`/account`): My Enhakkore, Messages, Host & organise, Profile &
  settings — including **Notifications & Nearby** (optional notices, quiet hours) and
  **Password & security**.
- **Globe Locate**: four groups (Explore, Experiences, Travel, Impact) with
  subcategories; leaves Locate automatically when the visitor scrolls on.
- **Homepage**: Explore Enhakkore (four categories) with a *Discovering in … · Change*
  bar; Discover & Review now comes before Enhakkore Impact.
- **Experiences**: hero "Discover. Join. Create. Experience More." with three actions —
  **Discover Experiences** (`/experiences/discover`, filters for date, category,
  subcategory, free/paid, online/in person, age, availability, sort), **Host &
  Organise** (`/experiences/host`: organiser application, status and dashboard) and
  **Plan an Event with Enhakkore**. Category pages list the R6 subcategories.
- **Create an experience** is a four-step form: details → participation & safety →
  entry check (None / QR pass / manual) → review and submit for approval.
- **Organiser applications** with per-category approval and a recorded identity check
  (no ID numbers or documents stored) — control centre → Experiences.
- **Enhakkore Pass** with QR (random token only), issued only where entry is controlled;
  **check-in scanner** with camera (where the browser supports it), typed references,
  attendee search, audit trail and a signed 12-hour **offline list** that syncs later.
- **Group chats** for events, activities and communities on the same system as trip
  groups; organisers switch them on/off; report, block, pin, remove, close.
- **Invite friends**: copy link, WhatsApp, the phone's share sheet, or by @username.
  An invitation never registers anyone.
- **Communities**: free, private (request) or paid (request; online payment is not
  switched on — the team approves after arranging payment).
- **Reservations**: sending the same request twice returns the first reference; the
  WhatsApp follow-up link is pre-filled with the reference and a summary.
- **Explore**: "Explore Places Worth Knowing", per-section hero text, filters for
  facilities, cuisine and price range (matched against what listings state), and a
  **Member rating** sort (published member reviews only).
- New manuals: [TEAM-MANUAL.md](TEAM-MANUAL.md) and [INTEGRATIONS.md](INTEGRATIONS.md).

## R7 — reservations, deposits, communities, study groups and the assistant

- **Explore** has exactly four categories (Stays & Accommodation, Food & Dining,
  Venues & Event Spaces, Places & Attractions), each with its own page, filters and
  *Featured in [city]* rows.
- **Reservations** need an account. Hotel, restaurant and new **venue** requests get a
  reference, appear in *My reservations*, notify the responsible team members, and use
  the statuses Request submitted → Under review → Supplier contacted → Awaiting
  supplier confirmation → Confirmed / Unavailable / Cancelled. Only staff confirm.
- **Arusha Escape deposit**: TZS 5,000 per person, part of the TZS 270,000 price
  (balance TZS 265,000). Travellers upload a receipt or transaction ID; finance
  verifies and approves it under **Payments & receipts**; the booking is confirmed
  only then, and the traveller joins the trip group chat. Receipts are private and
  every view and decision is audited. Mobile-money prompts are not connected.
- **Official starter communities** (10), personalised recommendations by interests and
  city, and the **Saturday jogging community** (06:30, Sayansi Bus Stop, proposed route
  to Mbezi Beach — marked *to be confirmed*; its weekly sessions stay draft until you
  verify the route and publish the activity).
- **Study groups** under Workshops & Learning: any member can create one; group chat
  with text, photos, video, voice notes and files, shared files, announcements,
  moderators, mute/remove, private-group approval, reporting and posting limits.
  Phone numbers are never shown to other members.
- **Account Centre** lists every section requested, with Sign out.
- **AI Assistant** for the Super Administrator: *Hey Bethany* (working — drafts and
  edits; sensitive changes wait for your Confirm) and *Hello Ariel* (read-only
  reports). It acts only through checked backend operations and keeps a history.
  It needs `ANTHROPIC_API_KEY`; until then it says it is not connected.
- **WhatsApp test** button under Notifications.
- Tested: 144 API tests (SQLite and PostgreSQL), 20 browser checks for R7 and 25 for
  R6, and a responsive audit of the new pages.

## 3. What still needs you (approval, accounts or decisions)

1. **Create your founder (Super Admin) account — once.** No default admin
   account exists and there is no public admin sign-up. In Render → the API
   service → Environment, add `SETUP_TOKEN` (a random secret of 24+
   characters) and let it redeploy. Then open `/admin/setup` on the website,
   enter the token, your name, email and a 12+ character password. The setup
   closes permanently as soon as your account exists; remove `SETUP_TOKEN`
   afterwards. (Alternative: `OWNER_EMAIL` + `OWNER_PASSWORD`, also once only.)
   Then turn on two-factor sign-in at `/admin/two-factor`. Full steps with
   screenshots: **Admin User Manual** — `docs/ADMIN-MANUAL.md`, the control
   centre's **Help & manual** page (`/admin/help`) and the PDF at
   `/manual/Enhakkore-Admin-Manual.pdf`.
2. **Arusha Escape is published** with registration open. Accommodation and some
   transport/meal details are still listed under "Still being confirmed" — update
   them in Travel — trips when booked.
3. **Demo content must go before launch.** Example activities, 8 gaming
   tournaments, 4 communities and a draft demo trip are marked **DEMO** everywhere,
   cannot be joined, and never count as popular. In any list: *DEMO only* →
   *Archive all DEMO* or *Delete all DEMO*.
4. **Researched Explore listings** (11 real places in Dar es Salaam, Arusha and
   Zanzibar) show their public source and check date and are marked "Not yet
   verified". No phone numbers, hours or prices were added. Contact each business
   before calling anything a partnership.
5. **Saturday Community Jog** is a draft (demo version is shown meanwhile). Add the
   beach, distance and meeting point, add weekly sessions, then publish.
6. **Automatic WhatsApp notices** need the WhatsApp Business Platform (Meta):
   a Meta Business account, a number registered for the Cloud API, a permanent
   access token and an approved template with one body variable. Set
   `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` and
   `WHATSAPP_TEMPLATE_NAME` on the API. Until then enquiries are still saved and
   marked "Automatic WhatsApp not set up". Which number gets which enquiry type:
   Contacts & social → Routing.
7. **Password-reset emails** need `RESEND_API_KEY` on the API (Resend, free plan).
8. **Connect Cloudinary** (free plan) so uploaded photos, videos and chat files
   survive deploys — `docs/DEPLOYMENT.md` Part G.
9. **Confirm the donation account** (Settings → Impact & donations) and have the
   **25 policy documents** reviewed by a lawyer under Tanzanian law (Settings →
   Policies), then tick "Reviewed". They are drafts — not legal advice.
10. **Send the missing media**: Mkuranga videos, Meru Eco Camp, Cultural Heritage
    and AIM Mall photos and their dates; a photo for the Napuru Gateway day.
11. **Seats already sold off-site**: set "Seats taken" on the departure.
12. **Visitor analytics**: Vercel → project → Analytics → Enable.
13. **Logo for dark backgrounds (optional).** The phone header is dark navy, as
    in your mockups. Your original logo is navy, so it sits on a small cream
    badge there. If your designer supplies an official light/gold version, upload
    it in the Media library and paste its address into Settings → Brand & logos →
    "Logo on dark URL"; the phone header and footer will use it.
14. **Duplicate Vercel project.** Two Vercel projects build from this repository:
    `enhakkore_` (the live site, enhakkore-one.vercel.app) and `enhakkore`. The
    second one only uses up build time — delete it in Vercel → Settings.

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
- No private chat between individual members; trip departures, events,
  activities and communities have group chats.
- **Enhakkore Nearby** does not work on the website: browsers cannot detect nearby
  phones and GPS cannot tell 4 m from 10 m. The preference is saved for a future
  mobile app, and the page says so.
- Camera QR scanning works where the browser has a built-in QR detector (Chrome on
  Android). On other phones, staff type the pass reference.
- The offline check-in list is kept in the browser's storage on that device (hashed
  pass codes and short names only, valid 12 hours); it is not separately encrypted.
- Identity checks for organisers happen outside the website; only a note of how it
  was checked is stored.
- Member notifications are in-app. The team gets WhatsApp notices once the
  WhatsApp Business Platform is connected; emails are only password resets.
- Currency conversion is not done — every total is shown per currency, and trip
  payments are accepted only in the trip's own currency.
- Trip deposits are verified by hand from uploaded receipts; a receipt never confirms
  a booking by itself.
- No new Tanzanian businesses were researched in R7; existing listings are unchanged
  and unverified ones stay marked as such.
- Study groups have no age verification (no date of birth is collected); safety
  relies on accounts, moderators, reporting, muting and the team's review.
- The older "Ask Enhakkore" question box was removed from public pages because
  it answered from fixed files and could quote out-of-date prices now that
  prices are edited in the control centre.
- The third-party tour-operator marketplace is a later phase. Its screens were
  removed from the website and operator sign-up is closed; the database and API
  keep the groundwork (set `ENABLE_MARKETPLACE=true` on the API to reopen it).
- The mobile app is not built; the API is ready to serve one.
- The globe's close-up street map uses CARTO's free map tiles (© OpenStreetMap,
  © CARTO) loaded from the internet; country outlines are bundled. Phones
  without WebGL get a simpler animated globe.
- Worldwide city choice uses the GeoNames dataset (≈135,000 places, CC BY 4.0);
  a missing village can be added by name.
- Scheduled publishing dates are not available — publish by hand.
- The 25 policy documents are drafts and have not been reviewed by a lawyer.
- "Stay connected" sign-ups arrive as enquiries marked "Updates sign-up" in All
  enquiries; there is no separate mailing-list service.
- Responsive testing: 49 pages × 20 screen configurations (11 sizes from 320×568
  to 2560×1080, phone and tablet landscape, browser zoom 80/125/150 %, larger
  text) checked automatically for sideways scrolling, cut-off text, covered
  controls, distorted images and tap-target size. Real phones were not
  available; emulated devices were used.
