# Requirements audit — Enhakkore Travel & Impact

Every requirement from the owner's briefs (the master prompt, the complete
admin control centre, the final completion instruction, Catering & Lunchbox
Services, and the rebuild decision), checked against the code.

**Status:** ✅ built and tested · 🟡 built, needs the owner's input or an
external account · 🔜 deliberately a later phase · ❌ not possible from here (reason given)

## 1. Brand

| Requirement | Status | Where |
|---|---|---|
| Name, slogan "Explore. Connect. Create impact." | ✅ | Settings → Brand (editable); header, footer, hero |
| Navy, gold, white, cream; serif headings, sans body | ✅ | `apps/web/src/app/globals.css` (Cormorant Garamond + Plus Jakarta Sans) |
| Original Enhakkore logo, never recoloured or stretched | ✅ | `components/site/BrandLogo.tsx`, `components/brand/Logo.tsx` → `/partners/enhakkore-wordmark.webp`; browser-tested on phone and desktop |
| Original WSC logo in Impact, as its own organisation | ✅ | `/impact`, `/donate`, `/impact/<project>`, footer → `/partners/wsc.webp`; browser-tested |
| Subtle motion, 3D globe, reduced-motion fallback | ✅ | `components/home/Globe.tsx` (static with reduced motion; data saver skips hero video) |

## 2. International platform

| Requirement | Status | Where |
|---|---|---|
| Dynamic countries (all 249) and cities, added without code | ✅ | Admin → Countries / Cities; "+ Add a new city" inside every form |
| Currencies TZS, USD, EUR, GBP, KES, NGN (+ UGX, RWF, ZAR, AED) | ✅ | `packages/shared/src/money.ts` |
| Time zones per city; times entered and shown in local time | ✅ | `packages/shared/src/time.ts`; tested Dar es Salaam and Lagos |
| Location filters and search; country and city pages | ✅ | `/destinations`, `/destinations/<country>/<city>`, `/search`, filters on every listing |
| Launch focus Dar es Salaam, no fake activity elsewhere | ✅ | Settings → Launch city; countries appear only with real listings |

## 3. Divisions

| Requirement | Status | Where |
|---|---|---|
| **Travel:** group/private trips, safaris; itinerary, dates, seats, deadlines, prices per currency/tier, inclusions, payment instructions, cancellation | ✅ | `/travel`, `/travel/<trip>`; Admin → Travel — trips |
| Apply → review → verify payment → confirm → private group per departure | ✅ | `/account/applications`; Admin → Trip applications; tested end to end |
| Past trips shown as past, not bookable | ✅ | Napuru Gateway (24 Oct 2026) on `/travel` "Past trips" |
| Arusha Escape kept upcoming with its real details | ✅ | moved from content file to database by `apps/api/prisma/bootstrap.ts` |
| **Discover:** hotels, restaurants, beaches, nightlife… with verified / business-submitted / unverified labels, sponsored, hours, contacts, map link, reviews | ✅ | `/discover`, `/discover/<place>` |
| Room availability "confirm with the property" where no live inventory | ✅ | place pages; live inventory 🔜 |
| **Experiences** with provider, price or "on request", enquiries | ✅ | `/experiences` |
| **Events:** posters, tickets, capacity, registration, payment instructions, attendee check-in; Enhakkore vs third-party | ✅ | `/events`; Admin → Event registrations |
| **Impact:** WSC, projects, updates, authentic photos, donations, volunteering, partnerships; no invented figures | ✅ | `/impact`, `/impact/mkuranga-outreach`, `/donate` |
| Donations separate from business income | ✅ | Admin → Donations (own ledger); tested |
| Donate shows exactly "Selcom / 0745341440", copy button, WhatsApp confirmation | ✅ | `/donate` |
| Donation account authorised for the stated project | 🟡 | owner confirms, then ticks Settings → Impact |
| **Catering & Lunchbox Services:** lunchboxes, group catering, private chef on request; under Travel & Experiences; WhatsApp ordering; no invented menus | ✅ | `/catering` (menu link, Travel and Experiences pages); lunchbox and private-chef request forms; Admin → Catering & lunchboxes; tested |
| Catering admin: packages, menus, photos, prices, group discounts, dietary options, availability, private-chef enquiries | ✅ | Admin → Catering & lunchboxes; Enquiries inbox filtered by "Catering" / "Private chef" |

