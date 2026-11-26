# Requirements audit — Enhakkore Travel & Impact (master rebuild)

Every section of the master rebuild brief (and the earlier briefs it builds on),
checked against the code on this branch.

**Status:** ✅ built and tested · 🟡 built, needs the owner's input or an external
account · 🔜 deliberately a later phase · ❌ not done (reason given)

Tested: **117 automated API tests** and **112 browser checks on an emulated
phone** (62 for the rebuild plus 50 for the critical final requirements) (every public page loads with no
errors and no sideways scrolling; hotel enquiry, member sign-up, team
tournament registration, joining a community, publishing an activity, event
planning, My Experiences, notifications, and every new admin screen).

## 1–2. Inspection, brand and design

| Requirement | Status | Where |
|---|---|---|
| Old structure replaced, no old and new side by side | ✅ | Marketplace, booking, assistant and Connect-following screens removed; old addresses redirect (`/discover`→`/explore`, `/connect`→communities, `/trips`→`/travel`…) |
| Original Enhakkore and WSC logos, never redesigned | ✅ | Header, footer, hero, Impact, About — `public/partners/*` |
| Palette sampled from the logo (navy, gold, white, ivory) | ✅ | `public/brand/colours.json`; gold `#cb9a3c` and navy `#0a1a2e` tokens in `globals.css` |
| Brand message "Travel Further. Connect Deeper. Create Impact." | ✅ | Settings → Brand / Homepage (editable) |
| Interactive globe hero: rotates, lit markers, travel lines, drag, zoom, mobile and reduced-motion fallback | ✅ | `components/home/Globe.tsx` (drag in any direction, pinch, ⌘/ctrl-wheel, +/− buttons) |

## 3–4. Navigation and homepage

| Requirement | Status |
|---|---|
| Exactly four primary categories: Explore, Experiences, Travel, Impact + Search, Notifications, Account | ✅ header (bell with unread count for members), phone tab bar, menu sheet with sub-links |
| Homepage order: hero (Explore the World / Join / Donate, WSC) → Discover Enhakkore panels (icons, no photos) → What's happening now → Explore by interest → Featured destinations → Upcoming experiences & trips → Trending → Impact corner → Join → Footer | ✅ order and visibility editable in Homepage editor |
| Footer: About, contact, socials, FAQs, privacy, terms, community guidelines, partner, WSC & donations | ✅ `/about`, `/faq`, `/partner`, `/legal/*` |
| Donation reachable everywhere without popups | ✅ "Donate" in the header and menu |

## 5–6. Explore and enquiries & reservations

| Requirement | Status |
|---|---|
| Four sections — Stays, Food & dining (incl. catering/lunchboxes), Venues & event spaces, Places & attractions — with their sub-types | ✅ `/explore?section=…`; categories carry a section |
| Businesses cannot publish; team publishes; editorial / sponsored (labelled) / referral distinguished | ✅ listings only via control centre; Partner agreements module |
| Listing fields incl. room types, menus, verified availability, map, hours, contacts, reviews | ✅ (map: OpenStreetMap embed from coordinates) |
| Search, country/city/category filters, featured, popular, recently added | ✅ |
| Map browsing of the whole list | 🟡 each place has a map; a combined map of all listings is not built |
| Hotel enquiry form with every listed field | ✅ `components/public/Reservations.tsx` |
| Restaurant reservation form | ✅ |
| Three methods shown per listing (Enhakkore enquiry, verified WhatsApp, external link) | ✅ |
| Saved, reference number, dates, notification status, follow-up status, admin notes | ✅ |
| Statuses New … Unsuccessful | ✅ per-type status lists |
| Automatic WhatsApp to both team numbers via WhatsApp Business Platform; never pretended; manual fallback; enquiry never lost | 🟡 built and tested; **needs Meta credentials** (see handover). Until then enquiries are marked "Automatic WhatsApp not set up" with a retry button |
| Customers see enquiries and statuses in their account | ✅ `/account/enquiries` + notifications |

## 7–8. Experiences and gaming

| Requirement | Status |
|---|---|
| Search area, location filters, Discover / Plan an Event / Publish, 8 categories, Upcoming right below, Popular after | ✅ `/experiences` |
| Category-specific search ("Free Fire" finds Free Fire only) | ✅ tested |
| Plan an Event guided form (not implied free) | ✅ `/experiences/plan` |
| Publish an event or activity, approval process, enhanced review for large/paid | ✅ `/experiences/publish`; tested |
| Recurring activities with separate sessions (date, time, meeting point, route, capacity, registration list, attendance, status, notices), past sessions kept | ✅ tested |
| Communities: join, description, members, announcements, meetups, apply to create (approval) | ✅ tested |
| No general following system | ✅ old Connect follow/requests screens removed; member profiles remain |
| Public profiles (photo, name, bio, location, interests, communities, published activities, approved organiser) | ✅ `/members/<id>`, members only, no contact details |
| My Experiences (registrations, upcoming, past, saved, teams, communities, event plans, published, notifications, profile) | ✅ `/account/experiences` |
| Gaming hub: online tournaments + PS/console sessions, editable games list, formats, server, slots, deadline, rules, results, brackets, disputes, age | ✅ `/experiences/gaming` |
| Registration with player name, UID, server, team, squad IDs, captain, rules agreement; team invitations | ✅ invite codes; tested |
| Free at launch, no entry payments | ✅ |

## 9–10. Travel and private trip groups

