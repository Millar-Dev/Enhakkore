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

/**
 * WSC is part of Enhakkore Impact, not a separate organisation. Rewrites the
 * earlier wording in records already in the database — only where the text is
 * still exactly what the bootstrap wrote, so the owner's own edits are kept.
 */
async function wscWording() {
  const replacements: [string, string][] = [
    ['This was Enhakkore’s own community outreach, carried out with the people who travel with us and with WSC.', 'This was Enhakkore’s own community outreach through WSC — We Save Children, part of Enhakkore Impact — carried out with the people who travel with us.'],
  ];
  for (const project of await prisma.impactProject.findMany({ select: { id: true, description: true, partnerNote: true } })) {
    let description = project.description;
    for (const [from, to] of replacements) description = description.replace(from, to);
    const partnerNote = project.partnerNote === 'Carried out together with WSC. WSC is its own charity group, not a part of Enhakkore.' ? 'WSC — We Save Children is an initiative within Enhakkore Impact.' : project.partnerNote;
    if (description !== project.description || partnerNote !== project.partnerNote) await prisma.impactProject.update({ where: { id: project.id }, data: { description, partnerNote } });
  }
  for (const trip of await prisma.trip.findMany({ select: { id: true, summary: true, description: true } })) {
    const fix = (text: string) => text.replace('Built for a group of twenty-eight, and run by Enhakkore together with WSC.', 'Built for a group of twenty-eight, and run by Enhakkore.');
    if (fix(trip.summary) !== trip.summary || fix(trip.description) !== trip.description) await prisma.trip.update({ where: { id: trip.id }, data: { summary: fix(trip.summary), description: fix(trip.description) } });
  }
  // Saved settings that still hold the old default wording.
  const oldIntro = 'WSC — We Save Children — is a charity group working so that no child grows up in poverty. Enhakkore’s impact work is carried out together with WSC. WSC is its own organisation, not a part of Enhakkore.';
  const impactRow = await prisma.platformSetting.findUnique({ where: { key: 'site.impact' } });
  if (impactRow?.value.includes(oldIntro.slice(0, 60))) {
    const value = JSON.parse(impactRow.value) as Record<string, unknown>;
    if (value.wscIntro === oldIntro) {
      value.wscIntro = 'WSC — We Save Children — is an initiative within Enhakkore Impact, working so that no child grows up in poverty.';
      await prisma.platformSetting.update({ where: { key: 'site.impact' }, data: { value: JSON.stringify(value) } });
    }
  }
  const heroRow = await prisma.platformSetting.findUnique({ where: { key: 'site.homepage' } });
  if (heroRow) {
    const value = JSON.parse(heroRow.value) as { hero?: Record<string, string> };
    if (value.hero && value.hero.title === 'Travel Further. Connect Deeper. Create Impact.' && value.hero.primaryLabel === 'Explore the World') {
      value.hero = { ...value.hero, eyebrow: 'Travel · Experiences · Community · Impact', title: 'Explore Experiences. Create Impact.', subtitle: 'Discover remarkable places, join activities, travel with purpose and connect with people across Tanzania and beyond.', primaryLabel: 'Explore Now', secondaryLabel: 'Discover Experiences', secondaryHref: '/experiences' };
      await prisma.platformSetting.update({ where: { key: 'site.homepage' }, data: { value: JSON.stringify(value) } });
    }
  }
  const homeRow = await prisma.platformSetting.findUnique({ where: { key: 'site.homepage' } });
  if (homeRow?.value.includes('Community projects with WSC — We Save Children.')) {
    await prisma.platformSetting.update({ where: { key: 'site.homepage' }, data: { value: homeRow.value.replace('Community projects with WSC — We Save Children.', 'Enhakkore Impact — including WSC, We Save Children.') } });
  }
}

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
          'Three days away from the coast, in the green shadow of Mount Meru. A long road north with the people you will spend the weekend with, a day of waterfalls, craft and market colour in Arusha, and a last morning in the warm, impossibly clear water at Chemka before the journey home. Built for a group of twenty-eight, and run by Enhakkore.',
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
        'This was Enhakkore’s own community outreach through WSC — We Save Children, part of Enhakkore Impact — carried out with the people who travel with us. It is recorded here as it happened, in October 2026, without claims about how much was spent or how many people it reached.',
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
      partnerNote: 'WSC — We Save Children is an initiative within Enhakkore Impact.',
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
  // The one-time setup has already run: never create or reset an owner again.
  if (await prisma.platformSetting.findUnique({ where: { key: 'setup.completed' } })) return;
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
  await prisma.platformSetting.upsert({ where: { key: 'setup.completed' }, create: { key: 'setup.completed', value: new Date().toISOString() }, update: {} });
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