## 4. Connect and activities

| Requirement | Status | Where |
|---|---|---|
| Profiles, photo, country/city, interests; discover by country/city/interest | ✅ | `/connect`, `/account/profile` |
| Connection requests, accept/decline/remove, block, report; no addresses or live location | ✅ | `/connect/members/<id>`, `/connect/requests`; tested |
| Messaging and groups addable later | ✅ ready | data model; trip departure groups already have chat |
| **Host an activity** → WhatsApp with prefilled message; reviewed before publishing | ✅ | `/activities/host` |
| Admin-created and community-submitted activities; full status list | ✅ | Admin → Activities |
| Basketball as a visible main category; sports, fitness, console and mobile gaming categories, editable | ✅ | Admin → Categories; homepage and `/activities` chips |
| Request to join; organisers manage participants and send updates | ✅ | `/activities/<slug>`, `/account/hosting`; tested |
| Filters: country, city, category, date, level, online/in person, spaces | ✅ | `/activities` |

## 5. Return visits

Weekend Radar `/weekend` ✅ · Hidden gems (Discover filter) ✅ · Wishlist `/account/saved` ✅ ·
Community stories `/community`, `/stories/new` ✅ · Local challenges ✅ · Polls ✅ ·
What's new (homepage) ✅ · Local deals `/deals` ✅ · Travel together `/travel` ✅ · Activity finder ✅

## 6. Admin control centre (`/admin`)

| Requirement | Status |
|---|---|
| Overview: members, activities, pending submissions, trips, bookings, events, listings, enquiries, income, donations, recent activity, alerts | ✅ |
| Visitors count | 🟡 needs Vercel Analytics switched on (link shown on overview) |
| Add / edit / draft / preview / publish / unpublish / archive / restore / delete / search / filter / sort for every content type | ✅ |
| Homepage sections, order, hero, banners; navigation; SEO; brand colours | ✅ Settings |
| Contacts, WhatsApp numbers and messages, socials, email, address | ✅ Settings → Contacts / Social / WhatsApp messages |
| Terms, privacy, cancellation, safety pages | ✅ editor · 🟡 text to be written by the owner |
| Media library with folders, captions, reuse; originals protected | ✅ |
| Payment settings per scope (trips, events, experiences, catering, donations), confirmed and logged | ✅ |
| Finance: income/expenses/refunds, categories, related trip/event, receipts, reports, trip and event profit, outstanding, cash flow, CSV | ✅ |
| Customers & members: history, suspend, export, access logged | ✅ |
| Roles & permissions (10 roles, custom roles, granular, partner "own listings only"), enforced on the server | ✅ tested |
| Security: login history, failed sign-ins, sessions with revoke, audit log, settings history and restore | ✅ |
| Two-factor sign-in | ❌ not built yet (listed in handover) |
| Global settings search | ✅ search box in the admin header |

## 7. Security and technical

Secure passwords (bcrypt), revocable sessions, server-side permissions, rate limits,
spam honeypots, validation, private receipts, audit trail ✅ ·
demo accounts blocked on the live site ✅ · migrations tested on PostgreSQL, including
upgrading a database that already holds data ✅ · backups: Neon point-in-time + CSV exports 🟡

## 8. Assets

| Asset | Status |
|---|---|
| Enhakkore logo, WSC logo | ✅ preserved, original files, displayed |
| Mkuranga outreach photographs (18 + cover) | ✅ preserved, in the media library, on the project page |
| Arusha trip materials (itinerary, prices, payment numbers, 6 credited photos) | ✅ preserved |
| Homepage safari video and poster | ✅ preserved |
| **Mkuranga videos** | ❌ never in the repository — please send the files |
| **Meru Eco Camp photos and videos** | ❌ never in the repository (searched full history) — please send the files |
| **AIM Mall media** | ❌ never in the repository — please send the files |
| **Cultural Heritage Centre media** | 🟡 only a Creative Commons Wikimedia photo exists; your own photos were never uploaded |

Once you send them, they go into Admin → Media library (no code change needed).

## 9. Deliberately later phases

Third-party operator marketplace and commission payments 🔜 (removed from the launch
website; the database and API keep the groundwork) · online card / mobile-money payments 🔜 ·
live hotel inventory 🔜 · member-to-member chat 🔜 · mobile apps 🔜 · paid organiser subscriptions 🔜