| Requirement | Status |
|---|---|
| Trip fields incl. min/max group, exclusions, accommodation, transport, departure point | ✅ |
| Trip stage system (Registration open … Cancelled) | ✅ shown on the trip page |
| Arusha Escape as editable content **requiring final admin verification** | 🟡 imported with accommodation "not yet booked", transport/meals "provisional", max 28, Mlimani City Friday departure — **held as a draft until the owner publishes it** |
| Private group per departure; access only after confirmation | ✅ |
| Tabs Chat / Trip information / Itinerary / Participants / Documents | ✅ |
| Real-time persistent messaging over authenticated sockets | ✅ socket.io with server-side membership checks; slow poll fallback |
| Images and documents, announcements, pinned, unread counts, notifications | ✅ (images/PDF up to 10 MB) |
| Reporting, blocking, moderation, admin removal of participants, archive after trip (read-only history) | ✅ tested |

## 11–12. Impact and partnerships

| Requirement | Status |
|---|---|
| WSC as Enhakkore's impact side with its logo; completed projects; donations; volunteering | ✅ volunteer form added |
| Donations separate from revenue; payment integration disabled | ✅ |
| Mkuranga outreach with authentic photos | ✅ |
| Meru Eco Camp, Cultural Heritage, AIM Mall records | ❌ no media or verified dates exist in the project — please send them (nothing invented) |
| Partner page: WhatsApp option + application form; stored; statuses; agreements and commission tracking | ✅ `/partner`, Business partnerships inbox, Partner agreements |

## 13–14. Accounts and admin

| Requirement | Status |
|---|---|
| Two account types: Member (open) and Team (invite only, no public staff sign-up) | ✅ operator sign-up closed |
| Roles: Content, Explore, Experiences, Gaming, Travel, Impact, Community, Finance managers; multiple permissions; Super Admin | ✅ |
| Server-side permissions; two-factor authentication | ✅ TOTP two-factor sign-in (`/admin/two-factor`), secrets encrypted |
| Dashboard overview counts (members, upcoming, reservations, hotel/restaurant enquiries, partnerships, event-planning, organiser applications, pending approvals, recent activity) | ✅ |
| All 20 modules | ✅ menu groups Today, Explore, Experiences, Travel & Impact, Content, Money & reports, People & settings |
| Add → category → details → media → location → preview → draft/publish; schedule; archive/restore; delete with confirmation | ✅ ("schedule" = set dates; no timed auto-publish) |
| Notification delivery review, activity history, audit log | ✅ `/admin/notifications`, Security & audit |

## 15–17. Popularity, notifications, business model

| Requirement | Status |
|---|---|
| Popularity from unique views, saves, shares, registrations, enquiries; freshness; anti-manipulation; manual featuring; sponsored never ranked; expired excluded | ✅ `services/popularity.ts`; tested |
| Verified reviews and completed bookings in the score | 🟡 reviews exist separately; not yet weighted into the score |
| In-app notifications for registrations, enquiries, trips, chat, events, communities, approvals, partnerships | ✅ |
| Email notifications | 🟡 only password reset by email (Resend key needed); others in-app |
| WhatsApp notifications to members | 🔜 team notices only |
| No public payment collection at launch | ✅ |

## 18–21. Contacts, launch content, technical, policies

| Requirement | Status |
|---|---|
| WhatsApp +255 745 341 440 and +255 794 279 089; Instagram ×3 (incl. @_wsc2022); TikTok; editable; no invented links | ✅ (an invented support email on the error page was removed) |
| Saturday jog — 06:30, Sayansi towards the beach, free, per-session registration, unconfirmed details kept in draft | 🟡 created as a **draft**; add the beach, distance and sessions, then publish |
| Curated real businesses | 🟡 none added: no verified details were available, and the brief forbids inventing them. Add them in Explore listings |
| Secure database, validation, rate limits, spam honeypots, audit, env vars, `.env.example` | ✅ |
| Twelve policy pages, clearly drafts until legal review | ✅ `/legal` (plain-language drafts; tick "reviewed" after a lawyer) |
| Report listing / user / message, block | ✅ |

## Logos and asset library

`public/brand/originals/` (untouched masters) and `public/brand/refined/` (transparent
full logo, @2x, navigation and footer sizes, emblem, square social images, on-dark plates,
favicons and app icons, WSC equivalents). No SVG: a faithful vector would have to be
redrawn by a designer, which needs your approval.

## Critical final requirements (round 3) and founder setup

| Requirement | Status |
|---|---|
| Compact mobile redesign, 2×2 category grid, header that hides on scroll, navy tab bar | ✅ |
| Compact search with suggestions; filters only on demand; "X in Y" understood | ✅ |
| Interactive globe (MapLibre): spin, tap a country or city to fly in, becomes a street map when zoomed, HUD read-out; falls back to a simple globe without WebGL | ✅ |
| Worldwide countries and searchable city pickers (GeoNames) | ✅ |
| Arusha Escape published with full package page; "Request this trip" + WhatsApp by enquiry type | ✅ (accommodation still being confirmed — 🟡) |
| Private real-time trip chat: documents, report, remove, archive, read-only after the trip | ✅ |
| Experiences page order; gaming hero image editable in settings | ✅ |
| Demo content (activities, tournaments, communities, trip) labelled DEMO, not joinable, not counted as popular; bulk archive/delete | ✅ |
| Real researched Explore listings with source and check date, no invented details | ✅ (11 places; verification 🟡) |
| WSC impact band redesign | ✅ |
| Policy Centre: 25 versioned drafts, acceptance recorded at sign-up | ✅ (legal review 🟡) |
| Admin User Manual: document, in-admin Help page, PDF, 22 screenshots | ✅ |
| One-time founder Super Admin setup (`SETUP_TOKEN`, `/admin/setup`), closes after use, no default credentials, invite-only team, 2FA, password reset | ✅ (reset emails need `RESEND_API_KEY` 🟡) |

## Later phases

Third-party operator marketplace · online payments · live hotel inventory · paid
tournaments · member-to-member private chat · mobile app (the API is ready for it).