/* ------------------------------ Version 3 content ---------------------------- */

const DEMO_NOTE = '\n\nThis is a DEMO listing created to show how the website works. It is not a real scheduled activity — the Enhakkore team will replace it with real ones.';

/** A city from the GeoNames dataset (or the one already stored), by name. */
async function geoCity(countryCode: string, name: string) {
  const country = await prisma.country.findUnique({ where: { code: countryCode } });
  if (!country) return null;
  const slug = slugify(name);
  const found = await prisma.city.findUnique({ where: { countryId_slug: { countryId: country.id, slug } } });
  if (found) return found;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const all = require('all-the-cities') as { cityId: number; name: string; country: string; population: number; loc: { coordinates: [number, number] } }[];
  const geo = all.filter((city) => city.country === countryCode && city.name.toLowerCase() === name.toLowerCase()).sort((a, b) => b.population - a.population)[0];
  return prisma.city.create({
    data: { countryId: country.id, name, slug, latitude: geo?.loc.coordinates[1] ?? null, longitude: geo?.loc.coordinates[0] ?? null, geonameId: geo?.cityId ?? null },
  });
}

async function category(kind: string, name: string, extra: { group?: string; section?: string; icon?: string } = {}) {
  const slug = slugify(name);
  const found = await prisma.category.findUnique({ where: { kind_slug: { kind, slug } } });
  if (found) return found;
  return prisma.category.create({ data: { kind, name, slug, group: extra.group ?? null, section: extra.section ?? null, icon: extra.icon ?? null, sortOrder: 300 } });
}

/** A future moment: `days` from now at hh:mm local time in Dar es Salaam (UTC+3). */
function inDays(days: number, hour: number, minute = 0): Date {
  const base = new Date();
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + days, hour - 3, minute));
  return d;
}
function nextWeekday(weekday: number, hour: number, minute = 0, weeksAhead = 0): Date {
  const now = new Date();
  const diff = (weekday - now.getUTCDay() + 7) % 7 || 7;
  return inDays(diff + weeksAhead * 7, hour, minute);
}

/** The owner asked for the Arusha Escape to be visible: it is published, with its provisional items still listed. */
async function publishArusha() {
  const trip = await prisma.trip.findUnique({ where: { slug: 'arusha-escape' } });
  if (!trip || trip.status === 'PUBLISHED') return;
  await prisma.trip.update({ where: { id: trip.id }, data: { status: 'PUBLISHED', publishedAt: trip.publishedAt ?? new Date(), stage: 'REGISTRATION_OPEN' } });
}

