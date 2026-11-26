/**
 * Bootstrap — the real starting content, loaded on every deploy.
 *
 * Unlike seed.ts (fictional demonstration data for development), everything
 * here is genuine: the countries list, the categories the owner asked for,
 * Enhakkore's own trips as they were published in the site's content files,
 * the Mkuranga outreach with its photographs, the donation account supplied,
 * and the site's own logos and media registered in the library.
 *
 * It is safe to run any number of times. Each block runs once — recorded by a
 * marker in PlatformSetting — and only creates what is missing, so it never
 * overwrites an edit the owner has made in the control centre, and never
 * brings back something the owner deliberately deleted.
 *
 * It also creates the owner's account from OWNER_EMAIL / OWNER_PASSWORD when
 * those are set and no real owner exists yet.
 */
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { COUNTRIES, DEFAULT_ROLES, slugify } from '@enhakkore/shared';

const prisma = new PrismaClient();

async function once(key: string, work: () => Promise<void>) {
  const marker = `bootstrap.${key}`;
  if (await prisma.platformSetting.findUnique({ where: { key: marker } })) return;
  await work();
  await prisma.platformSetting.upsert({ where: { key: marker }, create: { key: marker, value: new Date().toISOString() }, update: {} });
  console.log(`› bootstrap: ${key}`);
}

/* ------------------------------- Geography -------------------------------- */

async function countries() {
  const existing = new Set((await prisma.country.findMany({ select: { code: true } })).map((row) => row.code));
  for (const country of COUNTRIES) {
    if (existing.has(country.code)) continue;
    await prisma.country.create({
      data: {
        code: country.code,
        name: country.name,
        slug: slugify(country.name) || country.code.toLowerCase(),
        region: country.region || null,
        currency: country.currency,
        timezone: country.timezone,
        latitude: country.latitude,
        longitude: country.longitude,
        featured: country.code === 'TZ',
        status: 'PUBLISHED',
      },
    });
  }
}

const CITIES = [
  { country: 'TZ', name: 'Dar es Salaam', latitude: -6.79, longitude: 39.21, featured: true, summary: 'Where the Enhakkore community starts: the coast, the city and everything happening in it.' },
  { country: 'TZ', name: 'Arusha', latitude: -3.37, longitude: 36.68, featured: true, summary: null },
  { country: 'TZ', name: 'Mkuranga', latitude: -7.12, longitude: 39.2, featured: false, summary: null },
];

async function cities() {
  for (const city of CITIES) {
    const country = await prisma.country.findUnique({ where: { code: city.country } });
    if (!country) continue;
    const slug = slugify(city.name);
    const found = await prisma.city.findUnique({ where: { countryId_slug: { countryId: country.id, slug } } });
    if (found) continue;
    await prisma.city.create({
      data: { countryId: country.id, name: city.name, slug, latitude: city.latitude, longitude: city.longitude, featured: city.featured, summary: city.summary },
    });
  }
}

/* -------------------------------- Categories ------------------------------- */

type CategorySeed = { kind: string; group: string | null; name: string; icon?: string; featured?: boolean };

