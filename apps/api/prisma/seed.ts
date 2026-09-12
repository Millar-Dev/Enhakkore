/* eslint-disable no-console */
/**
 * Demonstration data for the Enhakkore platform.
 *
 * Everything created here is fictional and flagged `isDemo: true` so the
 * interface can label it as demonstration content rather than present it as
 * real achievement. Organizers, impact projects, contribution totals, reviews
 * and payments are all invented for development and design review.
 *
 * Run with: npm run db:seed  (or npm run db:reset to wipe first)
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { IMAGES } from './images';

const prisma = new PrismaClient();

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const DAY = 24 * 60 * 60 * 1000;
const today = new Date();
today.setHours(9, 0, 0, 0);

/** Dates are relative to the seed run so the demo always has live departures. */
function daysFromNow(days: number, hour = 6): Date {
  const date = new Date(today.getTime() + days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date;
}

const json = (value: unknown) => JSON.stringify(value);

/** TZS has no minor unit in practice, but amounts are stored in minor units. */
const tzs = (majorUnits: number) => majorUnits;

async function wipe() {
  // Order matters: children before parents.
  await prisma.message.deleteMany();
  await prisma.conversationMember.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.review.deleteMany();
  await prisma.platformCommission.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.bookingTraveller.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.impactUpdate.deleteMany();
  await prisma.savedTrip.deleteMany();
  await prisma.itineraryDay.deleteMany();
  await prisma.tripDate.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.impactProject.deleteMany();
  await prisma.destination.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.organizerVerification.deleteMany();
  await prisma.organizer.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.customTripRequest.deleteMany();
  await prisma.user.deleteMany();
  await prisma.platformSetting.deleteMany();
}

/* -------------------------------------------------------------------------- */

async function main() {
  console.log('› clearing existing data');
  await wipe();

  const password = await bcrypt.hash('Enhakkore2026!', 10);

  /* ---------------------------- Platform settings -------------------------- */

  await prisma.platformSetting.createMany({
    data: [
      { key: 'demo_mode', value: 'true' },
      { key: 'default_commission_rate', value: '0.10' },
      { key: 'default_currency', value: 'TZS' },
      { key: 'support_email', value: 'support@enhakkore.com' },
    ],
  });

  /* --------------------------------- Admin --------------------------------- */

  console.log('› creating admin');
  const admin = await prisma.user.create({
    data: {
      name: 'Amani Mushi',
      email: 'admin@enhakkore.com',
      passwordHash: password,
      role: 'ADMIN',
      country: 'Tanzania',
      city: 'Dar es Salaam',
      isDemo: true,
    },
  });

  /* ------------------------------ Destinations ----------------------------- */

  console.log('› creating destinations');
  const destinationSeed = [
    {
      name: 'Mikumi National Park',
      slug: 'mikumi',
      country: 'Tanzania',
      region: 'Morogoro',
      summary:
        'Open floodplains a half-day drive from Dar es Salaam — the most reachable place in Tanzania to see elephant, buffalo and lion on the same afternoon.',
      heroImage: IMAGES.safari.vehicleSunset,
      latitude: -7.3833,
      longitude: 37.0,
      featured: true,
    },
    {
      name: 'Zanzibar',
      slug: 'zanzibar',
      country: 'Tanzania',
      region: 'Zanzibar Archipelago',
      summary:
        'Stone Town’s carved doors and coral alleys give way to sandbars, spice farms and water the colour of glass.',
      heroImage: IMAGES.coast.palmParasols,
      latitude: -6.1659,
      longitude: 39.2026,
      featured: true,
    },
    {
      name: 'Serengeti National Park',
      slug: 'serengeti',
      country: 'Tanzania',
      region: 'Mara & Simiyu',
      summary:
        'Grass to the horizon in every direction, and the largest overland animal migration on earth moving through it.',
      heroImage: IMAGES.safari.acaciaPlain,
      latitude: -2.3333,
      longitude: 34.8333,
      featured: true,
    },
    {
      name: 'Ngorongoro Crater',
      slug: 'ngorongoro',
      country: 'Tanzania',
      region: 'Arusha',
      summary:
        'A collapsed volcanic caldera holding its own contained ecosystem — and one of the densest concentrations of wildlife anywhere.',
      heroImage: IMAGES.landscape.greenHighlands,
      latitude: -3.2,
      longitude: 35.5,
      featured: true,
    },
    {
      name: 'Mount Kilimanjaro',
      slug: 'kilimanjaro',
      country: 'Tanzania',
      region: 'Kilimanjaro',
      summary:
        'Africa’s highest point, walked from farmland through rainforest and alpine desert to glacier in under a week.',
      heroImage: IMAGES.landscape.snowPeakPlain,
      latitude: -3.0674,
      longitude: 37.3556,
      featured: true,
    },
    {
      name: 'Ruaha National Park',
      slug: 'ruaha',
      country: 'Tanzania',
      region: 'Iringa',
      summary:
        'Tanzania’s largest park and its quietest great one — baobab country, big predator country, almost no other vehicles.',
      heroImage: IMAGES.safari.elephantGrass,
      latitude: -7.6,
      longitude: 34.8,
    },
    {
      name: 'Pemba Island',
      slug: 'pemba',
      country: 'Tanzania',
      region: 'Zanzibar Archipelago',
      summary:
        'Green, hilly and largely undeveloped, with drop-offs and reef walls that divers travel a long way for.',
      heroImage: IMAGES.coast.islandTurquoise,
      latitude: -5.2,
      longitude: 39.7833,
    },
    {
      name: 'Diani Beach',
      slug: 'diani',
      country: 'Kenya',
      region: 'Kwale',
      summary: 'A long, bright stretch of the Kenyan south coast, with reef, forest and kitesurf wind.',
      heroImage: IMAGES.coast.coastlineAerial,
      latitude: -4.2967,
      longitude: 39.5906,
    },
    {
      name: 'Volcanoes National Park',
      slug: 'volcanoes-rwanda',
      country: 'Rwanda',
      region: 'Northern Province',
      summary: 'Bamboo forest on the Virunga slopes, and one of the few places to walk with mountain gorillas.',
      heroImage: IMAGES.landscape.ridgeTrail,
      latitude: -1.4833,
      longitude: 29.5,
    },
    {
      name: 'Dubai',
      slug: 'dubai',
      country: 'United Arab Emirates',
      region: 'Dubai',
      continent: 'Asia',
      summary: 'The first stop beyond Africa — a short flight, a long list of things you have not done before.',
      heroImage: IMAGES.international.cityAerial,
      latitude: 25.2048,
      longitude: 55.2708,
    },
  ];

  const destinations: Record<string, string> = {};
  for (const entry of destinationSeed) {
    const created = await prisma.destination.create({ data: entry });
    destinations[created.slug] = created.id;
  }

  /* ----------------------------- Impact projects ---------------------------- */

  console.log('› creating impact projects');

  const projectSeed = [
    {
      title: 'Classroom Block — Morogoro',
      slug: 'classroom-block-morogoro',
      category: 'EDUCATION',
      status: 'ACTIVE',
      summary:
        'Two new classrooms and desks for a primary school currently teaching 96 children in a single room.',
      description:
        'Mlimani Primary sits on the edge of the Uluguru foothills. It has one usable classroom and 96 children across three year groups, which means two of those groups learn outside whenever the weather allows and lose the day when it does not.\n\nThis project funds a two-classroom block, 60 desks, and a covered walkway between the block and the existing building. The school committee has the land, the district education office has approved the plan, and local builders will do the work.\n\nContributions are held against the project and released in three stages: foundation, structure, and fit-out. Every stage is reported here with photographs and dates.',
      location: 'Morogoro',
      country: 'Tanzania',
      latitude: -6.8235,
      longitude: 37.6612,
      goal: tzs(15_000_000),
      raised: tzs(10_800_000),
      contributorCount: 214,
      beneficiaries: 96,
      heroImage: IMAGES.impact.books,
      gallery: json([IMAGES.impact.openBook, IMAGES.impact.community]),
      allocation: json([
        { label: 'Building materials', percent: 55, note: 'Cement, timber, roofing sheets, hardware' },
        { label: 'Local labour', percent: 25, note: 'Builders and finishing contracted in Morogoro' },
        { label: 'Desks and furniture', percent: 15, note: '60 two-seat desks, built locally' },
        { label: 'Monitoring and reporting', percent: 5, note: 'Site visits, photography, published updates' },
      ]),
      partnerName: null,
      partnerNote:
        'Implementing partner details will be published here once the partnership agreement is finalised and documented.',
      featured: true,
      startedAt: daysFromNow(-120),
      isDemo: true,
    },
    {
      title: 'Mobile Health Clinic — Iringa Rural',
      slug: 'mobile-health-clinic-iringa',
      category: 'HEALTHCARE',
      status: 'ACTIVE',
      summary:
        'A fitted vehicle running a monthly circuit of seven villages that are three hours from the nearest clinic.',
      description:
        'Seven villages in rural Iringa share one dispensary, and for most of them reaching it means a three-hour journey that people put off until they cannot.\n\nThis project funds the fit-out and first year of running costs for a mobile clinic: a vehicle equipped for antenatal checks, childhood immunisation, malaria testing and basic dispensing, staffed by a clinical officer and a nurse on a fixed monthly circuit.\n\nThe route, dates and attendance numbers for each visit are published as updates so supporters can see the clinic actually running.',
      location: 'Iringa Rural',
      country: 'Tanzania',
      latitude: -7.7667,
      longitude: 35.7,
      goal: tzs(22_000_000),
      raised: tzs(8_140_000),
      contributorCount: 138,
      beneficiaries: 2400,
      heroImage: IMAGES.impact.healthcare,
      gallery: json([IMAGES.impact.hands]),
      allocation: json([
        { label: 'Vehicle fit-out', percent: 40, note: 'Shelving, cold chain, examination area' },
        { label: 'Medical supplies', percent: 30, note: 'Test kits, vaccines, dispensary stock' },
        { label: 'Clinical staffing', percent: 22, note: 'Clinical officer and nurse, first 12 months' },
        { label: 'Fuel and maintenance', percent: 8 },
      ]),
      featured: true,
      startedAt: daysFromNow(-60),
      isDemo: true,
    },
    {
      title: 'Village Borehole — Chalinze',
      slug: 'village-borehole-chalinze',
      category: 'CLEAN_WATER',
      status: 'ACTIVE',
      summary:
        'A drilled borehole, solar pump and two collection points, replacing a 4km walk to an open water source.',
      description:
        'Households in this ward currently collect water from an open source roughly four kilometres away. The walk falls mostly to women and school-age girls, and the water is not safe without boiling.\n\nThe project funds a drilled borehole, a solar-powered pump, a storage tank and two collection points within the village. A local water committee is being trained to handle maintenance and to collect a small usage fee that covers spare parts — the part of these projects that usually decides whether they still work in five years.',
      location: 'Chalinze, Pwani',
      country: 'Tanzania',
      latitude: -6.6333,
      longitude: 38.35,
      goal: tzs(12_000_000),
      raised: tzs(11_600_000),
      contributorCount: 301,
      beneficiaries: 1800,
      heroImage: IMAGES.impact.water,
      gallery: json([IMAGES.impact.hands, IMAGES.impact.community]),
      allocation: json([
        { label: 'Drilling and casing', percent: 45 },
        { label: 'Solar pump and tank', percent: 30 },
        { label: 'Collection points and piping', percent: 15 },
        { label: 'Committee training and spares fund', percent: 10 },
      ]),
      featured: true,
      startedAt: daysFromNow(-200),
      isDemo: true,
    },
    {
      title: 'Women’s Craft Cooperative — Bagamoyo',
      slug: 'womens-craft-cooperative-bagamoyo',
      category: 'COMMUNITY',
      status: 'ACTIVE',
      summary:
        'Equipment, working capital and a market stall for a 24-member weaving and textile cooperative.',
      description:
        'Twenty-four women in Bagamoyo have been weaving and dyeing together for six years, selling mostly to passing visitors at prices set by whoever walks past.\n\nThis project funds four treadle looms, a dye station, initial materials, and a permanent stall at the town market, plus a short bookkeeping and pricing course. The aim is a cooperative that sets its own prices and sells year-round rather than only in season.',
      location: 'Bagamoyo, Pwani',
      country: 'Tanzania',
      latitude: -6.4425,
      longitude: 38.9,
      goal: tzs(9_000_000),
      raised: tzs(3_250_000),
      contributorCount: 67,
      beneficiaries: 24,
      heroImage: IMAGES.impact.community,
      gallery: json([IMAGES.people.gathering]),
      allocation: json([
        { label: 'Looms and dye equipment', percent: 45 },
        { label: 'Materials and working capital', percent: 30 },
        { label: 'Market stall', percent: 15 },
        { label: 'Bookkeeping training', percent: 10 },
      ]),
      startedAt: daysFromNow(-45),
      isDemo: true,
    },
    {
      title: 'Reef Restoration — Pemba Channel',
      slug: 'reef-restoration-pemba',
      category: 'CONSERVATION',
      status: 'ACTIVE',
      summary:
        'Coral nursery lines and a local monitoring team on a reef section damaged by bleaching and anchor strike.',
      description:
        'A section of reef on the Pemba side of the channel has lost significant live coral cover to bleaching events and anchor damage from small boats.\n\nThis project funds coral nursery lines, mooring buoys so boats stop anchoring on the reef, and a paid monitoring team drawn from the fishing community that already works this water. Survey data is published twice a year, including the results that are disappointing.',
      location: 'Pemba Channel',
      country: 'Tanzania',
      latitude: -5.3,
      longitude: 39.7,
      goal: tzs(18_000_000),
      raised: tzs(6_900_000),
      contributorCount: 92,
      beneficiaries: 400,
      heroImage: IMAGES.coast.diver,
      gallery: json([IMAGES.coast.ocean, IMAGES.coast.coastlineAerial]),
      allocation: json([
        { label: 'Nursery structures and fragments', percent: 40 },
        { label: 'Mooring buoys', percent: 25 },
        { label: 'Local monitoring team', percent: 25 },
        { label: 'Survey equipment and reporting', percent: 10 },
      ]),
      startedAt: daysFromNow(-90),
      isDemo: true,
    },
    {
      title: 'School Library — Kigoma',
      slug: 'school-library-kigoma',
      category: 'EDUCATION',
      status: 'COMPLETED',
      summary: 'A completed library room, 900 books and shelving for a secondary school of 480 students.',
      description:
        'This project is finished. A disused storeroom at the school was re-roofed, floored, wired and fitted out as a library: shelving, eight reading tables, and 900 books in Swahili and English chosen with the school’s teachers.\n\nIt is kept published because completed work should stay visible, including the final accounting.',
      location: 'Kigoma',
      country: 'Tanzania',
      latitude: -4.8769,
      longitude: 29.6267,
      goal: tzs(7_500_000),
      raised: tzs(7_500_000),
      contributorCount: 156,
      beneficiaries: 480,
      heroImage: IMAGES.impact.openBook,
      gallery: json([IMAGES.impact.books]),
      allocation: json([
        { label: 'Room renovation', percent: 45 },
        { label: 'Books', percent: 30 },
        { label: 'Shelving and tables', percent: 20 },
        { label: 'Reporting', percent: 5 },
      ]),
      startedAt: daysFromNow(-400),
      completedAt: daysFromNow(-70),
      isDemo: true,
    },
  ];

  const projects: Record<string, string> = {};
  for (const entry of projectSeed) {
    const created = await prisma.impactProject.create({ data: entry as never });
    projects[created.slug] = created.id;
  }

  console.log('› creating project updates');
  const updateSeed: {
    slug: string;
    title: string;
    body: string;
    daysAgo: number;
    milestone?: boolean;
    images?: string[];
  }[] = [
    {
      slug: 'classroom-block-morogoro',
      title: 'School supplies delivered',
      body: 'The first delivery reached the school on Wednesday: 60 desk frames, exercise books and chalk for the term. The desks are being assembled on site by two carpenters from the village. Receipts for this delivery are filed with the district education office.',
      daysAgo: 22,
      images: [IMAGES.impact.books],
    },
    {
      slug: 'classroom-block-morogoro',
      title: 'Construction started',
      body: 'Foundations were dug and poured over four days. The builders are working to the district-approved plan and expect the walls to reach roof height within six weeks, weather permitting.',
      daysAgo: 32,
      milestone: true,
      images: [IMAGES.impact.community],
    },
    {
      slug: 'classroom-block-morogoro',
      title: 'Site confirmed and plan approved',
      body: 'The school committee has formally allocated the plot behind the existing building and the district education office has signed off the building plan. Work can begin as soon as the first funding stage is released.',
      daysAgo: 68,
      milestone: true,
    },
    {
      slug: 'mobile-health-clinic-iringa',
      title: 'Route and schedule agreed',
      body: 'Seven villages are confirmed on the monthly circuit, with fixed dates so families can plan around the visit. The schedule was set with the village health workers rather than for them, which changed two of the stops.',
      daysAgo: 14,
    },
    {
      slug: 'mobile-health-clinic-iringa',
      title: 'Vehicle sourced',
      body: 'A suitable vehicle has been identified and inspected. Fit-out quotes are in from two workshops in Iringa town and the committee is comparing them before committing.',
      daysAgo: 40,
      milestone: true,
    },
    {
      slug: 'village-borehole-chalinze',
      title: 'Water table reached at 62 metres',
      body: 'Drilling finished on Tuesday and hit water at 62 metres, shallower than the survey predicted. Yield testing runs for the rest of the week before the pump is ordered.',
      daysAgo: 9,
      milestone: true,
      images: [IMAGES.impact.water],
    },
    {
      slug: 'village-borehole-chalinze',
      title: 'Water committee formed',
      body: 'Eleven members were elected, seven of them women, and the first maintenance training session is scheduled. The committee has agreed a monthly household contribution toward the spares fund.',
      daysAgo: 35,
    },
    {
      slug: 'womens-craft-cooperative-bagamoyo',
      title: 'First two looms installed',
      body: 'Two of the four treadle looms are built and in use. The other two are on order from the same workshop in Dar es Salaam.',
      daysAgo: 18,
      images: [IMAGES.people.gathering],
    },
    {
      slug: 'reef-restoration-pemba',
      title: 'Six nursery lines seeded',
      body: 'Six nursery lines are seeded with 340 fragments. Two-month survival is being recorded and will be published in the next survey, whichever way it goes.',
      daysAgo: 26,
      images: [IMAGES.coast.diver],
    },
    {
      slug: 'school-library-kigoma',
      title: 'Library opened',
      body: 'The library opened at the start of term. Final accounting: TZS 7,500,000 raised, TZS 7,480,000 spent, and the TZS 20,000 remainder carried to the school’s book fund with the committee’s agreement.',
      daysAgo: 70,
      milestone: true,
      images: [IMAGES.impact.openBook],
    },
  ];

  for (const entry of updateSeed) {
    await prisma.impactUpdate.create({
      data: {
        projectId: projects[entry.slug],
        title: entry.title,
        body: entry.body,
        images: json(entry.images ?? []),
        milestone: entry.milestone ?? false,
        publishedAt: daysFromNow(-entry.daysAgo, 12),
      },
    });
  }

  /* -------------------------------- Organizers ------------------------------ */

  console.log('› creating organizers');

  const organizerSeed = [
    {
      email: 'hello@serengeticollective.demo',
      contact: 'Neema Laizer',
      companyName: 'Serengeti Collective',
      slug: 'serengeti-collective',
      tagline: 'Northern circuit safaris, run by guides who grew up on it.',
      bio: 'We are eleven guides and four drivers based in Arusha. Between us we have worked the northern circuit for over eighty years, and we started the Collective in 2016 so we could run our own trips rather than someone else’s. Small groups, no more than seven per vehicle, and we do not stack four camps into three days.',
      city: 'Arusha',
      yearFounded: 2016,
      rating: 4.8,
      reviewCount: 0,
      responseTimeHours: 3,
      verificationStatus: 'VERIFIED',
      languages: ['English', 'Swahili', 'German'],
    },
    {
      email: 'trips@tanzuexpeditions.demo',
      contact: 'Baraka Mwenda',
      companyName: 'Tanzu Expeditions',
      slug: 'tanzu-expeditions',
      tagline: 'Weekend escapes and long-weekend safaris from Dar.',
      bio: 'Tanzu runs short trips for people who work full weeks — Friday night departures, back by Sunday evening, no annual leave required. We started with one bus to Mikumi in 2019 and now run four routes.',
      city: 'Dar es Salaam',
      yearFounded: 2019,
      rating: 4.7,
      responseTimeHours: 2,
      verificationStatus: 'VERIFIED',
      languages: ['English', 'Swahili'],
    },
    {
      email: 'karibu@kaskazicoast.demo',
      contact: 'Zuhura Salum',
      companyName: 'Kaskazi Coast Travel',
      slug: 'kaskazi-coast-travel',
      tagline: 'The islands, without the resort bubble.',
      bio: 'Based in Stone Town. We build island trips around the people who actually live here — the dhow captains, the spice farmers, the cooks — and we pay them directly rather than through a chain of agents.',
      city: 'Zanzibar City',
      yearFounded: 2014,
      rating: 4.9,
      responseTimeHours: 4,
      verificationStatus: 'VERIFIED',
      languages: ['English', 'Swahili', 'Italian'],
    },
    {
      email: 'info@highlandcrater.demo',
      contact: 'Emmanuel Kileo',
      companyName: 'Highland & Crater Journeys',
      slug: 'highland-crater-journeys',
      tagline: 'Crater rim, highlands, and the walking routes in between.',
      bio: 'A Karatu outfit specialising in Ngorongoro and the Crater Highlands, including walking routes most operators skip. Our lead guides are Maasai and Iraqw and the cultural days on our itineraries are theirs to run, not a scheduled photo stop.',
      city: 'Karatu',
      yearFounded: 2011,
      rating: 4.9,
      responseTimeHours: 6,
      verificationStatus: 'VERIFIED',
      languages: ['English', 'Swahili', 'Maa'],
    },
    {
      email: 'team@baharinomad.demo',
      contact: 'Halima Juma',
      companyName: 'Bahari Nomad Tours',
      slug: 'bahari-nomad-tours',
      tagline: 'Diving and coastal trips along the Tanga coast.',
      bio: 'A new operator working the northern coast and Pemba channel. Verification is in progress.',
      city: 'Tanga',
      yearFounded: 2024,
      responseTimeHours: 12,
      // Deliberately left pending so the admin review queue has something real in it.
      verificationStatus: 'PENDING',
      languages: ['English', 'Swahili'],
    },
  ];

  const organizers: Record<string, { id: string; userId: string }> = {};

  for (const entry of organizerSeed) {
    const user = await prisma.user.create({
      data: {
        name: entry.contact,
        email: entry.email,
        passwordHash: password,
        role: 'ORGANIZER',
        country: 'Tanzania',
        city: entry.city,
        isDemo: true,
        organizer: {
          create: {
            companyName: entry.companyName,
            slug: entry.slug,
            tagline: entry.tagline,
            bio: entry.bio,
            country: 'Tanzania',
            city: entry.city,
            yearFounded: entry.yearFounded,
            languages: json(entry.languages),
            verificationStatus: entry.verificationStatus,
            rating: entry.rating ?? null,
            responseTimeHours: entry.responseTimeHours,
            commissionRate: 0.1,
            isDemo: true,
          },
        },
      },
      include: { organizer: true },
    });

    organizers[entry.slug] = { id: user.organizer!.id, userId: user.id };

    await prisma.organizerVerification.create({
      data: {
        organizerId: user.organizer!.id,
        legalName: `${entry.companyName} Limited`,
        registrationNumber: `DEMO-${entry.slug.slice(0, 4).toUpperCase()}-0000`,
        licenseNumber: 'DEMO-TALA-0000',
        contactName: entry.contact,
        contactEmail: entry.email,
        contactPhone: '+255 700 000 000',
        addressLine: `${entry.city}, Tanzania`,
        documents: json([
          { label: 'Certificate of incorporation', fileName: 'demo-placeholder.pdf', uploadedAt: new Date().toISOString() },
          { label: 'TALA tour operator licence', fileName: 'demo-placeholder.pdf', uploadedAt: new Date().toISOString() },
        ]),
        payoutMethod: 'MOBILE_MONEY',
        payoutReference: 'demo-reference',
        status: entry.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
        submittedAt: daysFromNow(-90),
        reviewedAt: entry.verificationStatus === 'VERIFIED' ? daysFromNow(-88) : null,
        reviewedById: entry.verificationStatus === 'VERIFIED' ? admin.id : null,
        reviewNotes:
          entry.verificationStatus === 'VERIFIED'
            ? 'Demonstration record. Documents are placeholders — no real verification was performed.'
            : null,
      },
    });
  }

  /* --------------------------------- Travellers ----------------------------- */

  console.log('› creating travellers');

  const travellerSeed = [
    { name: 'Michael Temba', email: 'michael@traveller.demo', city: 'Dar es Salaam', country: 'Tanzania' },
    { name: 'Sarah Kimaro', email: 'sarah@traveller.demo', city: 'Arusha', country: 'Tanzania' },
    { name: 'Daniel Otieno', email: 'daniel@traveller.demo', city: 'Nairobi', country: 'Kenya' },
    { name: 'Grace Mollel', email: 'grace@traveller.demo', city: 'Moshi', country: 'Tanzania' },
    { name: 'Lena Fischer', email: 'lena@traveller.demo', city: 'Hamburg', country: 'Germany' },
    { name: 'Joseph Mwakalinga', email: 'joseph@traveller.demo', city: 'Mbeya', country: 'Tanzania' },
    { name: 'Aisha Rashid', email: 'aisha@traveller.demo', city: 'Zanzibar City', country: 'Tanzania' },
    { name: 'Tom Whitfield', email: 'tom@traveller.demo', city: 'Bristol', country: 'United Kingdom' },
    { name: 'Neema Shirima', email: 'neema@traveller.demo', city: 'Dodoma', country: 'Tanzania' },
    { name: 'Paul Nkya', email: 'paul@traveller.demo', city: 'Dar es Salaam', country: 'Tanzania' },
    { name: 'Chiara Rossi', email: 'chiara@traveller.demo', city: 'Milan', country: 'Italy' },
    { name: 'Rehema Bakari', email: 'rehema@traveller.demo', city: 'Tanga', country: 'Tanzania' },
  ];

  const travellers: { id: string; name: string; email: string }[] = [];
  for (const entry of travellerSeed) {
    const user = await prisma.user.create({
      data: {
        name: entry.name,
        email: entry.email,
        passwordHash: password,
        role: 'TRAVELER',
        city: entry.city,
        country: entry.country,
        bio: null,
        isDemo: true,
      },
    });
    travellers.push({ id: user.id, name: user.name, email: user.email });
  }

  /* ----------------------------------- Trips -------------------------------- */

  console.log('› creating trips');

  interface TripSeed {
    organizer: string;
    destination: string;
    title: string;
    slug: string;
    summary: string;
    description: string;
    type: string;
    style: string;
    status?: string;
    days: number;
    nights: number;
    price: number;
    heroImage: string;
    gallery: string[];
    tags: string[];
    includes: string[];
    excludes: string[];
    requirements: string[];
    difficulty?: string;
    minAge?: number;
    rating?: number;
    featured?: boolean;
    impactProject?: string;
    itinerary: {
      title: string;
      summary: string;
      activities: string[];
      meals: string[];
      accommodation?: string;
    }[];
    departures: { startIn: number; capacity: number; booked?: number; price?: number }[];
  }

  const STANDARD_REQUIREMENTS = [
    'Valid national ID or passport',
    'Comfortable closed shoes and a warm layer for early mornings',
    'Any personal medication, clearly labelled',
  ];

  const tripSeed: TripSeed[] = [
    {
      organizer: 'tanzu-expeditions',
      destination: 'mikumi',
      title: 'Mikumi Adventure',
      slug: 'mikumi-adventure',
      summary:
        'A three-day introduction to the Tanzanian bush, close enough to Dar es Salaam to leave on Friday and be back for Monday.',
      description:
        'Mikumi is the park most people from Dar go to first, and for good reason — the Mkata floodplain is open enough that you actually see things, and the drive is short enough that the trip is about the park rather than the road.\n\nThis is a group departure, capped at twenty, split across four vehicles so everyone has a window seat. Two full game drives, one at dawn when the cats are still moving and one in the late afternoon, plus a night at a lodge on the park boundary with a decent pool and a bar that stays open.\n\nIt suits first-time safari-goers, people travelling solo who would rather not do it alone, and anyone who has been meaning to do this for three years and has not got round to it.',
      type: 'SAFARI',
      style: 'COMFORT',
      days: 3,
      nights: 2,
      price: tzs(450_000),
      heroImage: IMAGES.safari.vehicleSunset,
      gallery: [IMAGES.safari.elephantGrass, IMAGES.safari.giraffeAcacia, IMAGES.landscape.sunRays],
      tags: ['First safari', 'Weekend', 'Small group'],
      includes: [
        'Return transport from Dar es Salaam',
        'Two nights lodge accommodation, shared twin',
        'All meals from Friday dinner to Sunday lunch',
        'Park entry and conservation fees',
        'English and Swahili speaking guide',
        'Drinking water throughout',
      ],
      excludes: ['Alcoholic drinks', 'Personal items and souvenirs', 'Tips for guides and drivers', 'Travel insurance'],
      requirements: STANDARD_REQUIREMENTS,
      difficulty: 'Easy',
      minAge: 8,
      rating: 4.8,
      featured: true,
      impactProject: 'classroom-block-morogoro',
      itinerary: [
        {
          title: 'Dar es Salaam → Mikumi',
          summary: 'Early departure, lunch on the road, and into the park with enough light for a first drive.',
          activities: [
            '06:00 — Depart Dar es Salaam from the Mlimani City pickup point',
            '11:30 — Lunch stop in Morogoro town',
            '14:00 — Park entry and afternoon game drive across the Mkata floodplain',
            '18:30 — Check in at the lodge, dinner and a briefing for the morning',
          ],
          meals: ['Lunch', 'Dinner'],
          accommodation: 'Lodge on the park boundary — twin share, en-suite',
        },
        {
          title: 'Full day in the park',
          summary: 'The dawn drive is the one people remember. The afternoon is yours until the sun drops.',
          activities: [
            '05:45 — Coffee and depart for the dawn game drive',
            '09:30 — Breakfast back at the lodge',
            'Midday — Free time, pool, or an optional guided walk near the lodge',
            '16:00 — Afternoon game drive toward the hippo pools',
            '19:30 — Dinner and a talk from the guide on what we saw',
          ],
          meals: ['Breakfast', 'Lunch', 'Dinner'],
          accommodation: 'Lodge on the park boundary — twin share, en-suite',
        },
        {
          title: 'Final drive and return',
          summary: 'One more loop on the way out, then the road home.',
          activities: [
            '06:30 — Breakfast and check out',
            '07:30 — Game drive on the way to the gate',
            '11:00 — Depart for Dar es Salaam',
            '17:00 — Arrive back at the Mlimani City drop-off point',
          ],
          meals: ['Breakfast', 'Lunch'],
        },
      ],
      departures: [
        { startIn: 1, capacity: 20, booked: 14 },
        { startIn: 23, capacity: 20, booked: 7 },
        { startIn: 51, capacity: 20, booked: 3 },
      ],
    },
    {
      organizer: 'kaskazi-coast-travel',
      destination: 'zanzibar',
      title: 'Zanzibar Escape',
      slug: 'zanzibar-escape',
      summary:
        'Five days between Stone Town and the east coast — spice farms, a dhow at sunset, and three days of doing very little.',
      description:
        'Two nights in Stone Town and three on the east coast, which is the split most people wish they had chosen after doing it the other way around.\n\nStone Town is walked, not driven: the market at the hour it is actually busy, the carved doors, the fort, and dinner at Forodhani once the grills are lit. Then east to Paje, where the day is yours — the tide goes out a long way and comes back, and that is roughly the schedule.\n\nOne dhow sunset sail and one spice farm visit are included, both run by people who live on the island. Everything else is optional.',
      type: 'BEACH',
      style: 'COMFORT',
      days: 5,
      nights: 4,
      price: tzs(890_000),
      heroImage: IMAGES.coast.palmParasols,
      gallery: [IMAGES.coast.beachSunset, IMAGES.coast.islandTurquoise, IMAGES.coast.mooredBoats],
      tags: ['Island', 'Culture', 'Slow travel'],
      includes: [
        'Four nights accommodation — two Stone Town, two east coast',
        'Daily breakfast and two dinners',
        'Airport and ferry transfers',
        'Guided Stone Town walking tour',
        'Spice farm visit with lunch',
        'Sunset dhow sail',
      ],
      excludes: ['Flights or ferry tickets to Zanzibar', 'Lunches on free days', 'Water sports and diving', 'Tips'],
      requirements: ['Passport or national ID', 'Modest dress for Stone Town and the spice farm', 'Reef-safe sunscreen'],
      difficulty: 'Easy',
      rating: 4.9,
      featured: true,
      impactProject: 'reef-restoration-pemba',
      itinerary: [
        {
          title: 'Arrive Stone Town',
          summary: 'Settle in, then walk the old town as the heat goes out of the day.',
          activities: [
            'Airport or ferry pickup and transfer',
            'Late afternoon orientation walk',
            'Dinner at the Forodhani night market',
          ],
          meals: ['Dinner'],
          accommodation: 'Stone Town guesthouse — en-suite, courtyard',
        },
        {
          title: 'Stone Town and spice farm',
          summary: 'The morning is history, the afternoon is agriculture, and both are more interesting than they sound.',
          activities: [
            'Guided walk — the fort, the market, the House of Wonders exterior, the former slave market memorial',
            'Lunch at a spice farm in the interior',
            'Free evening',
          ],
          meals: ['Breakfast', 'Lunch'],
          accommodation: 'Stone Town guesthouse — en-suite, courtyard',
        },
        {
          title: 'East coast',
          summary: 'Cross the island and stop.',
          activities: ['Transfer to Paje on the east coast', 'Check in and free afternoon', 'Sunset dhow sail'],
          meals: ['Breakfast', 'Dinner'],
          accommodation: 'Beachfront hotel, Paje',
        },
        {
          title: 'Free day',
          summary: 'Kitesurf, snorkel, read, sleep. Optional trips can be arranged the night before.',
          activities: [
            'Optional: Mnemba atoll snorkelling',
            'Optional: kitesurf lesson',
            'Optional: Jozani forest half day',
          ],
          meals: ['Breakfast'],
          accommodation: 'Beachfront hotel, Paje',
        },
        {
          title: 'Departure',
          summary: 'A slow morning and a transfer timed to your flight.',
          activities: ['Breakfast and check out', 'Transfer to airport or ferry terminal'],
          meals: ['Breakfast'],
        },
      ],
      departures: [
        { startIn: 9, capacity: 16, booked: 11 },
        { startIn: 30, capacity: 16, booked: 5 },
        { startIn: 62, capacity: 16, booked: 2 },
      ],
    },
    {
      organizer: 'serengeti-collective',
      destination: 'serengeti',
      title: 'Serengeti Migration Circuit',
      slug: 'serengeti-migration-circuit',
      summary:
        'Seven days following the herds, with camps moved to wherever the migration actually is rather than where the brochure says.',
      description:
        'The migration is not a fixed event on a fixed date, and any operator who tells you otherwise is selling you a schedule rather than an experience. We move our mobile camp through the season and position this departure where the herds are likely to be, then adjust in the last fortnight based on what our guides and the camp network are actually seeing.\n\nSeven days, maximum seven guests per vehicle, mobile tented camp with proper beds and hot bucket showers. Long days out, which is the only way to do this properly.\n\nThis is not a first-safari trip. It is for people who have done a short one and want the real thing.',
      type: 'SAFARI',
      style: 'LUXURY',
      days: 7,
      nights: 6,
      price: tzs(4_850_000),
      heroImage: IMAGES.safari.acaciaPlain,
      gallery: [IMAGES.safari.elephantFamily, IMAGES.safari.loneAcacia, IMAGES.safari.rhinos, IMAGES.landscape.sunRays],
      tags: ['Migration', 'Mobile camp', 'Photography'],
      includes: [
        'Six nights mobile tented camp, full board',
        'All game drives in 4x4 with guaranteed window seat',
        'Park and concession fees',
        'Professional guide and camp staff',
        'Arusha airport transfers',
        'Drinking water, soft drinks and house wine',
      ],
      excludes: ['International and domestic flights', 'Balloon safari (bookable separately)', 'Premium spirits', 'Tips'],
      requirements: [
        'Passport valid six months beyond travel',
        'Yellow fever certificate if arriving from an endemic country',
        'Comfortable with long days in a vehicle on rough roads',
      ],
      difficulty: 'Moderate',
      minAge: 12,
      rating: 4.9,
      featured: true,
      itinerary: [
        {
          title: 'Arusha → Central Serengeti',
          summary: 'Fly in, drive out, and be in the park by the afternoon.',
          activities: ['Morning flight or drive from Arusha', 'Afternoon game drive en route to camp', 'Camp briefing and dinner'],
          meals: ['Lunch', 'Dinner'],
          accommodation: 'Mobile tented camp',
        },
        {
          title: 'Central Serengeti',
          summary: 'Two full days working the area around camp.',
          activities: ['Dawn and afternoon game drives', 'Picnic lunch in the field', 'Optional night sky session with the guide'],
          meals: ['Breakfast', 'Lunch', 'Dinner'],
          accommodation: 'Mobile tented camp',
        },
        {
          title: 'Following the herds',
          summary: 'A long driving day toward the current position of the migration.',
          activities: ['Early start', 'Full-day drive with game viewing throughout', 'Arrive second camp position by evening'],
          meals: ['Breakfast', 'Lunch', 'Dinner'],
          accommodation: 'Mobile tented camp',
        },
        {
          title: 'Migration country',
          summary: 'Two days in the thick of it, including river crossing points if the timing works.',
          activities: ['Dawn departure with packed breakfast', 'River crossing watch where seasonal', 'Late return to camp'],
          meals: ['Breakfast', 'Lunch', 'Dinner'],
          accommodation: 'Mobile tented camp',
        },
        {
          title: 'Predator focus',
          summary: 'A day built around the cats, with the guides working their network.',
          activities: ['Dawn drive', 'Midday rest at camp', 'Late afternoon drive into golden hour'],
          meals: ['Breakfast', 'Lunch', 'Dinner'],
          accommodation: 'Mobile tented camp',
        },
        {
          title: 'Ngorongoro rim',
          summary: 'Out of the Serengeti, up onto the crater rim.',
          activities: ['Morning drive out of the park', 'Olduvai Gorge stop', 'Arrive crater rim lodge'],
          meals: ['Breakfast', 'Lunch', 'Dinner'],
          accommodation: 'Crater rim lodge',
        },
        {
          title: 'Crater floor and departure',
          summary: 'Down into the caldera at first light, then back to Arusha.',
          activities: ['Dawn descent into the crater', 'Game drive on the crater floor', 'Lunch and transfer to Arusha'],
          meals: ['Breakfast', 'Lunch'],
        },
      ],
      departures: [
        { startIn: 26, capacity: 14, booked: 9 },
        { startIn: 54, capacity: 14, booked: 4 },
        { startIn: 89, capacity: 14, booked: 1 },
      ],
    },
    {
      organizer: 'highland-crater-journeys',
      destination: 'ngorongoro',
      title: 'Ngorongoro & Crater Highlands Walk',
      slug: 'ngorongoro-crater-highlands-walk',
      summary:
        'Four days combining the crater floor with two days walking the highlands above it, guided by Maasai from the area.',
      description:
        'Almost everyone does the crater as a day trip and leaves. The highlands above it — ridges, craters nobody photographs, Maasai grazing land — are where this trip spends most of its time.\n\nDay one is the crater floor, early, before the vehicles stack up. Days two and three are on foot across the highlands with a Maasai guide and a donkey carrying the camp, which is a slower and considerably better way to see this country. Day four comes down through Karatu.\n\nYou need to be comfortable walking fifteen to eighteen kilometres a day at altitude. You do not need to be an athlete.',
      type: 'ADVENTURE',
      style: 'COMFORT',
      days: 4,
      nights: 3,
      price: tzs(1_750_000),
      heroImage: IMAGES.landscape.greenHighlands,
      gallery: [IMAGES.landscape.ridgeTrail, IMAGES.landscape.mountainsAboveCloud, IMAGES.safari.giraffeAcacia],
      tags: ['Walking', 'Cultural', 'Altitude'],
      includes: [
        'Three nights — one lodge, two fly camps',
        'All meals',
        'Crater entry and vehicle',
        'Maasai walking guide and support team',
        'Camping equipment and porterage',
      ],
      excludes: ['Sleeping bag (hire available)', 'Drinks beyond water and tea', 'Tips'],
      requirements: [
        'Able to walk 15–18km per day between 1,800m and 2,900m',
        'Broken-in walking boots',
        'Warm layers — the highlands are cold at night',
      ],
      difficulty: 'Moderate to challenging',
      minAge: 16,
      rating: 4.9,
      impactProject: 'womens-craft-cooperative-bagamoyo',
      itinerary: [
        {
          title: 'Karatu → Crater floor',
          summary: 'Down into the caldera at opening, out before the crowd.',
          activities: ['05:30 departure from Karatu', 'Full morning game drive on the crater floor', 'Picnic lunch at the hippo pool', 'Ascend and overnight on the rim'],
          meals: ['Breakfast', 'Lunch', 'Dinner'],
          accommodation: 'Crater rim lodge',
        },
        {
          title: 'Into the highlands on foot',
          summary: 'Leave the vehicles behind.',
          activities: ['Meet the walking team and donkeys', '16km across open highland', 'Fly camp at around 2,600m'],
          meals: ['Breakfast', 'Lunch', 'Dinner'],
          accommodation: 'Fly camp — two-person tents',
        },
        {
          title: 'Ridge day',
          summary: 'The best walking of the trip, and the day you understand why it is worth the legs.',
          activities: ['18km along the ridge line', 'Lunch at a viewpoint over the rift', 'Evening with the guides at camp'],
          meals: ['Breakfast', 'Lunch', 'Dinner'],
          accommodation: 'Fly camp — two-person tents',
        },
        {
          title: 'Descent to Karatu',
          summary: 'Down through farmland and back to a hot shower.',
          activities: ['Morning descent, 12km', 'Lunch in Karatu', 'Transfer to Arusha or onward'],
          meals: ['Breakfast', 'Lunch'],
        },
      ],
      departures: [
        { startIn: 17, capacity: 10, booked: 8 },
        { startIn: 45, capacity: 10, booked: 3 },
      ],
    },
    {
      organizer: 'serengeti-collective',
      destination: 'kilimanjaro',
      title: 'Kilimanjaro — Machame Route',
      slug: 'kilimanjaro-machame-route',
      summary:
        'Seven days up the Machame route, the extra day built in because that is what gets people to the top.',
      description:
        'Machame in seven days rather than six. The extra acclimatisation day at Karanga is the single biggest factor in whether you summit, and cutting it to save one night is the most common reason people do not.\n\nFull crew: lead guide, assistant guides at a ratio of one to two climbers, cook, and porters carrying everything but your day pack. Daily health checks with pulse oximetry, and a guide team that will turn you around if your numbers say so.\n\nSummit night leaves Barafu around midnight and reaches Uhuru Peak at sunrise. It is cold, long and worth it.',
      type: 'ADVENTURE',
      style: 'COMFORT',
      days: 7,
      nights: 6,
      price: tzs(3_900_000),
      heroImage: IMAGES.landscape.snowPeakPlain,
      gallery: [IMAGES.landscape.mountainsAboveCloud, IMAGES.landscape.mistyForest, IMAGES.landscape.forestPath],
      tags: ['Summit', 'Trekking', 'Bucket list'],
      includes: [
        'Park fees, camping fees and rescue fees',
        'All meals on the mountain',
        'Guides, cook and porters',
        'Tents, sleeping mats and mess tent',
        'Daily health monitoring with pulse oximeter',
        'Two nights Moshi hotel, before and after',
      ],
      excludes: ['Flights', 'Personal climbing gear (hire available in Moshi)', 'Tips for the mountain crew', 'Travel and evacuation insurance'],
      requirements: [
        'Good general fitness — you should be able to walk 6–7 hours on consecutive days',
        'Travel insurance covering trekking to 6,000m and helicopter evacuation',
        'Medical clearance if you have a heart or respiratory condition',
      ],
      difficulty: 'Challenging',
      minAge: 14,
      rating: 4.7,
      itinerary: [
        { title: 'Machame Gate → Machame Camp', summary: 'Rainforest, and usually rain.', activities: ['Registration at the gate', '11km through rainforest, 5–7 hours', 'Camp at 2,835m'], meals: ['Lunch', 'Dinner'], accommodation: 'Machame Camp, 2,835m' },
        { title: 'Machame → Shira Camp', summary: 'Out of the forest and onto the moorland.', activities: ['5km steep climb, 4–6 hours', 'Camp at 3,750m', 'First acclimatisation walk'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Shira Camp, 3,750m' },
        { title: 'Shira → Lava Tower → Barranco', summary: 'Climb high, sleep low — the day that does the acclimatisation work.', activities: ['Ascend to Lava Tower at 4,600m', 'Descend to Barranco at 3,960m', '10km, 6–8 hours'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Barranco Camp, 3,960m' },
        { title: 'Barranco → Karanga', summary: 'The Barranco Wall, which looks worse than it is.', activities: ['Scramble the Barranco Wall', '5km, 4–5 hours', 'Afternoon rest at Karanga'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Karanga Camp, 3,995m' },
        { title: 'Karanga → Barafu', summary: 'A short day on purpose. Sleep in the afternoon.', activities: ['4km, 3–4 hours', 'Early dinner', 'Sleep from 19:00'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Barafu Camp, 4,673m' },
        { title: 'Summit day', summary: 'Midnight start, Uhuru Peak at sunrise, then a long descent.', activities: ['00:00 departure for the summit', '06:30 Uhuru Peak, 5,895m', 'Descend to Mweka Camp, 3,068m'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Mweka Camp, 3,068m' },
        { title: 'Mweka Gate → Moshi', summary: 'Down through the forest, certificates at the gate.', activities: ['10km descent, 3–4 hours', 'Certificate presentation', 'Transfer to Moshi hotel'], meals: ['Breakfast', 'Lunch'] },
      ],
      departures: [
        { startIn: 34, capacity: 12, booked: 6 },
        { startIn: 68, capacity: 12, booked: 2 },
      ],
    },
    {
      organizer: 'tanzu-expeditions',
      destination: 'ruaha',
      title: 'Ruaha Wild Circuit',
      slug: 'ruaha-wild-circuit',
      summary: 'Five days in Tanzania’s largest park, where you can drive for an hour without meeting another vehicle.',
      description:
        'Ruaha gets a fraction of the visitors the northern circuit does, which is the entire point. Baobab country, big elephant herds, and one of the largest lion populations in East Africa.\n\nFive days from Iringa, staying in a tented camp inside the park. The days are long and the roads are rough. In exchange you get a park largely to yourself.',
      type: 'SAFARI',
      style: 'COMFORT',
      days: 5,
      nights: 4,
      price: tzs(1_950_000),
      heroImage: IMAGES.safari.elephantGrass,
      gallery: [IMAGES.safari.elephantBush, IMAGES.safari.loneAcacia, IMAGES.landscape.sunRays],
      tags: ['Off the circuit', 'Big cats', 'Quiet park'],
      includes: ['Four nights tented camp, full board', 'All game drives', 'Park fees', 'Transport from Iringa', 'Guide'],
      excludes: ['Flights to Iringa', 'Drinks', 'Tips'],
      requirements: STANDARD_REQUIREMENTS,
      difficulty: 'Easy to moderate',
      rating: 4.8,
      impactProject: 'mobile-health-clinic-iringa',
      itinerary: [
        { title: 'Iringa → Ruaha', summary: 'Into the park by mid-afternoon.', activities: ['Morning departure from Iringa', 'Park entry and first game drive', 'Camp check-in'], meals: ['Lunch', 'Dinner'], accommodation: 'Tented camp inside the park' },
        { title: 'Great Ruaha River', summary: 'Following the river, which is where everything goes.', activities: ['Dawn drive along the river', 'Midday break at camp', 'Afternoon drive'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Tented camp inside the park' },
        { title: 'Full day out', summary: 'Packed lunch, long loop, no returning to camp.', activities: ['Full-day drive into the western sector', 'Picnic lunch under a baobab'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Tented camp inside the park' },
        { title: 'Walking safari', summary: 'On foot with an armed ranger — a different sense of scale entirely.', activities: ['Morning walking safari', 'Afternoon game drive'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Tented camp inside the park' },
        { title: 'Return to Iringa', summary: 'A last drive on the way to the gate.', activities: ['Morning game drive', 'Depart for Iringa', 'Arrive late afternoon'], meals: ['Breakfast', 'Lunch'] },
      ],
      departures: [
        { startIn: 20, capacity: 12, booked: 5 },
        { startIn: 47, capacity: 12, booked: 2 },
      ],
    },
    {
      organizer: 'kaskazi-coast-travel',
      destination: 'pemba',
      title: 'Pemba Dive Week',
      slug: 'pemba-dive-week',
      summary: 'Six days of wall diving on the Pemba channel, for certified divers who want reef rather than crowds.',
      description:
        'The Pemba channel drops fast and clean, and the wall dives on the western side are the reason experienced divers make the extra journey out here.\n\nSix days, up to three dives a day, small boats and small groups. Nitrox available. The trip contributes to reef restoration work on the same stretch of water we dive, which is a fairly direct arrangement.\n\nOpen Water certification minimum; Advanced recommended for the deeper wall sites.',
      type: 'ADVENTURE',
      style: 'COMFORT',
      days: 6,
      nights: 5,
      price: tzs(2_400_000),
      heroImage: IMAGES.coast.diver,
      gallery: [IMAGES.coast.islandTurquoise, IMAGES.coast.ocean, IMAGES.coast.coastlineAerial],
      tags: ['Diving', 'Reef', 'Small group'],
      includes: ['Five nights accommodation', 'Breakfast and dinner daily', 'Twelve boat dives with tanks and weights', 'Dive guide', 'Transfers on Pemba'],
      excludes: ['Flights to Pemba', 'Equipment hire', 'Nitrox supplement', 'Lunches', 'Dive insurance'],
      requirements: ['Open Water certification or above', 'Logged dive within the last 24 months', 'Dive insurance'],
      difficulty: 'Moderate',
      minAge: 18,
      rating: 4.8,
      impactProject: 'reef-restoration-pemba',
      itinerary: [
        { title: 'Arrival and check dive', summary: 'Settle in, then a shallow dive to sort weights and kit.', activities: ['Airport transfer', 'Afternoon check dive', 'Briefing and dinner'], meals: ['Dinner'], accommodation: 'Dive lodge, west coast' },
        { title: 'Northern walls', summary: 'Two dives on the northern sites.', activities: ['Two boat dives', 'Surface interval on the boat', 'Free afternoon'], meals: ['Breakfast', 'Dinner'], accommodation: 'Dive lodge, west coast' },
        { title: 'Channel dives', summary: 'The deep stuff, conditions permitting.', activities: ['Two boat dives on the channel wall', 'Optional third shallow dive'], meals: ['Breakfast', 'Dinner'], accommodation: 'Dive lodge, west coast' },
        { title: 'Restoration site', summary: 'Dive the nursery lines with the monitoring team.', activities: ['Dive with the reef restoration team', 'Talk on the survey method', 'Afternoon dive'], meals: ['Breakfast', 'Dinner'], accommodation: 'Dive lodge, west coast' },
        { title: 'Southern sites', summary: 'A boat day to the southern reefs.', activities: ['Full-day boat trip', 'Two to three dives'], meals: ['Breakfast', 'Dinner'], accommodation: 'Dive lodge, west coast' },
        { title: 'Departure', summary: 'No diving — 24 hours before flying.', activities: ['Slow morning', 'Transfer to airport'], meals: ['Breakfast'] },
      ],
      departures: [
        { startIn: 38, capacity: 8, booked: 3 },
        { startIn: 72, capacity: 8, booked: 1 },
      ],
    },
    {
      organizer: 'highland-crater-journeys',
      destination: 'ngorongoro',
      title: 'Northern Circuit — Private Journey',
      slug: 'northern-circuit-private-journey',
      summary:
        'Six days across Tarangire, Ngorongoro and the Serengeti, built for your group alone with dates and pace you set.',
      description:
        'A private version of the northern circuit for families, couples and small groups who would rather not share a vehicle with strangers.\n\nThe route below is a starting point. Departure dates, lodge standard, pace and the balance between driving and resting are all yours to change — tell us what you want and we will rebuild it. The price shown is per person for a group of four in comfort-standard lodges.',
      type: 'PRIVATE',
      style: 'LUXURY',
      days: 6,
      nights: 5,
      price: tzs(5_600_000),
      heroImage: IMAGES.safari.elephantFamily,
      gallery: [IMAGES.landscape.greenHighlands, IMAGES.safari.acaciaPlain, IMAGES.safari.vehicleSunset],
      tags: ['Private', 'Family friendly', 'Tailor-made'],
      includes: ['Private 4x4 and guide throughout', 'Five nights lodges, full board', 'All park fees', 'Arusha transfers', 'Flexible itinerary'],
      excludes: ['International flights', 'Premium drinks', 'Balloon safari', 'Tips'],
      requirements: ['Passport valid six months beyond travel', 'Dietary requirements shared at least two weeks ahead'],
      difficulty: 'Easy',
      rating: 5.0,
      itinerary: [
        { title: 'Arusha → Tarangire', summary: 'Elephants and baobabs on day one.', activities: ['Morning pickup in Arusha', 'Afternoon game drive in Tarangire'], meals: ['Lunch', 'Dinner'], accommodation: 'Lodge near Tarangire' },
        { title: 'Tarangire', summary: 'A full day at your own pace.', activities: ['Full-day game drive', 'Optional walking safari'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Lodge near Tarangire' },
        { title: 'To the crater rim', summary: 'Via Karatu and the highlands.', activities: ['Drive to Karatu', 'Optional coffee farm visit', 'Arrive crater rim'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Crater rim lodge' },
        { title: 'Crater floor', summary: 'Early descent, before the day-trippers.', activities: ['Dawn descent', 'Full morning on the crater floor', 'Afternoon at leisure'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Crater rim lodge' },
        { title: 'Serengeti', summary: 'Onto the plains.', activities: ['Drive into the Serengeti', 'Olduvai Gorge stop', 'Afternoon game drive'], meals: ['Breakfast', 'Lunch', 'Dinner'], accommodation: 'Serengeti lodge' },
        { title: 'Serengeti → Arusha', summary: 'Morning drive, then fly or drive back.', activities: ['Dawn game drive', 'Flight or drive to Arusha'], meals: ['Breakfast', 'Lunch'] },
      ],
      departures: [
        { startIn: 15, capacity: 6, booked: 2 },
        { startIn: 43, capacity: 6, booked: 0 },
        { startIn: 78, capacity: 6, booked: 0 },
      ],
    },
    {
      organizer: 'tanzu-expeditions',
      destination: 'zanzibar',
      title: 'Stone Town Culture Weekend',
      slug: 'stone-town-culture-weekend',
      summary: 'Three days of food, history and music in Stone Town, led by people who grew up in it.',
      description:
        'A short cultural weekend that stays in the old town rather than treating it as a stopover on the way to a beach.\n\nA proper food walk, a morning at the fish and spice markets with a cook, an evening of taarab music, and a guided visit to the former slave market memorial that does not rush it. Two nights in a restored merchant house.',
      type: 'CULTURAL',
      style: 'BUDGET',
      days: 3,
      nights: 2,
      price: tzs(520_000),
      heroImage: IMAGES.coast.mooredBoats,
      gallery: [IMAGES.people.cooking, IMAGES.people.gathering, IMAGES.coast.beachSunset],
      tags: ['Food', 'History', 'Music'],
      includes: ['Two nights guesthouse', 'Breakfast daily', 'Food walk with tastings', 'Market visit and cooking session', 'Taarab music evening', 'Guided heritage walk'],
      excludes: ['Travel to Zanzibar', 'Dinners not listed', 'Personal spending'],
      requirements: ['Modest dress in the old town', 'Comfortable walking shoes'],
      difficulty: 'Easy',
      rating: 4.6,
      impactProject: 'womens-craft-cooperative-bagamoyo',
      itinerary: [
        { title: 'Arrive and evening food walk', summary: 'Eat your way through the old town.', activities: ['Check in', 'Evening food walk with six tasting stops', 'Forodhani gardens'], meals: ['Dinner'], accommodation: 'Restored merchant house, Stone Town' },
        { title: 'Markets, history, music', summary: 'The fullest day.', activities: ['Morning market visit with a local cook', 'Cooking session and lunch', 'Heritage walk including the slave market memorial', 'Taarab music in the evening'], meals: ['Breakfast', 'Lunch'], accommodation: 'Restored merchant house, Stone Town' },
        { title: 'Free morning and departure', summary: 'Shop, swim or sit.', activities: ['Free morning', 'Transfer to ferry or airport'], meals: ['Breakfast'] },
      ],
      departures: [
        { startIn: 6, capacity: 14, booked: 12 },
        { startIn: 27, capacity: 14, booked: 6 },
        { startIn: 55, capacity: 14, booked: 1 },
      ],
    },
    {
      organizer: 'serengeti-collective',
      destination: 'diani',
      title: 'Diani Coast Break',
      slug: 'diani-coast-break',
      summary: 'Four days on the Kenyan south coast — reef, forest and a lot of very good beach.',
      description:
        'Our first trip outside Tanzania, and a straightforward one: four days at Diani with a reef day, a Colobus forest walk and enough unstructured time to actually rest.\n\nTravel to Mombasa is not included; we meet you there.',
      type: 'BEACH',
      style: 'COMFORT',
      days: 4,
      nights: 3,
      price: tzs(1_300_000),
      heroImage: IMAGES.coast.coastlineAerial,
      gallery: [IMAGES.coast.beachSunset, IMAGES.coast.lagoonAerial, IMAGES.coast.palmParasols],
      tags: ['International', 'Beach', 'Reef'],
      includes: ['Three nights beachfront hotel', 'Breakfast daily', 'Mombasa airport transfers', 'Reef snorkelling trip', 'Colobus forest walk'],
      excludes: ['Flights to Mombasa', 'Kenya visa', 'Lunches and dinners', 'Water sports'],
      requirements: ['Passport valid six months beyond travel', 'Kenya eTA — apply before departure'],
      difficulty: 'Easy',
      rating: 4.5,
      itinerary: [
        { title: 'Mombasa → Diani', summary: 'Meet at the airport, be on the beach by lunch.', activities: ['Airport pickup', 'Transfer to Diani', 'Free afternoon'], meals: [], accommodation: 'Beachfront hotel, Diani' },
        { title: 'Reef day', summary: 'Out to the marine park early, back for a long lunch.', activities: ['Morning boat to the reef', 'Snorkelling', 'Free afternoon'], meals: ['Breakfast'], accommodation: 'Beachfront hotel, Diani' },
        { title: 'Forest and beach', summary: 'A short walk in the morning, nothing after it.', activities: ['Colobus forest walk', 'Free afternoon and evening'], meals: ['Breakfast'], accommodation: 'Beachfront hotel, Diani' },
        { title: 'Departure', summary: 'Transfer timed to your flight.', activities: ['Free morning', 'Transfer to Mombasa airport'], meals: ['Breakfast'] },
      ],
      departures: [
        { startIn: 41, capacity: 16, booked: 4 },
        { startIn: 76, capacity: 16, booked: 1 },
      ],
    },
    {
      organizer: 'bahari-nomad-tours',
      destination: 'pemba',
      title: 'Tanga Coast Discovery',
      slug: 'tanga-coast-discovery',
      summary: 'A four-day coastal trip from Tanga — submitted for review, not yet published.',
      description:
        'A draft listing from a new operator, included in the demo so the review queue and the pending-approval states have something real behind them. Not visible on the public marketplace.',
      type: 'BEACH',
      style: 'BUDGET',
      status: 'PENDING_REVIEW',
      days: 4,
      nights: 3,
      price: tzs(680_000),
      heroImage: IMAGES.coast.ocean,
      gallery: [IMAGES.coast.islandTurquoise],
      tags: ['Coast', 'New operator'],
      includes: ['Three nights accommodation', 'Breakfast daily', 'Boat trip'],
      excludes: ['Transport to Tanga', 'Most meals'],
      requirements: ['National ID or passport'],
      difficulty: 'Easy',
      itinerary: [
        { title: 'Arrive Tanga', summary: 'Check in and orientation.', activities: ['Arrival and check in'], meals: ['Dinner'], accommodation: 'Guesthouse, Tanga' },
        { title: 'Coastal boat day', summary: 'Out along the coast.', activities: ['Boat trip', 'Snorkelling'], meals: ['Breakfast'], accommodation: 'Guesthouse, Tanga' },
        { title: 'Amboni caves', summary: 'Inland for the morning.', activities: ['Caves visit', 'Free afternoon'], meals: ['Breakfast'], accommodation: 'Guesthouse, Tanga' },
        { title: 'Departure', summary: 'Morning departure.', activities: ['Check out'], meals: ['Breakfast'] },
      ],
      departures: [{ startIn: 60, capacity: 12, booked: 0 }],
    },
  ];

  const trips: Record<string, { id: string; departures: string[]; organizerUserId: string; currency: string }> = {};

  for (const entry of tripSeed) {
    const organizer = organizers[entry.organizer];
    const status = entry.status ?? 'PUBLISHED';

    const created = await prisma.trip.create({
      data: {
        organizerId: organizer.id,
        destinationId: destinations[entry.destination],
        title: entry.title,
        slug: entry.slug,
        summary: entry.summary,
        description: entry.description,
        type: entry.type,
        style: entry.style,
        status,
        durationDays: entry.days,
        durationNights: entry.nights,
        basePrice: entry.price,
        currency: 'TZS',
        heroImage: entry.heroImage,
        gallery: json(entry.gallery),
        tags: json(entry.tags),
        includes: json(entry.includes),
        excludes: json(entry.excludes),
        requirements: json(entry.requirements),
        difficulty: entry.difficulty ?? null,
        minAge: entry.minAge ?? null,
        rating: entry.rating ?? null,
        featured: entry.featured ?? false,
        impactProjectId: entry.impactProject ? projects[entry.impactProject] : null,
        isDemo: true,
        submittedAt: daysFromNow(-100),
        publishedAt: status === 'PUBLISHED' ? daysFromNow(-95) : null,
        reviewedById: status === 'PUBLISHED' ? admin.id : null,
        itinerary: {
          create: entry.itinerary.map((day, index) => ({
            dayNumber: index + 1,
            title: day.title,
            summary: day.summary,
            activities: json(day.activities),
            meals: json(day.meals),
            accommodation: day.accommodation ?? null,
          })),
        },
      },
    });

    const departureIds: string[] = [];
    for (const departure of entry.departures) {
      const start = daysFromNow(departure.startIn);
      const end = daysFromNow(departure.startIn + entry.days - 1, 18);
      const booked = departure.booked ?? 0;
      const created2 = await prisma.tripDate.create({
        data: {
          tripId: created.id,
          startDate: start,
          endDate: end,
          capacity: departure.capacity,
          // Seat counts are set directly here and then topped up by the real
          // bookings created below, so the demo shows partly-full departures.
          seatsBooked: booked,
          price: departure.price ?? null,
          status: booked >= departure.capacity ? 'FULL' : 'OPEN',
        },
      });
      departureIds.push(created2.id);
    }

    trips[entry.slug] = {
      id: created.id,
      departures: departureIds,
      organizerUserId: organizer.userId,
      currency: 'TZS',
    };
  }

  /* -------------------------- A past trip, for reviews ---------------------- */

  console.log('› creating a completed departure with reviews');

  const mikumi = trips['mikumi-adventure'];
  const pastDeparture = await prisma.tripDate.create({
    data: {
      tripId: mikumi.id,
      startDate: daysFromNow(-38),
      endDate: daysFromNow(-36, 18),
      capacity: 20,
      seatsBooked: 18,
      status: 'DEPARTED',
    },
  });

  const pastConversation = await prisma.conversation.create({
    data: {
      tripDateId: pastDeparture.id,
      title: 'Mikumi Adventure',
      members: { create: { userId: mikumi.organizerUserId, role: 'ORGANIZER' } },
    },
  });

  /* -------------------------------- Bookings -------------------------------- */

  console.log('› creating bookings, payments and contributions');

  let bookingCounter = 0;
  function reference(): string {
    bookingCounter += 1;
    return `ENH-D${String(bookingCounter).padStart(5, '0')}`;
  }

  interface BookingSeed {
    traveller: number;
    tripSlug: string;
    departureIndex: number;
    travellers: number;
    impact?: number;
    impactProject?: string;
    status?: string;
    daysAgo: number;
    past?: boolean;
  }

  const bookingSeed: BookingSeed[] = [
    { traveller: 0, tripSlug: 'mikumi-adventure', departureIndex: 0, travellers: 1, impact: tzs(10_000), impactProject: 'classroom-block-morogoro', daysAgo: 12 },
    { traveller: 1, tripSlug: 'mikumi-adventure', departureIndex: 0, travellers: 2, impact: tzs(20_000), impactProject: 'classroom-block-morogoro', daysAgo: 10 },
    { traveller: 4, tripSlug: 'mikumi-adventure', departureIndex: 0, travellers: 1, daysAgo: 8 },
    { traveller: 9, tripSlug: 'mikumi-adventure', departureIndex: 1, travellers: 2, impact: tzs(5_000), impactProject: 'village-borehole-chalinze', daysAgo: 5 },
    { traveller: 2, tripSlug: 'zanzibar-escape', departureIndex: 0, travellers: 2, impact: tzs(20_000), impactProject: 'reef-restoration-pemba', daysAgo: 16 },
    { traveller: 6, tripSlug: 'zanzibar-escape', departureIndex: 0, travellers: 1, daysAgo: 11 },
    { traveller: 10, tripSlug: 'zanzibar-escape', departureIndex: 1, travellers: 2, impact: tzs(10_000), impactProject: 'reef-restoration-pemba', daysAgo: 4 },
    { traveller: 3, tripSlug: 'serengeti-migration-circuit', departureIndex: 0, travellers: 2, impact: tzs(50_000), impactProject: 'classroom-block-morogoro', daysAgo: 21 },
    { traveller: 7, tripSlug: 'serengeti-migration-circuit', departureIndex: 0, travellers: 1, daysAgo: 14 },
    { traveller: 5, tripSlug: 'ngorongoro-crater-highlands-walk', departureIndex: 0, travellers: 1, impact: tzs(10_000), impactProject: 'womens-craft-cooperative-bagamoyo', daysAgo: 18 },
    { traveller: 8, tripSlug: 'kilimanjaro-machame-route', departureIndex: 0, travellers: 1, impact: tzs(20_000), impactProject: 'mobile-health-clinic-iringa', daysAgo: 25 },
    { traveller: 11, tripSlug: 'stone-town-culture-weekend', departureIndex: 0, travellers: 2, daysAgo: 6 },
    { traveller: 0, tripSlug: 'ruaha-wild-circuit', departureIndex: 0, travellers: 1, impact: tzs(10_000), impactProject: 'mobile-health-clinic-iringa', daysAgo: 9 },
    { traveller: 3, tripSlug: 'pemba-dive-week', departureIndex: 0, travellers: 1, impact: tzs(20_000), impactProject: 'reef-restoration-pemba', daysAgo: 13 },
    { traveller: 1, tripSlug: 'northern-circuit-private-journey', departureIndex: 0, travellers: 2, daysAgo: 7 },
    // A cancelled booking, so the cancelled state exists in the demo.
    { traveller: 6, tripSlug: 'diani-coast-break', departureIndex: 0, travellers: 1, status: 'CANCELLED', daysAgo: 15 },
  ];

  const createdBookings: { id: string; userId: string; tripSlug: string; departureId: string }[] = [];

  for (const entry of bookingSeed) {
    const trip = trips[entry.tripSlug];
    const tripRecord = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } });
    const departureId = trip.departures[entry.departureIndex];
    const departure = await prisma.tripDate.findUniqueOrThrow({ where: { id: departureId } });
    const traveller = travellers[entry.traveller];

    const unit = departure.price ?? tripRecord.basePrice;
    const tripAmount = unit * entry.travellers;
    const impactAmount = entry.impact ?? 0;
    const total = tripAmount + impactAmount;
    const platformFee = Math.round(tripAmount * 0.1);
    const status = entry.status ?? 'CONFIRMED';
    const createdAt = daysFromNow(-entry.daysAgo, 14);

    const booking = await prisma.booking.create({
      data: {
        reference: reference(),
        tripId: trip.id,
        tripDateId: departureId,
        userId: traveller.id,
        travellers: entry.travellers,
        status,
        tripAmount,
        impactAmount,
        totalAmount: total,
        platformFee,
        currency: 'TZS',
        impactProjectId: entry.impactProject ? projects[entry.impactProject] : null,
        createdAt,
        cancelledAt: status === 'CANCELLED' ? daysFromNow(-entry.daysAgo + 2, 10) : null,
        cancelReason: status === 'CANCELLED' ? 'Cancelled by traveller — change of dates' : null,
        travellerList: {
          create: Array.from({ length: entry.travellers }).map((_, index) => ({
            fullName: index === 0 ? traveller.name : `${traveller.name.split(' ')[0]} — guest ${index}`,
            email: index === 0 ? traveller.email : null,
          })),
        },
        commission: {
          create: {
            amount: platformFee,
            rate: 0.1,
            currency: 'TZS',
            status: status === 'CONFIRMED' ? 'EARNED' : 'REVERSED',
          },
        },
        payments: {
          create: {
            method: 'MOCK',
            provider: 'mock',
            providerRef: `SIM-DEMO${String(bookingCounter).padStart(4, '0')}`,
            amount: total,
            currency: 'TZS',
            status: status === 'CANCELLED' ? 'REFUNDED' : 'SUCCEEDED',
            // Every demo payment is explicitly simulated.
            simulated: true,
            rawResponse: json({ simulated: true, seeded: true }),
            createdAt,
            settledAt: createdAt,
            refundedAt: status === 'CANCELLED' ? daysFromNow(-entry.daysAgo + 2, 10) : null,
          },
        },
      },
    });

    if (status === 'CONFIRMED' && impactAmount > 0 && entry.impactProject) {
      await prisma.donation.create({
        data: {
          projectId: projects[entry.impactProject],
          userId: traveller.id,
          bookingId: booking.id,
          amount: impactAmount,
          currency: 'TZS',
          status: 'SUCCEEDED',
          donorName: traveller.name,
          createdAt,
        },
      });
    }

    createdBookings.push({ id: booking.id, userId: traveller.id, tripSlug: entry.tripSlug, departureId });
  }

  /* ------------------------- Past bookings and reviews ---------------------- */

  const pastBookingSeed = [
    { traveller: 0, rating: 5, title: 'Exactly what I needed after a long month', body: 'I booked this on a Wednesday and was in the park by Friday afternoon. The dawn drive was the best two hours I have had all year — we sat with a pride of lions for forty minutes and nobody else was there. The group was eleven strangers on Friday and a WhatsApp group that still goes off on Sunday. Guide knew every bird by call, which I did not expect to care about and then did.' },
    { traveller: 4, rating: 5, title: 'Well run from start to finish', body: 'Departure was on time, the vehicles were in good condition and the lodge was better than the photos suggested. What stood out was the guide slowing down rather than rushing to tick off animals. We spent a long time watching elephants at the waterhole and it was the highlight.' },
    { traveller: 9, rating: 4, title: 'Great trip, long drive', body: 'The park itself was excellent and the guiding was genuinely good. The drive from Dar is long in both directions and I would say that more clearly in the listing — it is a real part of the weekend. Everything else was as described and I would book with Tanzu again.' },
    { traveller: 5, rating: 5, title: 'Sat with the group at dinner and now we are planning Ruaha', body: 'I went on my own and that turned out to be the point. By the second evening we were all eating together and swapping cameras. The impact contribution at checkout was a small amount and I have since had two updates about the school it went to, which I did not expect.' },
  ];

  for (const entry of pastBookingSeed) {
    const traveller = travellers[entry.traveller];
    const tripRecord = await prisma.trip.findUniqueOrThrow({ where: { id: mikumi.id } });
    const createdAt = daysFromNow(-50, 11);

    const booking = await prisma.booking.create({
      data: {
        reference: reference(),
        tripId: mikumi.id,
        tripDateId: pastDeparture.id,
        userId: traveller.id,
        travellers: 1,
        status: 'COMPLETED',
        tripAmount: tripRecord.basePrice,
        impactAmount: tzs(10_000),
        totalAmount: tripRecord.basePrice + tzs(10_000),
        platformFee: Math.round(tripRecord.basePrice * 0.1),
        currency: 'TZS',
        impactProjectId: projects['classroom-block-morogoro'],
        createdAt,
        completedAt: daysFromNow(-36, 18),
        travellerList: { create: { fullName: traveller.name, email: traveller.email } },
        commission: { create: { amount: Math.round(tripRecord.basePrice * 0.1), rate: 0.1, currency: 'TZS', status: 'EARNED' } },
        payments: {
          create: {
            method: 'MOCK',
            provider: 'mock',
            providerRef: `SIM-DEMOP${entry.traveller}`,
            amount: tripRecord.basePrice + tzs(10_000),
            currency: 'TZS',
            status: 'SUCCEEDED',
            simulated: true,
            rawResponse: json({ simulated: true, seeded: true }),
            createdAt,
            settledAt: createdAt,
          },
        },
      },
    });

    await prisma.donation.create({
      data: {
        projectId: projects['classroom-block-morogoro'],
        userId: traveller.id,
        bookingId: booking.id,
        amount: tzs(10_000),
        currency: 'TZS',
        status: 'SUCCEEDED',
        donorName: traveller.name,
        createdAt,
      },
    });

    await prisma.conversationMember.create({
      data: { conversationId: pastConversation.id, userId: traveller.id, role: 'TRAVELER' },
    });

    await prisma.review.create({
      data: {
        tripId: mikumi.id,
        organizerId: organizers['tanzu-expeditions'].id,
        userId: traveller.id,
        bookingId: booking.id,
        rating: entry.rating,
        title: entry.title,
        body: entry.body,
        photos: json([]),
        createdAt: daysFromNow(-34, 16),
      },
    });
  }

  // Recompute the cached rating from the reviews just written.
  const mikumiReviews = await prisma.review.aggregate({
    where: { tripId: mikumi.id },
    _avg: { rating: true },
    _count: true,
  });
  await prisma.trip.update({
    where: { id: mikumi.id },
    data: {
      rating: Math.round((mikumiReviews._avg.rating ?? 0) * 10) / 10,
      reviewCount: mikumiReviews._count,
    },
  });
  await prisma.organizer.update({
    where: { id: organizers['tanzu-expeditions'].id },
    data: { reviewCount: mikumiReviews._count },
  });

  /* ------------------------- Trip groups and messages ----------------------- */

  console.log('› creating trip groups and chat history');

  const groupSeed: { tripSlug: string; departureIndex: number }[] = [
    { tripSlug: 'mikumi-adventure', departureIndex: 0 },
    { tripSlug: 'zanzibar-escape', departureIndex: 0 },
    { tripSlug: 'serengeti-migration-circuit', departureIndex: 0 },
    { tripSlug: 'stone-town-culture-weekend', departureIndex: 0 },
    { tripSlug: 'ngorongoro-crater-highlands-walk', departureIndex: 0 },
  ];

  const conversations: Record<string, string> = {};

  for (const entry of groupSeed) {
    const trip = trips[entry.tripSlug];
    const tripRecord = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } });
    const departureId = trip.departures[entry.departureIndex];

    const conversation = await prisma.conversation.create({
      data: {
        tripDateId: departureId,
        title: tripRecord.title,
        members: { create: { userId: trip.organizerUserId, role: 'ORGANIZER' } },
      },
    });
    conversations[entry.tripSlug] = conversation.id;

    const memberBookings = createdBookings.filter(
      (booking) => booking.departureId === departureId && booking.tripSlug === entry.tripSlug,
    );
    for (const booking of memberBookings) {
      await prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: conversation.id, userId: booking.userId } },
        create: { conversationId: conversation.id, userId: booking.userId, role: 'TRAVELER' },
        update: {},
      });
    }
  }

  const messageSeed: {
    tripSlug: string;
    author: 'organizer' | number;
    body: string;
    kind?: string;
    pinned?: boolean;
    hoursAgo: number;
  }[] = [
    {
      tripSlug: 'mikumi-adventure',
      author: 'organizer',
      kind: 'ANNOUNCEMENT',
      pinned: true,
      body: 'Departure is 6:00 AM sharp from the Mlimani City car park, north entrance. Please be there by 5:30 so we can load bags and leave on time — we lose the best light if we are late. Bring a warm layer for the morning drive, it is colder than people expect.',
      hoursAgo: 30,
    },
    { tripSlug: 'mikumi-adventure', author: 0, body: 'What time are we leaving Dar?', hoursAgo: 34 },
    { tripSlug: 'mikumi-adventure', author: 'organizer', body: 'Pinned above — 6:00 AM, be there 5:30. See you all Friday.', hoursAgo: 29 },
    { tripSlug: 'mikumi-adventure', author: 1, body: 'Is there space for a small cooler bag or should I pack light?', hoursAgo: 26 },
    { tripSlug: 'mikumi-adventure', author: 'organizer', body: 'A small cooler is fine. One bag plus a day pack each, and we have water on board for everyone.', hoursAgo: 25 },
    { tripSlug: 'mikumi-adventure', author: 4, body: 'First safari for me — any advice on what to actually bring?', hoursAgo: 20 },
    { tripSlug: 'mikumi-adventure', author: 0, body: 'Binoculars if you have them. Last time I borrowed a pair and regretted not having my own.', hoursAgo: 19 },
    { tripSlug: 'mikumi-adventure', author: 'organizer', body: 'Neutral colours, a hat, sunscreen and something warm for the 5:45 start. We have a couple of spare binoculars in the vehicles.', hoursAgo: 18 },
    { tripSlug: 'mikumi-adventure', author: 1, body: 'See everyone Friday. Coffee is on me at the meeting point.', hoursAgo: 6 },
    {
      tripSlug: 'zanzibar-escape',
      author: 'organizer',
      kind: 'ANNOUNCEMENT',
      pinned: true,
      body: 'Ferry tickets are booked for the 09:30 crossing. If you are flying in instead, message me your arrival time and I will arrange the transfer. Bring modest clothing for Stone Town and the spice farm — shoulders and knees covered.',
      hoursAgo: 50,
    },
    { tripSlug: 'zanzibar-escape', author: 2, body: 'Landing at 08:10 on the Wednesday. Is that enough time for the transfer?', hoursAgo: 44 },
    { tripSlug: 'zanzibar-escape', author: 'organizer', body: 'Plenty. Our driver will be at arrivals with a board. Twenty minutes to the guesthouse.', hoursAgo: 43 },
    { tripSlug: 'zanzibar-escape', author: 6, body: 'How cold does it get in the evening? Trying to work out if I need a jacket.', hoursAgo: 22 },
    { tripSlug: 'zanzibar-escape', author: 'organizer', body: 'You will not need a jacket. A light long-sleeve for the dhow evening is the most you will want.', hoursAgo: 21 },
    {
      tripSlug: 'serengeti-migration-circuit',
      author: 'organizer',
      kind: 'ANNOUNCEMENT',
      pinned: true,
      body: 'Camp position for this departure is confirmed in the central-north sector. Our guides have the herds moving that way and we will finalise the exact site ten days out. Baggage limit is 15kg soft bag per person for the light aircraft leg.',
      hoursAgo: 72,
    },
    { tripSlug: 'serengeti-migration-circuit', author: 3, body: 'Is 15kg including camera gear? I have a long lens that is not light.', hoursAgo: 66 },
    { tripSlug: 'serengeti-migration-circuit', author: 'organizer', body: 'Camera gear can come as a separate carry-on and is not counted in the 15kg. Bring the lens.', hoursAgo: 65 },
    { tripSlug: 'serengeti-migration-circuit', author: 7, body: 'Anyone else flying in via Kilimanjaro the day before? Happy to share a transfer.', hoursAgo: 30 },
    { tripSlug: 'stone-town-culture-weekend', author: 'organizer', kind: 'ANNOUNCEMENT', pinned: true, body: 'We meet at 17:00 on Friday at the guesthouse for the food walk. Come hungry — six stops and the last one is a full plate.', hoursAgo: 40 },
    { tripSlug: 'stone-town-culture-weekend', author: 11, body: 'Any dietary options for vegetarians on the food walk?', hoursAgo: 33 },
    { tripSlug: 'stone-town-culture-weekend', author: 'organizer', body: 'Four of the six stops are vegetarian and we swap the other two. Let me know about anything else and I will arrange it.', hoursAgo: 32 },
    { tripSlug: 'ngorongoro-crater-highlands-walk', author: 'organizer', kind: 'ANNOUNCEMENT', pinned: true, body: 'Kit list is important on this one. Broken-in boots, a warm sleeping layer and a head torch. The highlands drop to about 5°C at night and the fly camps are not heated.', hoursAgo: 55 },
    { tripSlug: 'ngorongoro-crater-highlands-walk', author: 5, body: 'Can I hire a sleeping bag rather than flying with one?', hoursAgo: 48 },
    { tripSlug: 'ngorongoro-crater-highlands-walk', author: 'organizer', body: 'Yes — TZS 25,000 for the trip, four-season bag, clean. I will put one aside for you.', hoursAgo: 47 },
  ];

  for (const entry of messageSeed) {
    const conversationId = conversations[entry.tripSlug];
    if (!conversationId) continue;
    const trip = trips[entry.tripSlug];
    const userId = entry.author === 'organizer' ? trip.organizerUserId : travellers[entry.author].id;

    await prisma.message.create({
      data: {
        conversationId,
        userId,
        body: entry.body,
        kind: entry.kind ?? 'TEXT',
        pinned: entry.pinned ?? false,
        createdAt: new Date(Date.now() - entry.hoursAgo * 60 * 60 * 1000),
      },
    });
  }

  /* ---------------------------- Standalone donations ------------------------ */

  console.log('› creating standalone contributions');

  const standaloneDonations = [
    { traveller: 2, project: 'village-borehole-chalinze', amount: tzs(50_000), daysAgo: 3, message: 'For the spares fund.' },
    { traveller: 7, project: 'classroom-block-morogoro', amount: tzs(100_000), daysAgo: 8, anonymous: true },
    { traveller: 10, project: 'mobile-health-clinic-iringa', amount: tzs(25_000), daysAgo: 12 },
    { traveller: 4, project: 'womens-craft-cooperative-bagamoyo', amount: tzs(40_000), daysAgo: 17, message: 'Bought a scarf from them in March. Good work.' },
    { traveller: 8, project: 'reef-restoration-pemba', amount: tzs(75_000), daysAgo: 20 },
  ];

  for (const entry of standaloneDonations) {
    const traveller = travellers[entry.traveller];
    await prisma.donation.create({
      data: {
        projectId: projects[entry.project],
        userId: traveller.id,
        amount: entry.amount,
        currency: 'TZS',
        status: 'SUCCEEDED',
        anonymous: entry.anonymous ?? false,
        message: entry.message ?? null,
        donorName: entry.anonymous ? null : traveller.name,
        createdAt: daysFromNow(-entry.daysAgo, 15),
      },
    });
  }

  /* ---------------------------- Custom trip requests ------------------------ */

  console.log('› creating custom trip requests');

  await prisma.customTripRequest.createMany({
    data: [
      {
        userId: travellers[3].id,
        contactName: travellers[3].name,
        contactEmail: travellers[3].email,
        destination: 'Serengeti and Zanzibar',
        startDate: daysFromNow(95),
        endDate: daysFromNow(107),
        travellers: 4,
        budget: tzs(18_000_000),
        currency: 'TZS',
        style: 'LUXURY',
        accommodation: 'Lodges and a beachfront hotel',
        activities: json(['Game drives', 'Hot air balloon', 'Snorkelling', 'Spice tour']),
        notes: 'Two adults, two children aged 9 and 12. Would like a slower pace than the standard circuit and a couple of days with nothing scheduled.',
        status: 'NEW',
        createdAt: daysFromNow(-2, 11),
      },
      {
        contactName: 'Marcus Bergmann',
        contactEmail: 'marcus.bergmann@example.com',
        destination: 'Kilimanjaro',
        startDate: daysFromNow(150),
        endDate: daysFromNow(159),
        travellers: 2,
        budget: tzs(9_000_000),
        currency: 'TZS',
        style: 'COMFORT',
        accommodation: 'Standard mountain camping',
        activities: json(['Trekking', 'Acclimatisation days']),
        notes: 'Lemosho route preferred, 8 days. Both of us have trekked to 4,000m before.',
        status: 'MATCHING',
        createdAt: daysFromNow(-6, 9),
      },
      {
        userId: travellers[9].id,
        contactName: travellers[9].name,
        contactEmail: travellers[9].email,
        destination: 'Ruaha',
        startDate: daysFromNow(60),
        endDate: daysFromNow(64),
        travellers: 8,
        budget: tzs(12_000_000),
        currency: 'TZS',
        style: 'BUDGET',
        accommodation: 'Camping',
        activities: json(['Game drives', 'Walking safari']),
        notes: 'Company team trip. Flexible on dates by a week either side.',
        status: 'QUOTED',
        createdAt: daysFromNow(-11, 14),
      },
    ],
  });

  /* ------------------------------- Notifications ---------------------------- */

  console.log('› creating notifications');

  await prisma.notification.createMany({
    data: [
      {
        userId: travellers[0].id,
        type: 'TRIP_REMINDER',
        title: 'Your Mikumi Adventure starts tomorrow',
        body: 'Departure is 6:00 AM from Mlimani City. Be there by 5:30.',
        link: '/account/trips',
        createdAt: daysFromNow(0, 8),
      },
      {
        userId: travellers[0].id,
        type: 'ANNOUNCEMENT',
        title: 'Announcement · Mikumi Adventure',
        body: 'Departure is 6:00 AM sharp from the Mlimani City car park, north entrance.',
        link: '/account/groups',
        createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
      },
      {
        userId: travellers[0].id,
        type: 'IMPACT_UPDATE',
        title: 'Update from Classroom Block — Morogoro',
        body: 'School supplies delivered',
        link: '/impact/classroom-block-morogoro',
        read: true,
        createdAt: daysFromNow(-22, 12),
      },
      {
        userId: organizers['bahari-nomad-tours'].userId,
        type: 'ORGANIZER_STATUS',
        title: 'Verification under review',
        body: 'Your documents are with the Enhakkore team. We will be in touch within three working days.',
        link: '/organizer/verification',
        createdAt: daysFromNow(-3, 10),
      },
    ],
  });

  /* ---------------------------------- Done ---------------------------------- */

  const counts = {
    users: await prisma.user.count(),
    organizers: await prisma.organizer.count(),
    destinations: await prisma.destination.count(),
    trips: await prisma.trip.count(),
    departures: await prisma.tripDate.count(),
    bookings: await prisma.booking.count(),
    projects: await prisma.impactProject.count(),
    donations: await prisma.donation.count(),
    messages: await prisma.message.count(),
    reviews: await prisma.review.count(),
  };

  console.log('\n  Demo data ready\n');
  console.table(counts);
  console.log(`
  Sign-in accounts (all use the password: Enhakkore2026!)

    Admin        admin@enhakkore.com
    Organizer    trips@tanzuexpeditions.demo      (verified, runs Mikumi)
    Organizer    team@baharinomad.demo            (pending verification)
    Traveller    michael@traveller.demo           (bookings, group chat, impact history)
    Traveller    sarah@traveller.demo

  All content above is fictional demonstration data.
  No real payments, organizations, projects or verifications exist in this build.
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