/** Clearly labelled example content so every section can be seen and tested. */
async function demoContent() {
  const tz = await prisma.country.findUnique({ where: { code: 'TZ' } });
  const dar = await geoCity('TZ', 'Dar es Salaam');
  if (!tz || !dar) return;
  const cats = {
    jogging: await category('ACTIVITY', 'Jogging', { section: 'SPORTS' }),
    basketball: await category('ACTIVITY', 'Basketball', { section: 'SPORTS' }),
    skating: await category('ACTIVITY', 'Roller skating', { section: 'SPORTS' }),
    art: await category('ACTIVITY', 'Art & creativity', { section: 'ARTS', icon: '🎨' }),
    hiking: await category('ACTIVITY', 'Hiking', { section: 'OUTDOOR' }),
    workshop: await category('ACTIVITY', 'Workshops', { section: 'LEARNING', icon: '📚' }),
    social: await category('ACTIVITY', 'Social nights', { group: 'Parties & social', section: 'PARTIES', icon: '🎉' }),
    gamingNight: await category('ACTIVITY', 'Gaming tournaments', { section: 'GAMING', icon: '🏆' }),
  };
  const activities: { slug: string; title: string; summary: string; categoryId: string; days: number; hour: number; recurrence?: string; capacity?: number; level?: string; sessions?: number }[] = [
    { slug: 'demo-sunrise-community-jog', title: 'Sunrise community jog (sample sessions)', summary: 'A weekly group jog with a separate registration list for each Saturday.', categoryId: cats.jogging.id, days: 0, hour: 6, recurrence: 'Every Saturday, 06:30', capacity: 30, sessions: 4 },
    { slug: 'demo-pickup-basketball', title: 'Pickup basketball evening', summary: 'Friendly mixed-level games, teams picked on the night.', categoryId: cats.basketball.id, days: 4, hour: 17, capacity: 20, level: 'ALL' },
    { slug: 'demo-roller-skating-meetup', title: 'Roller skating meetup', summary: 'Skate together, beginners welcome — bring your own skates.', categoryId: cats.skating.id, days: 6, hour: 16, capacity: 25, level: 'BEGINNER' },
    { slug: 'demo-open-studio-painting', title: 'Open studio: painting and sketching', summary: 'An afternoon of painting with materials shared on the table.', categoryId: cats.art.id, days: 9, hour: 14, capacity: 15 },
    { slug: 'demo-weekend-hike', title: 'Weekend nature hike', summary: 'A half-day hike with a stop for lunch.', categoryId: cats.hiking.id, days: 11, hour: 7, capacity: 18, level: 'INTERMEDIATE' },
    { slug: 'demo-photography-workshop', title: 'Beginner photography workshop', summary: 'Learn framing and light with your phone camera.', categoryId: cats.workshop.id, days: 13, hour: 10, capacity: 12, level: 'BEGINNER' },
    { slug: 'demo-rooftop-social-night', title: 'Rooftop social night', summary: 'Music, conversation and new people — an evening to meet the community.', categoryId: cats.social.id, days: 15, hour: 19, capacity: 60 },
  ];
  for (const item of activities) {
    if (await prisma.activity.findUnique({ where: { slug: item.slug } })) continue;
    const startsAt = item.sessions ? nextWeekday(6, 6, 30) : inDays(item.days, item.hour);
    const activity = await prisma.activity.create({
      data: {
        slug: item.slug,
        title: item.title,
        summary: item.summary,
        description: `${item.summary}${DEMO_NOTE}`,
        categoryId: item.categoryId,
        countryId: tz.id,
        cityId: dar.id,
        meetingPoint: 'Example meeting point (demo)',
        startsAt,
        timezone: 'Africa/Dar_es_Salaam',
        recurrence: item.recurrence ?? null,
        capacity: item.capacity ?? null,
        level: item.level ?? 'ALL',
        organiserName: 'Enhakkore (demo)',
        source: 'ADMIN',
        status: 'PUBLISHED',
        publishedAt: new Date(),
        isDemo: true,
      },
    });
    for (let week = 0; week < (item.sessions ?? 0); week += 1) {
      await prisma.activitySession.create({ data: { activityId: activity.id, startsAt: nextWeekday(6, 6, 30, week), capacity: item.capacity ?? null, route: 'Example route (demo)' } });
    }
  }

  const games: { slug: string; game: string; title: string; kind: string; format: string; teamSize: number; slots: number; days: number; server?: string; venue?: string; cover: string }[] = [
    { slug: 'demo-free-fire-squad-cup', game: 'Free Fire', title: 'Free Fire Squad Cup', kind: 'ONLINE', format: 'SQUAD', teamSize: 4, slots: 24, days: 10, server: 'Africa', cover: 'cover-free-fire.jpg' },
    { slug: 'demo-pubg-mobile-showdown', game: 'PUBG Mobile', title: 'PUBG Mobile Squad Showdown', kind: 'ONLINE', format: 'SQUAD', teamSize: 4, slots: 16, days: 12, server: 'Asia / Middle East', cover: 'cover-pubg-mobile.jpg' },
    { slug: 'demo-codm-duo-challenge', game: 'Call of Duty Mobile', title: 'Call of Duty: Mobile Duo Challenge', kind: 'ONLINE', format: 'DUO', teamSize: 2, slots: 32, days: 14, cover: 'cover-call-of-duty-mobile.jpg' },
    { slug: 'demo-delta-force-open', game: 'Delta Force', title: 'Delta Force Team Open', kind: 'ONLINE', format: 'TEAM', teamSize: 4, slots: 16, days: 16, cover: 'cover-delta-force.jpg' },
    { slug: 'demo-mlbb-5v5-league', game: 'Mobile Legends', title: 'Mobile Legends 5v5 League', kind: 'ONLINE', format: 'TEAM', teamSize: 5, slots: 12, days: 18, cover: 'cover-mobile-legends.jpg' },
    { slug: 'demo-efootball-solo-cup', game: 'eFootball', title: 'eFootball Solo Cup', kind: 'ONLINE', format: 'SOLO', teamSize: 1, slots: 64, days: 8, cover: 'cover-efootball.jpg' },
    { slug: 'demo-ea-fc-console-night', game: 'EA SPORTS FC', title: 'EA SPORTS FC Console Night', kind: 'CONSOLE', format: 'SOLO', teamSize: 1, slots: 16, days: 6, venue: 'Example gaming lounge (demo)', cover: 'cover-ea-sports-fc.jpg' },
    { slug: 'demo-tekken-fight-night', game: 'Tekken', title: 'Tekken Fight Night', kind: 'CONSOLE', format: 'SOLO', teamSize: 1, slots: 16, days: 20, venue: 'Example gaming lounge (demo)', cover: 'cover-tekken.jpg' },
  ];
  for (const item of games) {
    if (await prisma.tournament.findUnique({ where: { slug: item.slug } })) continue;
    const game = await category('GAME', item.game, { section: 'GAMING', icon: '🎮' });
    await prisma.tournament.create({
      data: {
        slug: item.slug,
        title: item.title,
        gameId: game.id,
        kind: item.kind,
        format: item.format,
        teamSize: item.teamSize,
        slots: item.slots,
        summary: `${item.kind === 'ONLINE' ? 'Online' : 'Console'} ${item.format.toLowerCase()} competition — an example of how tournaments appear on Enhakkore.`,
        description: `Free to enter. Rules, brackets and results are published on this page.${DEMO_NOTE.replace('activity', 'tournament')}`,
        startsAt: inDays(item.days, 19),
        registrationDeadline: inDays(item.days - 1, 23, 59),
        server: item.server ?? null,
        venue: item.venue ?? null,
        countryId: tz.id,
        cityId: item.kind === 'CONSOLE' ? dar.id : null,
        rules: 'Example rules: play fair, use your own account, be on time, report results with a screenshot.',
        disputeProcedure: 'Raise disputes with the organiser within 30 minutes of the match, with evidence.',
        organiserName: 'Enhakkore (demo)',
        coverImage: `/media/gaming/${item.cover}`,
        status: 'REGISTRATION_OPEN',
        publishedAt: new Date(),
        isDemo: true,
      },
    });
  }

  const communities = [
    { slug: 'demo-dar-runners', name: 'Dar Runners', summary: 'People who run together in Dar es Salaam.', categoryId: cats.jogging.id },
    { slug: 'demo-tanzania-gaming', name: 'Tanzania Gaming', summary: 'Mobile and console gamers across Tanzania.', categoryId: cats.gamingNight.id },
    { slug: 'demo-dar-basketball', name: 'Dar Basketball', summary: 'Pickup games, leagues and training sessions.', categoryId: cats.basketball.id },
    { slug: 'demo-art-and-creativity', name: 'Art & Creativity Circle', summary: 'Painters, makers and photographers meeting monthly.', categoryId: cats.art.id },
  ];
  for (const item of communities) {
    if (await prisma.community.findUnique({ where: { slug: item.slug } })) continue;
    await prisma.community.create({
      data: { ...item, description: `${item.summary}\n\nThis is a DEMO community created to show how communities work.`, countryId: tz.id, cityId: dar.id, status: 'PUBLISHED', publishedAt: new Date(), isDemo: true },
    });
  }

  // A demo trip for testing the trip screens in the control centre. Kept as a draft: never public.
  if (!(await prisma.trip.findUnique({ where: { slug: 'demo-weekend-safari' } }))) {
    const organizerId = (await prisma.organizer.findUniqueOrThrow({ where: { slug: 'enhakkore' } })).id;
    const destination = await prisma.destination.findFirst();
    if (destination) {
      await prisma.trip.create({
        data: {
          organizerId,
          destinationId: destination.id,
          title: 'Weekend safari (DEMO — for testing)',
          slug: 'demo-weekend-safari',
          summary: 'A demo trip for practising in the control centre. Not a real trip; prices are placeholders.',
          description: 'Use this draft to practise adding departures, prices and itinerary days. Delete it when you are done.',
          type: 'SAFARI',
          status: 'DRAFT',
          durationDays: 2,
          durationNights: 1,
          basePrice: 0,
          currency: 'TZS',
          heroImage: '/media/hero/safari-tourist-poster-v1.jpg',
          isDemo: true,
        },
      });
    }
  }
}