const CATEGORIES: CategorySeed[] = [
  // Sports first, with basketball as a main category of its own.
  { kind: 'ACTIVITY', group: 'Sports', name: 'Basketball', icon: '🏀', featured: true },
  { kind: 'ACTIVITY', group: 'Sports', name: 'Football', icon: '⚽', featured: true },
  { kind: 'ACTIVITY', group: 'Sports', name: 'Tennis', icon: '🎾' },
  { kind: 'ACTIVITY', group: 'Sports', name: 'Volleyball', icon: '🏐' },
  { kind: 'ACTIVITY', group: 'Sports', name: 'Badminton', icon: '🏸' },
  { kind: 'ACTIVITY', group: 'Sports', name: 'Swimming', icon: '🏊' },
  { kind: 'ACTIVITY', group: 'Sports', name: 'Other sports', icon: '🏅' },
  { kind: 'ACTIVITY', group: 'Fitness & outdoors', name: 'Running', icon: '🏃', featured: true },
  { kind: 'ACTIVITY', group: 'Fitness & outdoors', name: 'Jogging', icon: '👟' },
  { kind: 'ACTIVITY', group: 'Fitness & outdoors', name: 'Walking', icon: '🚶' },
  { kind: 'ACTIVITY', group: 'Fitness & outdoors', name: 'Roller skating', icon: '🛼' },
  { kind: 'ACTIVITY', group: 'Fitness & outdoors', name: 'Cycling', icon: '🚴', featured: true },
  { kind: 'ACTIVITY', group: 'Fitness & outdoors', name: 'Hiking', icon: '🥾', featured: true },
  { kind: 'ACTIVITY', group: 'Fitness & outdoors', name: 'Outdoor workouts', icon: '💪' },
  { kind: 'ACTIVITY', group: 'Console gaming', name: 'PlayStation', icon: '🎮', featured: true },
  { kind: 'ACTIVITY', group: 'Console gaming', name: 'EA SPORTS FC', icon: '🎮' },
  { kind: 'ACTIVITY', group: 'Console gaming', name: 'FIFA', icon: '🎮' },
  { kind: 'ACTIVITY', group: 'Console gaming', name: 'eFootball', icon: '🎮' },
  { kind: 'ACTIVITY', group: 'Console gaming', name: 'Mortal Kombat', icon: '🎮' },
  { kind: 'ACTIVITY', group: 'Console gaming', name: 'Call of Duty', icon: '🎮' },
  { kind: 'ACTIVITY', group: 'Console gaming', name: 'Other multiplayer games', icon: '🕹️' },
  { kind: 'ACTIVITY', group: 'Online & mobile gaming', name: 'PUBG Mobile', icon: '📱', featured: true },
  { kind: 'ACTIVITY', group: 'Online & mobile gaming', name: 'Call of Duty Mobile', icon: '📱' },
  { kind: 'ACTIVITY', group: 'Online & mobile gaming', name: 'Mobile Legends', icon: '📱' },
  { kind: 'ACTIVITY', group: 'Online & mobile gaming', name: 'eFootball Mobile', icon: '📱' },
  { kind: 'ACTIVITY', group: 'Online & mobile gaming', name: 'Other mobile games', icon: '📱' },

  { kind: 'PLACE', group: 'Stay', name: 'Hotels', icon: '🏨', featured: true },
  { kind: 'PLACE', group: 'Stay', name: 'Resorts', icon: '🌴' },
  { kind: 'PLACE', group: 'Stay', name: 'Lodges', icon: '🛖' },
  { kind: 'PLACE', group: 'Stay', name: 'Guesthouses', icon: '🏡' },
  { kind: 'PLACE', group: 'Stay', name: 'Villas', icon: '🏠' },
  { kind: 'PLACE', group: 'Eat & drink', name: 'Restaurants', icon: '🍽️', featured: true },
  { kind: 'PLACE', group: 'Eat & drink', name: 'Cafés', icon: '☕' },
  { kind: 'PLACE', group: 'Eat & drink', name: 'Lounges', icon: '🛋️' },
  { kind: 'PLACE', group: 'Beaches & water', name: 'Beaches', icon: '🏖️', featured: true },
  { kind: 'PLACE', group: 'Beaches & water', name: 'Swimming pools', icon: '🏊' },
  { kind: 'PLACE', group: 'Beaches & water', name: 'Beach clubs', icon: '🍹' },
  { kind: 'PLACE', group: 'Going out', name: 'Nightlife', icon: '🌙', featured: true },
  { kind: 'PLACE', group: 'Going out', name: 'Entertainment venues', icon: '🎭' },
  { kind: 'PLACE', group: 'See & do', name: 'Attractions', icon: '📍', featured: true },
  { kind: 'PLACE', group: 'See & do', name: 'Cultural sites', icon: '🏛️' },
  { kind: 'PLACE', group: 'See & do', name: 'Shopping', icon: '🛍️' },
  { kind: 'PLACE', group: 'See & do', name: 'Hidden gems', icon: '💎', featured: true },
  { kind: 'PLACE', group: 'See & do', name: 'Other interesting places', icon: '✨' },

  { kind: 'EXPERIENCE', group: null, name: 'Cooking classes', icon: '👩‍🍳' },
  { kind: 'EXPERIENCE', group: null, name: 'Cultural experiences', icon: '🪘' },
  { kind: 'EXPERIENCE', group: null, name: 'Guided tours', icon: '🧭' },
  { kind: 'EXPERIENCE', group: null, name: 'Boat trips', icon: '⛵' },
  { kind: 'EXPERIENCE', group: null, name: 'Snorkelling', icon: '🤿' },
  { kind: 'EXPERIENCE', group: null, name: 'Hiking', icon: '🥾' },
  { kind: 'EXPERIENCE', group: null, name: 'Safaris', icon: '🦒' },
  { kind: 'EXPERIENCE', group: null, name: 'Workshops', icon: '🛠️' },
  { kind: 'EXPERIENCE', group: null, name: 'Photography tours', icon: '📷' },
  { kind: 'EXPERIENCE', group: null, name: 'Food experiences', icon: '🍲' },
  { kind: 'EXPERIENCE', group: null, name: 'Adventure activities', icon: '🧗' },
  { kind: 'EXPERIENCE', group: null, name: 'Community experiences', icon: '🤝' },

  { kind: 'EVENT', group: null, name: 'Parties', icon: '🎉' },
  { kind: 'EVENT', group: null, name: 'Silent parties', icon: '🎧' },
  { kind: 'EVENT', group: null, name: 'Halloween events', icon: '🎃' },
  { kind: 'EVENT', group: null, name: 'Costume events', icon: '🎭' },
  { kind: 'EVENT', group: null, name: 'Music events', icon: '🎵' },
  { kind: 'EVENT', group: null, name: 'Cultural festivals', icon: '🪘' },
  { kind: 'EVENT', group: null, name: 'Games', icon: '🎲' },
  { kind: 'EVENT', group: null, name: 'Social gatherings', icon: '🥂' },
  { kind: 'EVENT', group: null, name: 'Entertainment', icon: '🎤' },
  { kind: 'EVENT', group: null, name: 'Other events', icon: '📅' },
];

