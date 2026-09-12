# Brand

**ENHAKKORE — Travel & Impact**

---

## Positioning

Enhakkore is a travel platform where people discover experiences, join other
travellers, build real connections, and create positive impact through their
journeys.

It is not a safari company with a charity page. Travel, community and impact are
three parts of one product, and the interface has to make that obvious within
five seconds of landing on it.

African-born, internationally scalable. The first market is Tanzania; nothing in
the identity ties it there permanently.

### The three pillars

| Pillar | What it does |
|---|---|
| **Travel** | Gets people there |
| **Community** | Makes the journey mean something while they are on it |
| **Impact** | Makes it matter beyond the traveller |

### Voice

**Confident, warm, sophisticated.** Short sentences. Specific nouns. No
corporate abstraction, no exclamation marks, no urgency theatre.

Good:
> Find your next journey.
> Meet the people you'll travel with.
> Your journey can give back.
> Nobody remembers the itinerary. They remember who they were with.

Never:
> Leverage our innovative ecosystem to maximise travel outcomes.

Write to someone intelligent who has not heard of you. Say the true thing
plainly, including when it is unflattering — the pre-launch disclosures are
written in the same voice as the marketing copy, deliberately.

---

## The mark

The name comes from a spring — a source. The emblem reads as **ripples moving
out from a point, with one line leaving the centre and travelling beyond them**:
a journey that starts at a source and carries outward.

Three elements only — two ripple arcs, a travelling stroke, and the source dot —
so it survives being rendered at 16px as a favicon and cropped to a circle as an
avatar.

It is deliberately not a lion, an aeroplane or a heart. Those are illustrations
of the category, not marks of a brand.

**Geometry** is fixed on a 32×32 grid. Ripple arcs open toward the upper right;
the travelling stroke leaves through that opening. See
`apps/web/src/components/brand/Logo.tsx` — the paths are the specification.

### Usage

| Context | Form |
|---|---|
| Website header, documents | Mark + `ENHAKKORE` wordmark |
| Footer, sign-in, first impressions | Mark + wordmark + `TRAVEL & IMPACT` descriptor |
| Favicon, app icon, social avatar, watermark, merchandise | Mark alone |

The wordmark is set in Plus Jakarta Sans Bold with `0.14em` tracking. The
descriptor sits beneath at `0.28em`.

Over photography, the whole lockup goes white. On light ground the mark is
`acacia-700` and the wordmark is `ink`.

**Never:** recolour the mark arbitrarily, add a third element, stretch it, set
the wordmark in another typeface, or place the descriptor beside the wordmark
rather than beneath it.

---

## Colour

Defined once as Tailwind v4 `@theme` tokens in `apps/web/src/app/globals.css`.
White is the ground. Colour is used sparingly and always means something.

| Token | Hex | Means |
|---|---|---|
| `ink` | `#0E1113` | Structure, primary action, headings |
| `ink-soft` | `#2B3238` | Body copy |
| `ink-muted` | `#6A7279` | Secondary text, labels |
| `acacia-700` | `#14543F` | The brand — the mark, links, "this is Enhakkore" |
| `acacia-600` | `#1D6248` | Brand actions, positive states, availability |
| `clay-500` | `#B4602F` | **Impact only** — contributions, progress to a goal |
| `sand` | `#F7F4EE` | Quiet surfaces that separate without a line |
| `line` | `#E6E1D7` | Borders |

### The rule that matters

**Clay is reserved for impact.** It appears on contribution amounts, funding
progress, impact badges and nothing else. The moment it is used for generic
emphasis it stops meaning anything, and the impact story loses its visual
identity.

Primary buttons are `ink`, not `acacia`. Near-black reads as premium and
international; a green button reads as eco-lodge. The green is the brand's
signature, carried by the mark and by links — it does not need to shout from
every call to action.

---

## Typography

**Plus Jakarta Sans** throughout — geometric enough to feel modern, humanist
enough to read well at length.

| Scale | Size | Tracking | Use |
|---|---|---|---|
| `display` | 4.5rem | −0.035em | Hero headlines only |
| `h1` | 3rem | −0.03em | Page titles |
| `h2` | 2rem | −0.022em | Section heads |
| `h3` | 1.375rem | −0.015em | Card and block titles |
| body | 0.9375rem | normal | Everything else |
| `eyebrow` | 0.6875rem | +0.16em, uppercase | The label above every major section |

Display sizes get negative tracking; body stays at normal, because tightening
running text hurts reading.

Long-form copy uses `.prose-body`: 68ch measure, 1.7 line height. A measure
longer than that stops being readable no matter how good the type is.

---

## Photography

Large, immersive, cinematic. Landscapes, wildlife, coast, mountains, travellers
and human moments — always with room for a headline to sit over it.

Images always carry a two-stop scrim (`.scrim`) under text, never a flat wash,
and a faint inner edge (`.media`) so a photograph on white never looks pasted on.

### Rules

- No stereotypical or exoticising imagery of African people or communities.
- No stock-photo body language — handshakes over boardroom tables, people
  pointing at laptops.
- Never present generic photography as a picture of a specific project, trip or
  community. The catalogue in `apps/api/prisma/images.ts` names each image for
  what is actually in the frame precisely so this cannot happen by accident.
- Avatars are rendered from initials, not stock portraits. A real person's face
  should never stand in for a fictional traveller.

Current imagery is placeholder. Replace it with commissioned photography of real
trips and real projects — with consent — before launch.

---

## Interface principles

**White ground, generous space.** The premium feeling comes from restraint and
spacing, not from decoration.

**One primary action per screen.** `Button variant="primary"` is the thing you
came to do. Everything else is `secondary` or `ghost`.

**State the number next to the bar.** A progress bar alone asks the reader to
estimate. With money that is not good enough, so `Progress` is never used without
the amounts beside it.

**Empty states say what to do next.** Never just "no results".

**Availability, not scarcity theatre.** "16/20 joined · 4 spots left" is a fact.
Countdown timers and "3 people are viewing this" are not, and are not used.

**Touch targets are 44px minimum.** This is a phone-first product; the mobile
layouts are designed, not shrunk.

---

## Honesty in the interface

This is part of the brand, not a legal afterthought.

- `DemoBadge` marks anything generated by the seed — wherever a figure could be
  mistaken for a real achievement.
- The verified badge carries `· demo` on seeded operators.
- The checkout says plainly that no payment provider is connected.
- `/trust` and `/legal/*` say what has and has not been done, rather than
  publishing plausible-looking text nobody has checked.

A platform asking for money and trust should be able to say exactly what stands
behind both. When those things become true, remove the disclosure — not before.