/**
 * Real places researched from public sources on 26 November 2026. Only details
 * that several sources agree on are stored; phone numbers, hours and prices
 * (which conflicted between sources) are left out. Each is labelled "Not yet
 * verified" until the team confirms it with the business. None is a partner.
 */
async function researchedPlaces() {
  const tz = await prisma.country.findUnique({ where: { code: 'TZ' } });
  if (!tz) return;
  const dar = await geoCity('TZ', 'Dar es Salaam');
  const arusha = await geoCity('TZ', 'Arusha');
  const zanzibar = await geoCity('TZ', 'Zanzibar');
  const researchedAt = new Date('2026-11-26T12:00:00Z');
  const places: { name: string; category: string; city: typeof dar; area?: string; address?: string; summary: string; sourceUrl: string; website?: string; enquiryKind?: string; bookingMode?: string }[] = [
    { name: 'Hyatt Regency Dar es Salaam, The Kilimanjaro', category: 'Hotels', city: dar, area: 'Kivukoni', address: 'Kivukoni Street, Dar es Salaam', summary: 'International hotel on the Kivukoni waterfront in central Dar es Salaam.', sourceUrl: 'https://www.hyatt.com/en-US/hotel/tanzania/hyatt-regency-dar-es-salaam-the-kilimanjaro/darhr', website: 'https://www.hyatt.com/en-US/hotel/tanzania/hyatt-regency-dar-es-salaam-the-kilimanjaro/darhr', enquiryKind: 'ROOM' },
    { name: 'Dar es Salaam Serena Hotel', category: 'Hotels', city: dar, address: 'Ohio Street, Dar es Salaam', summary: 'City-centre hotel run by Serena Hotels.', sourceUrl: 'https://serenahotels.com/dar-es-salaam', website: 'https://serenahotels.com/dar-es-salaam', enquiryKind: 'ROOM' },
    { name: 'Hotel Slipway', category: 'Hotels', city: dar, area: 'Msasani Peninsula', address: 'Slipway Road, Msasani Peninsula', summary: 'Hotel inside The Slipway shopping and leisure complex on the Msasani Peninsula.', sourceUrl: 'https://www.expertafrica.com/tanzania/dar-es-salaam/the-slipway/in-detail', enquiryKind: 'ROOM' },
    { name: 'The Slipway', category: 'Shopping', city: dar, area: 'Msasani Peninsula', summary: 'Waterfront shopping and leisure complex on the Msasani Peninsula, about seven kilometres from the city centre.', sourceUrl: 'https://www.tribes.co.uk/accommodation/the-slipway/', bookingMode: 'NONE' },
    { name: 'National Museum and House of Culture', category: 'Cultural sites', city: dar, area: 'Kivukoni', address: 'Shaaban Robert Street, next to the Botanical Gardens', summary: 'Tanzania’s national museum, with exhibits on the country’s history and natural environment.', sourceUrl: 'https://en.wikipedia.org/wiki/National_Museum_of_Tanzania', bookingMode: 'NONE' },
    { name: 'Coco Beach (Oyster Bay)', category: 'Beaches', city: dar, area: 'Oyster Bay', address: 'Toure Drive, Oyster Bay', summary: 'Public beach on the Indian Ocean in Oyster Bay, popular in the evenings and at weekends.', sourceUrl: 'https://en.wikipedia.org/wiki/Oyster_Bay,_Tanzania', bookingMode: 'NONE' },
    { name: 'Mlimani City', category: 'Shopping', city: dar, address: 'Sam Nujoma Road, Dar es Salaam', summary: 'Shopping mall with shops, entertainment and event space — the meeting point for Enhakkore trips.', sourceUrl: 'https://mlimanicity.co.tz/about', website: 'https://mlimanicity.co.tz', bookingMode: 'NONE' },
    { name: 'Elewana Arusha Coffee Lodge', category: 'Lodges', city: arusha, summary: 'Lodge on a coffee estate on the edge of Arusha, around 20 minutes from town.', sourceUrl: 'https://www.minorhotels.com/en/destinations/tanzania/arusha/elewana-arusha-coffee-lodge', website: 'https://www.minorhotels.com/en/destinations/tanzania/arusha/elewana-arusha-coffee-lodge', enquiryKind: 'ROOM' },
    { name: 'Arusha Cultural Heritage Centre', category: 'Cultural sites', city: arusha, address: 'Dodoma Road, Arusha', summary: 'Museum, gallery and craft complex presenting the cultures of Tanzania’s many communities. A stop on the Arusha Escape.', sourceUrl: 'https://en.wikipedia.org/wiki/Arusha_Cultural_Heritage_Centre', bookingMode: 'NONE' },
    { name: 'The Rock Restaurant', category: 'Restaurants', city: zanzibar, area: 'Michamvi Pingwe, east coast', summary: 'Seafood restaurant on a rock off the beach — reachable on foot at low tide and by boat at high tide. Reservations are recommended.', sourceUrl: 'https://www.lonelyplanet.com/pois/1501104', enquiryKind: 'TABLE' },
    { name: 'Forodhani Gardens', category: 'Attractions', city: zanzibar, area: 'Stone Town seafront', summary: 'Seafront park in Stone Town, known for its evening food market.', sourceUrl: 'https://en.wikipedia.org/wiki/Forodhani_Gardens', bookingMode: 'NONE' },
  ];
  for (const item of places) {
    const slug = slugify(item.name);
    if (await prisma.place.findUnique({ where: { slug } })) continue;
    const cat = await prisma.category.findFirst({ where: { kind: 'PLACE', name: item.category } });
    await prisma.place.create({
      data: {
        slug,
        name: item.name,
        summary: item.summary,
        description: `${item.summary}\n\nThese details come from public sources and have not yet been confirmed with the business. Enhakkore has no agreement with this business.`,
        categoryId: cat?.id ?? null,
        countryId: tz.id,
        cityId: item.city?.id ?? null,
        area: item.area ?? null,
        address: item.address ?? null,
        website: item.website ?? null,
        bookingMode: item.bookingMode ?? 'ENQUIRY',
        enquiryKind: item.enquiryKind ?? 'PLACE',
        infoSource: 'UNVERIFIED',
        sourceUrl: item.sourceUrl,
        researchedAt,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });
  }
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
  await once('arusha-published.v3', publishArusha);
  await once('demo-content.v3', demoContent);
  await once('researched-places.v3', researchedPlaces);
  await once('wsc-wording.v5', wscWording);
  // Not run once: a fresh deploy with the variables set is how the owner is created.
  await owner();
}

main()
  .catch((error) => {
    console.error('[bootstrap] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