async function categories() {
  for (const [index, category] of CATEGORIES.entries()) {
    const slug = slugify(category.name);
    const found = await prisma.category.findUnique({ where: { kind_slug: { kind: category.kind, slug } } });
    if (found) continue;
    await prisma.category.create({
      data: {
        kind: category.kind,
        name: category.name,
        slug,
        group: category.group,
        icon: category.icon ?? null,
        featured: category.featured ?? false,
        sortOrder: index,
      },
    });
  }
}

/* --------------------------- The Enhakkore operator ------------------------- */

/**
 * Enhakkore's own trips need an operator record like any other. Its account
 * cannot sign in: the password is a random value nobody knows. The team runs
 * these trips from the control centre instead.
 */
async function enhakkoreOperator(): Promise<string> {
  const found = await prisma.organizer.findUnique({ where: { slug: 'enhakkore' } });
  if (found) return found.id;
  const user = await prisma.user.create({
    data: {
      email: 'travel@enhakkore.internal',
      name: 'Enhakkore Travel',
      passwordHash: await bcrypt.hash(crypto.randomBytes(48).toString('hex'), 10),
      role: 'ORGANIZER',
      country: 'Tanzania',
      city: 'Dar es Salaam',
      profileVisibility: 'HIDDEN',
      organizer: {
        create: {
          companyName: 'Enhakkore Travel & Impact',
          slug: 'enhakkore',
          tagline: 'Explore. Connect. Create impact.',
          country: 'Tanzania',
          city: 'Dar es Salaam',
          verificationStatus: 'VERIFIED',
          commissionRate: 0,
        },
      },
    },
    include: { organizer: true },
  });
  return user.organizer!.id;
}

async function destination(name: string, slug: string, latitude: number, longitude: number) {
  const found = await prisma.destination.findUnique({ where: { slug } });
  if (found) return found.id;
  return (await prisma.destination.create({ data: { name, slug, country: 'Tanzania', continent: 'Africa', latitude, longitude } })).id;
}

