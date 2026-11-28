# Integrations — what is connected and what is waiting

Last updated with the R7 release. Nothing below is pretended: where a service is not
connected, the website says so to the person using it and keeps working without it.

| Integration | Status | What works today without it | To switch it on |
|---|---|---|---|
| **Database (PostgreSQL)** | Connected (Render / Neon) | — | — |
| **Founder setup** | Ready | `/admin/setup`, closes for good once the Super Admin exists | Set `SETUP_TOKEN` on the API once; remove it afterwards |
| **WhatsApp Business Platform** (automatic notices to the team) | **Waiting for credentials** | Every enquiry is saved with a reference and shown in the control centre as *Automatic WhatsApp not set up*. Customers see a **Continue on WhatsApp** link pre-filled with their reference and summary — opening it does not send anything until they press send, and the site never claims a message was delivered. | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME` (optional `WHATSAPP_TEMPLATE_LANG`) on the API |
| **Email** (password reset, later email notices) | **Waiting for credentials** | In-app notifications. Password resets need a developer until email is on. | `RESEND_API_KEY` and `EMAIL_FROM` on the API |
| **Cloudinary** (photo and video storage) | **Waiting for credentials** | Uploads work but are stored on the API server's disk, which Render wipes on each deploy. | `CLOUDINARY_URL` (or the three `CLOUDINARY_*` keys) on the API |
| **Online payments** (Selcom or another merchant) | **Not connected — payments disabled** | Trip payments are recorded by the team after the money arrives. Paid communities take requests and are approved after payment is arranged directly. No card or mobile-money payment is collected on the website. | A merchant account and its API keys; then `PAYMENT_PROVIDER`. Development work is needed to wire the chosen provider. |
| **AI assistant (Bethany / Ariel)** | **Waiting for credentials** | The AI Assistant page records requests and says it is not connected; nothing is done. | `ANTHROPIC_API_KEY` on the API (optional `ASSISTANT_MODEL`, default `claude-opus-5-5`; `ASSISTANT_EFFORT`, default `medium`). The key stays on the API — never in the website. |
| **Mobile money prompts (M-Pesa, Airtel, Mixx, HaloPesa)** | **Not connected** | Travellers pay by a method in Payment settings and upload a receipt or transaction ID; the finance team verifies and approves it. The *Pay with mobile money* button says it is not available. | A licensed aggregator/merchant account, its keys and a signed payment webhook; development work to wire it. |
| **Exchange rates** | **Not connected** | Prices are paid in the trip's own currency; other currencies are listed but marked *rate not available* — no converted amounts are shown. | A chosen rate source (e.g. Bank of Tanzania or a paid FX API) and development work. |
| **Browser push notifications** | **Working** (Web Push) | Works in Chrome/Edge/Firefox/Android and on iPhone when the site is added to the Home Screen. Keys are generated automatically; optional `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`. Browsers do not confirm that a person saw a notification. | — |
| **Nia (member assistant)** | **Search works; conversation waiting for credentials** | Nia searches real records and points to account pages. | `ANTHROPIC_API_KEY` (shared with Bethany/Ariel); optional `NIA_MODEL`. |
| **Google / Apple sign-in** | **Not connected** | Email sign-up (outside gaming invitations return to the invitation after sign-up). | OAuth client IDs from Google and Apple, and development work. |
| **SMS / WhatsApp to members** | **Not connected** | Push and in-app notifications. | A messaging provider and its credentials. |
| **Hotel / restaurant systems (PMS, POS)** | **Not connected** | Every partner is a *basic* partner: requests go to the team, the team confirms with the business, and only then is the request marked Confirmed and a pass issued. No live availability is shown. | A signed agreement and API access from each business's system; development per system. |
| **Enhakkore Nearby (Bluetooth proximity)** | **Not available on the website** | Members can choose Off / 4 m / 10 m; the choice is saved and the page states plainly that it does not work yet. Web browsers cannot measure the distance between phones, and GPS cannot tell 4 m from 10 m. | A native mobile app with Bluetooth Low Energy, mutual opt-in, and its own privacy review. |
| **Camera QR scanning** | Works where the browser supports it | Chrome on Android scans with the built-in detector. Other browsers (including Safari on iPhone) type the pass reference instead; the scanner page says so. | Optional: a scanning library or the mobile app for iPhones. |
| **Push notifications / SMS** | Not connected | In-app notifications (bell icon). Quiet hours are saved for when push or email arrives. | A push or SMS provider; development work. |
| **Analytics** | Vercel Web Analytics | Built-in engagement counts (views, saves, sign-ups) | Optional `ANALYTICS_DASHBOARD_URL` link in the control centre |
| **Maps and globe** | Connected (open data) | NASA Blue/Black Marble tiles served from the website; CARTO street tiles when zoomed in; GeoNames cities | — |
| **Legal documents** | Drafts | 25 policy drafts in the Policy Centre | Review by a Tanzanian lawyer, then tick **Reviewed** in the control centre. They have not been approved by a lawyer. |

## Environment variables (API)

Required: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `NODE_ENV=production`.
Optional as above: `SETUP_TOKEN`, `OWNER_EMAIL`/`OWNER_PASSWORD`/`OWNER_NAME` (alternative
founder setup), `WHATSAPP_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `CLOUDINARY_*`,
`PAYMENT_PROVIDER`, `ANTHROPIC_API_KEY`, `ASSISTANT_MODEL`, `ASSISTANT_EFFORT`, `SEED_DEMO_DATA`, `APP_URL`/`SITE_URL`, `API_PUBLIC_URL`.

## Environment variables (website)

`NEXT_PUBLIC_API_URL` (the API address) and optionally `NEXT_PUBLIC_REALTIME_URL`.
No secret is ever placed in the website's variables.
