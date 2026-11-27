# Enhakkore — Admin User Manual

For the founder and the Enhakkore team. Everything here works from a phone or a
computer. You never need to edit code for routine work.

- **Control centre:** `https://<your website>/admin` (today: https://enhakkore-one.vercel.app/admin)
- **Sign-in page:** `/admin/login` — opening `/admin` while signed out takes you there.
- **This manual inside the website:** Control centre → menu → **Help & manual** (`/admin/help`).

Screens below are from a phone. On a computer the menu is always shown on the left.

---

## 1. Logging in

**First time (the founder only).** There is no default admin account and no public
admin sign-up. The founder's Super Admin account is created once:

1. In Render (the API service) → **Environment**, add `SETUP_TOKEN` = a long random
   secret of at least 24 characters (for example 40 random letters and numbers). Save
   and let it redeploy.
2. On your phone, open `/admin/setup`. This page is not linked anywhere and not
   indexed by search engines.
3. Enter the setup token, your name, your email and a password (12+ characters,
   letters and numbers). Tap **Create my Super Admin account**.
4. You are signed in and taken to **two-factor sign-in** — turn it on (section 2).
5. The setup closes for good the moment your account exists — even if the token
   stays set. Remove `SETUP_TOKEN` from Render afterwards anyway.

![Founder setup](/manual/01-setup.webp)

*Alternative:* `OWNER_EMAIL` and `OWNER_PASSWORD` in Render create the same account
on the next deploy (also once only). Use one method, not both.

**Every time after that:** open `/admin`, enter your email and password, then the
6-digit code from your authenticator app if two-factor sign-in is on.

![Sign in](/manual/02-login.webp)

## 2. Passwords and two-factor sign-in

- **Change or reset your password:** on the sign-in page tap **Forgot password?**
  — a reset link is emailed to you. Emails are sent only once `RESEND_API_KEY` is
  set on the API (see the handover); until then a developer has to reset it.
- **Two-factor sign-in:** menu → **My two-factor sign-in** → *Set up* → add the key
  to Google Authenticator / Microsoft Authenticator / 1Password → type the 6-digit
  code → *Turn on*. Everyone with finance, staff or settings access should use it.

![Two-factor](/manual/21-two-factor.webp)

## 3. Inviting team members

Team accounts are invitation-only — there is no public staff sign-up.

1. Menu → **People & settings → Team & permissions**.
2. **Give someone access** → their email, name and a **role**.
3. If they have no account yet, a **one-time password** is shown once. Send it to
   them privately (WhatsApp). They sign in at `/admin/login`, change it, and turn on
   two-factor sign-in.
4. To remove access, open the person and choose **Revoke access**. To sign them out
   everywhere, use **Security & audit → Sessions**.

![Team](/manual/20-staff.webp)

## 4. How permissions work

Each role is a list of permissions such as *Explore listings: view, create, edit,
publish*. The server checks every action, so hiding a button is never the only
protection. Starting roles: Super Administrator, Finance, Travel, Explore,
Experiences, Gaming, Events, Content, Community, Impact, Customer Support, Business
Partner and Property Manager (partners see only the listings assigned to them).
Edit the grid of any role in **Team & permissions**, or create your own roles.

## 5–7. Hotels, restaurants, destinations and attractions

Menu → **Explore → Explore listings → + Add place**. Choose the **category**
(Hotels, Restaurants, Wedding venues, Attractions…), name, **country** and **city**
(type to search — any city in the world can be chosen; if one is missing tap
*City not in the list? Add it by name*), description, photos, contacts.

![Add a place](/manual/05-add-place.webp)

Important fields:

- **Bookings:** *Enquiries through Enhakkore* + **Enquiry type** = *Room / stay*
  (hotel enquiry form) or *Table reservation* (restaurant form). *Book on their own
  website* shows their link.
- **Room types / Menu / Availability (verified only):** fill only what the business
  confirmed.
- **Who provided these details:** *Verified by Enhakkore*, *Submitted by the
  business* or *Not yet verified*. It is shown on the page.
- **Public source used / Source checked on:** for researched listings.
- **Sponsored listing:** only for paid placements — it is labelled on the website.
- **DEMO record:** tick for example content.
- **Save as draft** or **Save & publish**. **Preview** opens the public page.

Destinations (countries and cities with pages) are under **Content → Countries /
Cities**: feature a city, add a summary and a photo.

## 8–9. Trips and the Arusha Escape

Menu → **Travel & Impact → Travel — trips**. Open a trip to change anything: title,
summary, prices (TZS and other price tiers), inclusions, exclusions, items *still being
confirmed*, accommodation, transport, meeting point, **minimum/maximum group**,
**Trip stage** (Registration open → Trip confirmed → Completed), payment details,
cancellation policy, itinerary days and photos. **Departures** (below the form)
hold each date, seats, price and application deadline.

![Trips](/manual/06-trips.webp)

**Arusha Escape:** open it from the list. When accommodation is booked, edit
*Accommodation*, remove the line from *Still being confirmed*, and set the *Trip
stage*. Change the price in *Headline price* (and the departure's own price if set).

![Arusha Escape](/manual/07-arusha-edit.webp)

## 10. Trip participants

Menu → **Today → Trip applications**. Open one → **Approve** (or Decline) → when the
money arrives, **Record a verified payment**. When paid in full the place is
confirmed automatically and the traveller gets access to the departure's private
group. *Roster & budget* on the departure shows who has paid.

Trip **requests** (the "Request this trip" form) arrive in **All enquiries**, filter
*Trip request*. Reply, then mark the status.

![Applications](/manual/08-applications.webp)

## 11. Group chats (trips, events, activities, communities)

Menu → **Travel & Impact → Group chats**. Trip groups open automatically for
confirmed travellers. Events, activities and communities get a chat only when the
organiser (or a team member) switches **Group chat** on in the listing; members
open it from the listing page or **My account → Group chats**. Switched off, the
history stays readable but nobody can post. In trip groups you can open a group to read it, post
announcements, **pin** messages, **remove** a message or a participant (a reason is
required and recorded), or **Archive** it (read-only, history kept). Groups also
become read-only 30 days after the trip. Only confirmed participants and authorised
team members can open a group.

![Chats](/manual/09-chats.webp)

## 12–13. Events, activities and recurring jogging sessions

Menu → **Experiences → Events & activities → + Add activity**. Member submissions
arrive as **Pending review** (large or paid ones are marked *Enhanced review* —
verify the organiser first; the review note also says when the organiser is not yet
approved for that category). Use **Publish**, **Unpublish** or **Archive**.

Each activity and event has two R6 settings under **Participants**:
**Entry check** (*None* by default; *Enhakkore Pass with QR code*; or *Manual
check-in by reference*) and **Group chat for participants**. Keep *None* for ordinary
free activities — passes are for paid or controlled entry.

![Activities](/manual/10-activities.webp)

**Weekly jogging:** open the *Saturday Community Jog* (draft) → fill in the beach,
distance and meeting instructions → scroll to **Sessions** → first date 06:30 →
*Repeat weekly for* 8 or 12 weeks → **Add session(s)**. Each session has its own
registration list and an **attended** tick. Change or cancel a session there —
everyone registered is told. Then **Publish** the activity.

Ticketed events: **Experiences → Ticketed events**; registrations and door
check-in under **Today → Event registrations**.

## 14. Gaming tournaments

Menu → **Experiences → Gaming & tournaments → + Add**. Choose the **game** (manage
the list under *Categories & games*, kind *Games*), online or console, format (solo,
duo, squad, team), players per team, slots, date and deadline, rules, disputes,
bracket rows and results. All tournaments are free at launch. **Registrations** are
listed under the form: confirm, waitlist or disqualify entries. The Gaming page
picture is in **Website settings → Gaming**.

![Tournaments](/manual/11-tournaments.webp)

## 15. Communities

Menu → **Experiences → Communities**. Members' applications arrive as *Pending
review*. Open one → publish → use **Members & announcements** to post an
announcement (every member gets a notification), make moderators or remove members.

**Who can join** (section *Membership*): **Free** (anyone joins at once),
**Private** (members send a short request) or **Paid membership** (members send a
request; the fee, period, benefits and terms are shown on the page, kept separate from
the cost of any event). Online payment is **not switched on**, so for paid communities
the team arranges payment directly and then approves. Requests appear in **Members &
announcements** marked *Request* — press **Approve** or **Decline**; the member is
notified either way.

![Communities](/manual/12-communities.webp)

## 16. Posts and media

Photos and videos: menu → **Content → Media library → Upload** (from the camera
roll). Every photo field also has *Upload* and *Choose from library*. Original logos
are protected from deletion. Stories, polls, challenges and banners are under
**Content**.

![Media](/manual/13-media.webp)

## 17. Enhakkore Impact and WSC

WSC — We Save Children is part of Enhakkore Impact (not a separate organisation).
Menu → **Travel & Impact → Impact / WSC projects**: projects, updates, photos. Never
publish figures you have not verified. Donations are recorded under **Donations**
and kept separate from business income.

## 18–19. Hotel enquiries and restaurant reservations

Menu → **Today → Hotel enquiries** / **Restaurant reservations**. Each shows the
reference, dates, guests, room type or time, contact details and whether the
automatic WhatsApp notice was sent. Tap one to **Reply on WhatsApp**, **Call** or
**Email**, write **internal notes**, and set the status: *Contacted → Awaiting
business response → Alternative offered → Confirmed / Declined / Unsuccessful*. The
customer sees the status in their account and gets a notification.

![Hotel enquiries](/manual/14-hotel-enquiries.webp)

## 20. WhatsApp enquiries

- **Automatic notices** go to the team numbers in *Contacts* once the WhatsApp
  Business Platform is connected (handover, section on WhatsApp). Choose which number
  receives which kind of enquiry in **Contacts & social → Routing** (`all`, `1` or `2`).
- Until it is connected, enquiries are **still saved** and marked *Automatic WhatsApp
  not set up*; use the green **Reply on WhatsApp** button. *Try the automatic notice
  again* re-sends once it is connected.
- Every attempt is listed in **People & settings → Notifications**.

![Notifications](/manual/19-notifications.webp)

## 21. Business partnership applications

Menu → **Explore → Business partnerships**. Statuses: *New → Contacted → Negotiating
→ Awaiting verification → Awaiting agreement/payment → Approved → Published /
Declined*. Record what you agreed in **Partner agreements** (kind, commission,
fee, dates). A business is never published by itself — you create its listing.

![Partnerships](/manual/15-partnerships.webp)

## 22. Contacts and social links

Menu → **People & settings → Contacts & social**: WhatsApp numbers, emails, address,
hours, routing; **Social media** for Instagram/TikTok. Changes ask for confirmation
and are recorded; *Change history → Restore previous value* undoes a mistake.

![Contacts](/manual/16-contacts.webp)

## 23. Homepage sections, the globe and page pictures

Menu → **Content → Homepage editor**: hero text and buttons (headline, introduction,
"Explore Now" and "Discover Experiences"), and each section's title, order (↑ ↓) and
on/off switch: Explore Enhakkore (the four main categories and the *Discovering in …
Change* bar), Upcoming Experiences, What's Happening Now, Upcoming Trips, Featured
Destinations, Travel With Purpose, Discover & Review, Enhakkore Impact, Join the
Community, Partner With Enhakkore.

**The globe.** The homepage globe shows every published activity, event, trip,
place, tournament, community and Impact project that has a city or coordinates.
Visitors tap **Locate**, choose one of four groups — **Explore** (stays, food,
venues, attractions), **Experiences** (the eight sections), **Travel** (group,
private, safaris, beach & island, holiday packages, international) and **Impact**
(community projects, children's initiatives, volunteering, donations, stories) —
then a subcategory, and open a card for each pin. Subcategories with nothing on the
map (volunteering, donations, stories, private trips) link to their pages instead.
Scrolling past the globe closes Locate automatically. The subcategory comes from the
listing itself: the category's section, the trip type, or the Impact project. Something
missing from the globe? Give it a city (or exact coordinates for places and projects).

**Page pictures.** The photographs at the top of Explore, Experiences, Travel and
Impact are under **Settings → Page pictures** — upload your own in the Media library
and choose them there.

**Logo on dark backgrounds.** The header, footer and control centre use the original
logo prepared for navy backgrounds (the artwork unchanged, with a light outline).
An official light version from your designer can replace it: **Settings → Brand &
logos → Logo on dark URL**.

![Homepage](/manual/17-homepage.webp)

## 24. Archiving and removing demo records

Demo records show an amber **DEMO** label everywhere. In any list use **DEMO only**,
then **Archive all DEMO** or **Delete all DEMO**, or tick rows and use the bulk bar
(Publish / Unpublish / Archive / Delete). Deleting asks for confirmation and is logged.

## 25. Reports and analytics

Menu → **Money & reports → Reports & analytics**: new members, enquiries by type,
event registrations, and the most viewed/saved/joined listings (each visitor counts
once a day). **Finance** has income, expenses, profit per trip and CSV export.
Whole-site visitor numbers come from Vercel Web Analytics.

![Analytics](/manual/18-analytics.webp)

## 26. Notifications

Members receive in-app notifications (bell icon) for registrations, enquiry updates,
trip and session changes, community announcements and approvals. The team's
WhatsApp/email deliveries are listed in **Notifications**.

## 27. Policies

Menu → **People & settings → Policies**: 25 documents (terms, privacy, gaming,
donations, staff access…). They are drafts until a lawyer reviews them under
Tanzanian law; then tick **Reviewed**. The public Policy Centre is at `/legal`.

![Policies](/manual/22-policies.webp)

## 28. Backup and restore

- **Database:** Neon keeps point-in-time history; restore from the Neon dashboard
  (Branches → Restore). Ask a developer if unsure.
- **Monthly:** export Finance, Donations, Members and the Audit log as CSV and keep
  them safely.
- **Photos:** with Cloudinary connected, media is kept by Cloudinary.
- **Settings:** every settings change can be restored from *Change history*.

## 29. Website settings

Menu → **Website settings**: brand (name, slogan, logos), search engines, menu,
launch city, catering, gaming hero, impact wording and donation confirmation.

## 30. Organiser applications (Host & Organise)

Members apply at **Experiences → Host & Organise** with their legal name, phone,
email, country and city, the categories they want, past experience, a description,
links and agreement to the organiser rules. Menu → **Experiences → Organiser
applications** lists them by status: *Submitted*, *Under review*, *More information
required*, *Approved*, *Rejected*, *Suspended*.

1. Open an application and read it. Press **Mark under review**.
2. **Check identity outside the website** — a phone or video call, or in person,
   where you see an ID. In **How identity was checked**, write only what you did
   (e.g. "Video call 12 Dec, national ID seen by Asha"). **Never type an ID number
   and never upload a document.** Approving is refused until this is filled in.
3. Tick the categories you approve — they may be fewer than asked for. Higher-risk
   categories (large events, paid events, sports with physical risk) deserve more care.
4. **Approve selected**, **Ask for more information** (write the note — the applicant
   sees it), **Reject**, or later **Suspend**. The applicant is notified each time.

Approval does not publish anything by itself: every experience an organiser submits
is still reviewed. Organisers see their submissions, registrations, check-ins and
chats in their **organiser dashboard** on the Host & Organise page.

## 31. Enhakkore Pass and the check-in scanner

A pass is created automatically, only where entry is controlled: an event or
activity with **Entry check** set to QR or manual, a paid event registration, a trip
booking once the trip's stage is **Trip confirmed** or **Departure ready**, and a
hotel or restaurant enquiry once its status is **Confirmed** (that is, after the
business accepted it). Members see passes under **My account → Enhakkore Pass**. The
QR code contains only a random code — no name, phone, email or ID.

If a booking is cancelled the pass shows *Cancelled*. If the date, time or place
changes, the pass is re-issued with a new code and the old QR stops working — ask
people to open the pass again.

**At the entrance:** Menu → **Experiences → Check-in scanner & passes** (the same page
as **My account → Check-in scanner**). Choose the event, then **Scan with camera**
(works in Chrome on Android; other phones type the reference) or type the
**PASS-…** reference. Results:

| Result | Meaning |
|---|---|
| Valid — checked in | Let them in. |
| Already checked in | The pass was used before — the time of first check-in is shown. |
| Needs review | A typed reference for a QR pass. Confirm who they are, then press **Identity confirmed — check in**. |
| Cancelled / Expired | Do not admit on this pass; check their booking. |
| Not found | Wrong event or a fake code. |

**Find someone on the list** searches by name, @username or reference for a manual
check-in. Every scan is recorded with who scanned it and when.

**Offline mode:** before the event, with a connection, switch on **Offline mode** and
press **Download offline list** (valid 12 hours). It holds pass references and short
names only, never QR codes. Results offline are **provisional**. When you are back
online press **Sync** — each scan is checked again on the server and anything that
did not hold (for example someone checked in at another door first) is reported.

Organisers can scan only their own listings. Team members need edit permission for
that kind of listing (events, activities, trips or places).

## 32. Usernames, profiles and privacy

Every member chooses a unique **username** when they sign up (with their country and
city, which become their default discovery location). Other members and the public
see usernames — never phone numbers or emails. Members choose who sees their bio,
interests, location, communities and activities (Everyone / Members / Only me), can
add a cover photo, and can hide their profile from search. A public card lives at
`/u/<username>`. Reserved names (admin, enhakkore, support, staff and similar) cannot
be taken by members.

**Notifications:** members can switch off optional notices (chat messages,
invitations, community announcements, Nearby, Impact updates). Booking, payment,
cancellation, safety and pass notices are always sent.

**Enhakkore Nearby** is off by default. Members can choose 4 m or 10 m, but the
website says plainly that it does not work yet: telling 4 m from 10 m needs Bluetooth
between phones, which browsers do not allow. It needs the future mobile app.

**Invitations:** members can invite friends by link, WhatsApp, their phone's share
sheet or by @username. An invitation is only a notification with a link — it never
registers anyone or holds a place.

## 33. Troubleshooting

| Problem | What to do |
|---|---|
| Website slow the first time in a while | The free API plan sleeps; the first visit wakes it (30–60 s). Upgrade Render to Starter to avoid this. |
| "Setup is closed" on `/admin/setup` | The founder account exists. Sign in at `/admin/login`. |
| Lost the authenticator phone | Ask a developer to switch off two-factor sign-in for your account, then set it up again. Keep your authenticator backed up (1Password or Authy). |
| Enquiries not arriving on WhatsApp | Check **Notifications** — "not configured" means the WhatsApp Business Platform is not connected yet. |
| Uploaded photos disappeared after a deploy | Connect Cloudinary (handover). |
| A page shows old content | Changes appear within about a minute. |
| A member says their pass QR "does not work" | Ask them to reopen the pass: if the date or place changed, a new code was issued. Otherwise check in by reference. |
| Camera scanning does not start | That phone's browser cannot read QR codes. Type the reference instead, or use Chrome on Android. |
| Someone needs to be removed quickly | Security & audit → sign them out everywhere; Team & permissions → revoke. |