const ARUSHA_GALLERY = [
  { src: '/packages/arusha/napuru-waterfalls.webp', alt: 'Napuru Waterfalls, Arusha', credit: 'Tobias Kasambala', licence: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Napuru_waterfalls.jpg' },
  { src: '/packages/arusha/mount-meru.webp', alt: 'Mount Meru', credit: 'AmyAbroad', licence: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Mount_Meru_Tanzania_July_2025.jpg' },
  { src: '/packages/arusha/cultural-heritage-centre.webp', alt: 'Cultural Heritage Centre, Arusha', credit: 'George Lamson', licence: 'CC BY-SA 2.0', source: 'https://commons.wikimedia.org/wiki/File:Arusha_Cultural_Heritage_Centre.jpg' },
  { src: '/packages/arusha/arusha-city.webp', alt: 'Arusha', credit: 'Halidtz', licence: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Arusha_City_view.jpg' },
  { src: '/packages/arusha/chemka-1.webp', alt: 'Chemka / Kikuletwa Hot Springs', credit: 'Snomwajay', licence: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Chemka_Hot_Springs_01.jpg' },
  { src: '/packages/arusha/chemka-2.webp', alt: 'Chemka / Kikuletwa Hot Springs', credit: 'Daniel Msirikale', licence: 'CC BY-SA 4.0', source: 'https://commons.wikimedia.org/wiki/File:Chemka_Hot_Springs_6.jpg' },
];

/** Noon UTC, so a date never shifts to the day before in any time zone. */
const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

/**
 * Arusha Escape and Napuru Gateway, moved from apps/web/src/content into the
 * database so the owner can edit them. Every detail is copied from those files
 * as they were — nothing added. Seats already taken start at zero: the team
 * sets them from the control centre if places were sold by WhatsApp or phone.
 */
async function trips() {
  const organizerId = await enhakkoreOperator();
  const tz = await prisma.country.findUnique({ where: { code: 'TZ' } });
  const arushaCity = tz ? await prisma.city.findUnique({ where: { countryId_slug: { countryId: tz.id, slug: 'arusha' } } }) : null;

  if (!(await prisma.trip.findUnique({ where: { slug: 'arusha-escape' } }))) {
    const trip = await prisma.trip.create({
      data: {
        organizerId,
        destinationId: await destination('Arusha', 'arusha-tz', -3.37, 36.68),
        countryId: tz?.id ?? null,
        cityId: arushaCity?.id ?? null,
        title: 'Arusha Escape',
        subtitle: 'Adventure, Culture & Impact',
        slug: 'arusha-escape',
        type: 'GROUP',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        summary:
          'Three days away from the coast, in the green shadow of Mount Meru. A long road north with the people you will spend the weekend with, a day of waterfalls, craft and market colour in Arusha, and a last morning in the warm, impossibly clear water at Chemka before the journey home.',
        description:
          'Three days away from the coast, in the green shadow of Mount Meru. A long road north with the people you will spend the weekend with, a day of waterfalls, craft and market colour in Arusha, and a last morning in the warm, impossibly clear water at Chemka before the journey home. Built for a group of twenty-eight, and run by Enhakkore together with WSC.',
        destinationLabel: 'Arusha, Tanzania',
        departureCity: 'Dar es Salaam, Tanzania',
        meetingPoint: 'Mlimani City, Dar es Salaam',
        durationDays: 3,
        durationNights: 2,
        basePrice: 270_000,
        currency: 'TZS',
        priceTiers: JSON.stringify([
          { label: 'Tanzanian resident', note: 'Residents of Tanzania', amount: 270_000, currency: 'TZS' },
          { label: 'International visitor', note: 'Non-residents', amount: 25_000, currency: 'USD' },
        ]),
        heroImage: ARUSHA_GALLERY[0]!.src,
        gallery: JSON.stringify(ARUSHA_GALLERY.map((item) => item.src)),
        galleryItems: JSON.stringify(ARUSHA_GALLERY),
        accommodation: 'Two nights in Arusha.',
        transport: 'Return road transport from Dar es Salaam, and travel between the stops.',
        includes: JSON.stringify([
          'Accommodation — two nights in Arusha',
          'Transport — return road transport from Dar es Salaam, and travel between the stops',
          'Meals across the three days',
          'Entry fees to the sites on the itinerary',
          'Guiding fees throughout the weekend',
          'Swimming at Chemka hot springs, and the group games on the last day',
        ]),
        toConfirm: JSON.stringify(['The evening at ACES — subject to confirming the venue and access arrangements.']),
        paymentInstructions:
          'Please contact the trip organiser to confirm availability and payment instructions before sending money. Submit your payment confirmation using the official booking contact.',
        paymentOptions: JSON.stringify([
          { method: 'Vodacom M-Pesa', kind: 'Lipa number', number: '58475848', name: 'Marystella Kirati' },
          { method: 'Vodacom M-Pesa', kind: 'M-Pesa number', number: '0750998996', name: 'Neema Maganga' },
        ]),
        departures: {
          create: { startDate: day('2026-12-18'), endDate: day('2026-12-20'), capacity: 28, status: 'OPEN', expectedParticipants: 28 },
        },
        itinerary: {
          create: [
            {
              dayNumber: 1,
              label: 'Friday, 18 December',
              title: 'Dar es Salaam to Arusha',
              summary: 'The group meets, the road north begins, and the weekend starts over a briefing.',
              stops: JSON.stringify([
                { name: 'Mlimani City, Dar es Salaam', detail: 'Meeting point for the group before departure.' },
                { name: 'Travel to Arusha', detail: 'The journey north, together.' },
                { name: 'Check in and trip briefing', detail: 'Settle in, rest, meet the other travellers and run through the plan for the weekend.' },
              ]),
              activities: JSON.stringify(['Mlimani City, Dar es Salaam', 'Travel to Arusha', 'Check in and trip briefing']),
            },
            {
              dayNumber: 2,
              label: 'Saturday, 19 December',
              title: 'Adventure, Culture & Arusha City',
              summary: 'Waterfalls and a nature walk in the morning, craft and market colour in the afternoon.',
              stops: JSON.stringify([
                { name: 'Meru Eco Camp', detail: 'The day starts in the green country below Mount Meru.' },
                { name: 'Napuru Waterfalls', detail: 'A nature walk and hike to the falls.' },
                { name: 'Cultural Heritage Centre', detail: 'Tanzanian art, craft and history under one roof.' },
                { name: 'Maasai Market', detail: 'Colour, cloth and beadwork — and room to bargain.' },
                { name: 'Evening at ACES', detail: 'An evening outing to finish the day. Venue and access arrangements still to be confirmed.', provisional: true },
              ]),
              activities: JSON.stringify(['Meru Eco Camp', 'Napuru Waterfalls', 'Cultural Heritage Centre', 'Maasai Market', 'Evening at ACES']),
            },
            {
              dayNumber: 3,
              label: 'Sunday, 20 December',
              title: 'Crafts, Nature & Return',
              summary: 'Artisan workshops, the clear water at Chemka, then the road home.',
              stops: JSON.stringify([
                { name: 'Shanga', detail: 'Artisan glass, beadwork and weaving, made by a workshop built around social impact.' },
                { name: 'Chemka / Kikuletwa Hot Springs', detail: 'Warm, startlingly clear water under fig roots. Swimming, photographs and nothing to rush for.' },
                { name: 'Group games and bonding', detail: 'The part of a trip people actually remember.' },
                { name: 'Return to Dar es Salaam', detail: 'The journey home.' },
              ]),
              activities: JSON.stringify(['Shanga', 'Chemka / Kikuletwa Hot Springs', 'Group games and bonding', 'Return to Dar es Salaam']),
            },
          ],
        },
      },
    });
    console.log(`  › trip ${trip.slug}`);
  }

  if (!(await prisma.trip.findUnique({ where: { slug: 'napuru-gateway' } }))) {
    const trip = await prisma.trip.create({
      data: {
        organizerId,
        destinationId: await destination('Arusha', 'arusha-tz', -3.37, 36.68),
        countryId: tz?.id ?? null,
        cityId: arushaCity?.id ?? null,
        title: 'Napuru Gateway',
        subtitle: 'A day at the waterfalls',
        slug: 'napuru-gateway',
        type: 'ADVENTURE',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        summary: 'A day out to Napuru — the walk in through green country, the falls themselves, and a meal together.',
        description:
          'A day out to Napuru — the walk in through green country, the falls themselves, and a meal together. One day, one price, and a small group travelling as one.',
        destinationLabel: 'Napuru, Arusha',
        durationDays: 1,
        durationNights: 0,
        basePrice: 35_000,
        currency: 'TZS',
        // No photograph of this day was supplied; this is a licensed photograph
        // of Napuru Waterfalls, credited below. Replace it with your own.
        heroImage: ARUSHA_GALLERY[0]!.src,
        gallery: JSON.stringify([ARUSHA_GALLERY[0]!.src]),
        galleryItems: JSON.stringify([ARUSHA_GALLERY[0]]),
        includes: JSON.stringify(['Transport', 'One meal', 'The planned activity', 'Guiding fees']),
        paymentOptions: JSON.stringify([{ method: '', kind: 'Payment number', number: '255745341440', name: '' }]),
        // The number of places was never published; the date has passed, so
        // the departure is closed and its seat count is not shown anywhere.
        departures: { create: { startDate: day('2026-10-24'), endDate: day('2026-10-24'), capacity: 1, status: 'CLOSED' } },
      },
    });
    console.log(`  › trip ${trip.slug}`);
  }
}

/* --------------------------------- Impact --------------------------------- */

const MKURANGA_PHOTOS = [
  ['bus', 'Travelling down to Mkuranga together'],
  ['travelling', 'The team on the road from Dar es Salaam'],
  ['village', 'Arriving at Hoyoyo village, Mkuranga'],
  ['welcome', 'Children and volunteers gathered on arrival'],
  ['arrival-crowd', 'The group gathering at the village'],
  ['meal-served', 'Plates prepared for the shared meal'],
  ['plates', 'Sharing out the food'],
  ['meal-shared', 'The meal shared together on mats under the trees'],
  ['eating', 'Children eating together on the mats'],
  ['gathering', 'Children and volunteers under the trees'],
  ['under-trees', 'The group together under the trees'],
  ['together', 'The group during the afternoon'],
  ['afternoon', 'The afternoon at the village'],
  ['crowd-wide', 'The gathering at Hoyoyo village'],
  ['group', 'The whole group under the trees'],
  ['group-photo', 'Everyone together for a group photograph'],
  ['farewell', 'Waving at the end of the day'],
  ['waving', 'Waving as the day ends'],
] as const;

async function impact() {
  if (await prisma.impactProject.findUnique({ where: { slug: 'mkuranga-outreach' } })) return;
  await prisma.impactProject.create({
    data: {
      title: 'Mkuranga Community Outreach',
      slug: 'mkuranga-outreach',
      category: 'COMMUNITY',
      status: 'COMPLETED',
      summary:
        'A day spent with children at Hoyoyo village in Mkuranga — travelling down together, sharing a meal, and spending the afternoon with the community.',
      description: [
        'The team travelled from Dar es Salaam to Hoyoyo village in Mkuranga for the day. What had been planned on paper turned into something simpler once everyone arrived: a large group of children, a shade of trees, and an afternoon together.',
        'Food was prepared and shared on mats in the open. The children ate together, the volunteers served and sat with them, and the afternoon carried on from there — the kind of day that is easier to show in photographs than to describe.',
        'This was Enhakkore’s own community outreach, carried out with the people who travel with us and with WSC. It is recorded here as it happened, in October 2026, without claims about how much was spent or how many people it reached.',
      ].join('\n\n'),
      beneficiaryGroup: 'Children of Hoyoyo village, Mkuranga',
      location: 'Hoyoyo village, Mkuranga, Tanzania',
      country: 'Tanzania',
      latitude: -7.12,
      longitude: 39.2,
      goal: 0,
      currency: 'TZS',
      heroImage: '/impact/mkuranga/cover.webp',
      gallery: JSON.stringify(MKURANGA_PHOTOS.map(([file]) => `/impact/mkuranga/${file}.webp`)),
      partnerName: 'WSC — We Save Children',
      partnerNote: 'Carried out together with WSC. WSC is its own charity group, not a part of Enhakkore.',
      featured: true,
      showFunding: false,
      isDemo: false,
    },
  });
}

/* -------------------------------- Payments -------------------------------- */

/**
 * The donation account exactly as supplied — account name and number only.
 * No bank name, branch, SWIFT code or currency is added, because none was given.
 */
async function paymentMethods() {
  const existing = await prisma.paymentMethod.findFirst({ where: { accountNumber: '0745341440' } });
  if (existing) return;
  await prisma.paymentMethod.create({
    data: {
      name: 'Donation account',
      kind: 'BANK_TRANSFER',
      accountName: 'Selcom',
      accountNumber: '0745341440',
      scopes: JSON.stringify(['DONATIONS']),
      currencies: JSON.stringify([]),
      instructions:
        'Send your donation using a transfer method your bank supports, to the account name and number above. Then send your payment confirmation to Enhakkore on WhatsApp so it can be verified and recorded.',
      referenceFormat: 'Your name, and the project you are giving to',
      isDefault: true,
      sortOrder: 0,
      status: 'ENABLED',
    },
  });
}

/* ---------------------------------- Roles --------------------------------- */

async function roles() {
  for (const role of DEFAULT_ROLES) {
    if (await prisma.adminRole.findUnique({ where: { name: role.name } })) continue;
    await prisma.adminRole.create({
      data: { name: role.name, description: role.description, permissions: JSON.stringify(role.permissions), scope: role.scope ?? 'ALL', isSystem: true },
    });
  }
}

/* ------------------------------- Media library ----------------------------- */

async function media() {
  const files = [
    { url: '/partners/enhakkore-wordmark.webp', title: 'Enhakkore logo (original)', folder: 'Brand', alt: 'Enhakkore Travel & Impact logo' },
    { url: '/partners/enhakkore-mark.webp', title: 'Enhakkore emblem (original)', folder: 'Brand', alt: 'Enhakkore emblem' },
    { url: '/partners/wsc.webp', title: 'WSC logo (original)', folder: 'Brand', alt: 'WSC — We Save Children logo' },
    { url: '/media/hero/safari-tourist-poster-v1.jpg', title: 'Homepage hero photograph', folder: 'Homepage', alt: 'A traveller in an open safari vehicle photographing a giraffe', credit: 'In Old News LLC, Pexels' },
    { url: '/media/hero/safari-tourist-720-v1.mp4', title: 'Homepage hero video', folder: 'Homepage', kind: 'VIDEO', credit: 'In Old News LLC, Pexels (Pexels License)' },
    { url: '/impact/mkuranga/cover.webp', title: 'Mkuranga outreach — cover', folder: 'Impact — Mkuranga outreach', alt: 'The outreach team and children of Hoyoyo village together' },
    ...MKURANGA_PHOTOS.map(([file, alt]) => ({ url: `/impact/mkuranga/${file}.webp`, title: alt, folder: 'Impact — Mkuranga outreach', alt })),
    ...ARUSHA_GALLERY.map((item) => ({ url: item.src, title: item.alt, folder: 'Trips — Arusha', alt: item.alt, credit: `${item.credit} (${item.licence})` })),
  ];
  for (const file of files) {
    if (await prisma.mediaAsset.findFirst({ where: { url: file.url } })) continue;
    await prisma.mediaAsset.create({
      data: { url: file.url, title: file.title, folder: file.folder, alt: file.alt ?? null, credit: (file as { credit?: string }).credit ?? null, kind: (file as { kind?: string }).kind ?? 'IMAGE', isSystem: true },
    });
  }
}

/* ---------------------------------- Owner --------------------------------- */

/**
 * Creates the owner's account from OWNER_EMAIL and OWNER_PASSWORD, once, when
 * no real (non-demonstration) owner exists. The password is used only to make
 * the hash and is never logged.
 */
async function owner() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password) return;
  const realOwner = await prisma.user.findFirst({ where: { role: 'ADMIN', isDemo: false } });
  if (realOwner) return;
  if (password.length < 12) {
    console.warn('› bootstrap: OWNER_PASSWORD must be at least 12 characters — owner not created.');
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(password, 12);
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN', adminRoleId: null, isDemo: false, status: 'ACTIVE', passwordHash, passwordChangedAt: new Date() } });
  } else {
    await prisma.user.create({ data: { email, name: process.env.OWNER_NAME?.trim() || 'Enhakkore owner', role: 'ADMIN', passwordHash } });
  }
  console.log(`› bootstrap: owner account ready for ${email}`);
}


/* ------------------------------ Version 2 content ---------------------------- */

/** Puts every existing category in its part of the site (Explore or Experiences). Only fills empty sections. */
async function sections() {
  const groupSection: Record<string, string> = {
    Sports: 'SPORTS',
    'Fitness & outdoors': 'SPORTS',
    'Console gaming': 'GAMING',
    'Online & mobile gaming': 'GAMING',
    Stay: 'STAYS',
    'Eat & drink': 'FOOD',
    'Beaches & water': 'ATTRACTIONS',
    'Going out': 'ATTRACTIONS',
    'See & do': 'ATTRACTIONS',
  };
  const nameSection: Record<string, string> = {
    Hiking: 'OUTDOOR',
    Cycling: 'OUTDOOR',
    Walking: 'OUTDOOR',
    Parties: 'PARTIES',
    'Silent parties': 'PARTIES',
    'Halloween events': 'PARTIES',
    'Costume events': 'PARTIES',
    'Social gatherings': 'PARTIES',
    'Music events': 'ARTS',
    'Cultural festivals': 'ARTS',
    Entertainment: 'PARTIES',
    Games: 'GAMING',
    'Other events': 'OTHER',
    'Entertainment venues': 'VENUES',
  };
  for (const category of await prisma.category.findMany({ where: { section: null, kind: { in: ['ACTIVITY', 'EVENT', 'PLACE'] } } })) {
    const section = nameSection[category.name] ?? (category.group ? groupSection[category.group] : undefined) ?? (category.kind === 'PLACE' ? 'ATTRACTIONS' : 'OTHER');
    await prisma.category.update({ where: { id: category.id }, data: { section } });
  }
  // Categories the brief names that did not exist yet.
  const extra: { kind: string; name: string; group: string; section: string; icon: string }[] = [
    { kind: 'PLACE', name: 'Apartments', group: 'Stay', section: 'STAYS', icon: '🏢' },
    { kind: 'PLACE', name: 'Holiday homes', group: 'Stay', section: 'STAYS', icon: '🏡' },
    { kind: 'PLACE', name: 'Food outlets', group: 'Eat & drink', section: 'FOOD', icon: '🥡' },
    { kind: 'PLACE', name: 'Catering', group: 'Eat & drink', section: 'FOOD', icon: '🍱' },
    { kind: 'PLACE', name: 'Wedding venues', group: 'Venues', section: 'VENUES', icon: '💒' },
    { kind: 'PLACE', name: 'Conference halls', group: 'Venues', section: 'VENUES', icon: '🏛️' },
    { kind: 'PLACE', name: 'Party venues', group: 'Venues', section: 'VENUES', icon: '🎉' },
    { kind: 'PLACE', name: 'Gardens', group: 'Venues', section: 'VENUES', icon: '🌿' },
    { kind: 'PLACE', name: 'Rooftops', group: 'Venues', section: 'VENUES', icon: '🌇' },
    { kind: 'PLACE', name: 'Private event spaces', group: 'Venues', section: 'VENUES', icon: '🔑' },
    { kind: 'PLACE', name: 'Recreation centres', group: 'See & do', section: 'ATTRACTIONS', icon: '🎳' },
    { kind: 'PLACE', name: 'Nature destinations', group: 'See & do', section: 'ATTRACTIONS', icon: '🌳' },
    { kind: 'ACTIVITY', name: 'Art & creativity', group: 'Arts & culture', section: 'ARTS', icon: '🎨' },
    { kind: 'ACTIVITY', name: 'Meetups', group: 'Communities', section: 'COMMUNITIES', icon: '🤝' },
    { kind: 'ACTIVITY', name: 'Workshops', group: 'Learning', section: 'LEARNING', icon: '📚' },
    { kind: 'ACTIVITY', name: 'Outdoor adventures', group: 'Outdoor', section: 'OUTDOOR', icon: '🏞️' },
    { kind: 'ACTIVITY', name: 'Gaming tournaments', group: 'Online & mobile gaming', section: 'GAMING', icon: '🏆' },
    { kind: 'ACTIVITY', name: 'Other experiences', group: 'Other', section: 'OTHER', icon: '✨' },
  ];
  for (const [index, item] of extra.entries()) {
    const slug = slugify(item.name);
    if (await prisma.category.findUnique({ where: { kind_slug: { kind: item.kind, slug } } })) continue;
    await prisma.category.create({ data: { ...item, slug, sortOrder: 200 + index } });
  }
}

/** The games the gaming hub starts with. Editable under Categories → Games. */
async function games() {
  const list: { name: string; group: string }[] = [
    { name: 'Free Fire', group: 'Mobile' },
    { name: 'PUBG Mobile', group: 'Mobile' },
    { name: 'Call of Duty Mobile', group: 'Mobile' },
    { name: 'Delta Force', group: 'Mobile & PC' },
    { name: 'Mobile Legends', group: 'Mobile' },
    { name: 'Brawl Stars', group: 'Mobile' },
    { name: 'Fortnite', group: 'Console & PC' },
    { name: 'eFootball', group: 'Console & mobile' },
    { name: 'EA SPORTS FC Mobile', group: 'Mobile' },
    { name: 'EA SPORTS FC', group: 'Console' },
    { name: 'Mortal Kombat', group: 'Console' },
    { name: 'Tekken', group: 'Console' },
    { name: 'WWE 2K', group: 'Console' },
    { name: 'Call of Duty', group: 'Console' },
    { name: 'NBA 2K', group: 'Console' },
  ];
  for (const [index, game] of list.entries()) {
    const slug = slugify(game.name);
    if (await prisma.category.findUnique({ where: { kind_slug: { kind: 'GAME', slug } } })) continue;
    await prisma.category.create({ data: { kind: 'GAME', name: game.name, slug, group: game.group, section: 'GAMING', icon: '🎮', sortOrder: index } });
  }
}

/** Adds roles the latest brief asks for, without touching roles the owner has edited. */
async function rolesV2() {
  for (const role of DEFAULT_ROLES) {
    if (await prisma.adminRole.findUnique({ where: { name: role.name } })) continue;
    await prisma.adminRole.create({ data: { name: role.name, description: role.description, permissions: JSON.stringify(role.permissions), scope: role.scope ?? 'ALL', isSystem: true } });
  }
}

/**
 * The Arusha Escape as the brief describes it: accommodation not yet booked,
 * transport and meals provisional, and the trip held as a draft for the owner's
 * final check before it is published.
 */
async function arushaVerification() {
  const trip = await prisma.trip.findUnique({ where: { slug: 'arusha-escape' } });
  if (!trip) return;
  await prisma.trip.update({
    where: { id: trip.id },
    data: {
      status: 'DRAFT',
      stage: 'REGISTRATION_OPEN',
      maxParticipants: 28,
      meetingPoint: 'Mlimani City, Dar es Salaam — Friday morning',
      departureCity: 'Dar es Salaam (Mlimani City), Friday morning; return Sunday evening or night',
      accommodation: 'Two nights in Arusha. Accommodation has not been booked yet — the property will be confirmed before departure.',
      transport: 'Return road transport from Dar es Salaam and travel between the stops. Costs are a provisional estimate until the transport provider is confirmed.',
      includes: JSON.stringify([
        'Accommodation for two nights in Arusha (to be booked and confirmed)',
        'Return road transport from Dar es Salaam, and travel between the stops (provisional)',
        'Meals across the three days (provisional)',
        'Entry fees to the sites on the itinerary',
        'Guiding fees throughout the weekend',
      ]),
      toConfirm: JSON.stringify([
        'Accommodation — not yet booked.',
        'Transport — provisional cost estimate, provider to be confirmed.',
        'Meals — provisional cost estimate.',
        'The evening at ACES — subject to confirming the venue and access arrangements.',
      ]),
      reviewNotes: 'Imported from the original trip materials. Check every detail — accommodation, transport, meals, price and itinerary — then publish.',
    },
  });
}

/**
 * The Saturday community jog, as a draft. The exact beach, route distance and
 * meeting instructions were not supplied, so the page stays a draft until the
 * owner fills them in and publishes it.
 */
async function jogging() {
  if (await prisma.activity.findUnique({ where: { slug: 'saturday-community-jog' } })) return;
  const tz = await prisma.country.findUnique({ where: { code: 'TZ' } });
  const dar = tz ? await prisma.city.findUnique({ where: { countryId_slug: { countryId: tz.id, slug: 'dar-es-salaam' } } }) : null;
  const category = await prisma.category.findUnique({ where: { kind_slug: { kind: 'ACTIVITY', slug: 'jogging' } } });
  await prisma.activity.create({
    data: {
      slug: 'saturday-community-jog',
      title: 'Saturday Community Jog',
      summary: 'Every Saturday at 06:30 from Sayansi towards the beach. Free — register for each session.',
      description:
        'A free community jog every Saturday morning. We start at 06:30 at Sayansi and run towards the beach together. All paces welcome. Register for each Saturday’s session so we know who is coming.\n\n[To confirm before publishing: the exact beach, the route distance and the meeting instructions.]',
      categoryId: category?.id ?? null,
      countryId: tz?.id ?? null,
      cityId: dar?.id ?? null,
      mode: 'IN_PERSON',
      meetingPoint: 'Sayansi (exact meeting spot to be confirmed)',
      timezone: 'Africa/Dar_es_Salaam',
      recurrence: 'Every Saturday, 06:30',
      level: 'ALL',
      source: 'ADMIN',
      organiserName: 'Enhakkore',
      status: 'DRAFT',
      reviewNotes: 'Confirm the beach destination, route distance and meeting instructions, add the Saturday sessions, then publish.',
    },
  });
}

async function main() {
  await once('countries.v1', countries);
  await once('cities.v1', cities);
  await once('categories.v1', categories);
  await once('trips.v1', trips);
  await once('impact.v1', impact);
  await once('payment-methods.v1', paymentMethods);
  await once('roles.v1', roles);
  await once('media.v1', media);
  await once('sections.v2', sections);
  await once('games.v2', games);
  await once('roles.v2', rolesV2);
  await once('arusha-verification.v2', arushaVerification);
  await once('jogging.v2', jogging);
  // Not run once: a fresh deploy with the variables set is how the owner is created.
  await owner();
}

main()
  .catch((error) => {
    console.error('[bootstrap] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
