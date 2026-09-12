/**
 * Image catalogue for demonstration content.
 *
 * These are Unsplash-hosted photographs used as PLACEHOLDER art direction while
 * the platform is pre-launch. They are generic travel, landscape and still-life
 * photography — not pictures of any Enhakkore trip, operator, community or
 * impact project. Every key below is named for the subject that is actually in
 * the frame, so swapping in commissioned photography is a one-line change.
 *
 * Production note: serve licensed imagery from your own CDN and update
 * `images.remotePatterns` in apps/web/next.config.ts accordingly.
 */

const BASE = 'https://images.unsplash.com';

function img(id: string, width = 1600, height = 1000): string {
  return `${BASE}/${id}?auto=format&fit=crop&w=${width}&h=${height}&q=80`;
}

export const IMAGES = {
  safari: {
    /** Safari vehicle on open grassland at sunset. */
    vehicleSunset: img('photo-1516426122078-c23e76319801'),
    /** Giraffe beside an acacia at golden hour. */
    giraffeAcacia: img('photo-1523805009345-7448845a9e53'),
    /** Elephant portrait in green bush. */
    elephantBush: img('photo-1549366021-9f761d450615'),
    /** Elephant crossing dry golden grass. */
    elephantGrass: img('photo-1535941339077-2dd1c7963098'),
    /** Acacia-dotted plain at sunrise. */
    acaciaPlain: img('photo-1547471080-7cc2caa01a7e'),
    /** Elephant with calf on open savannah. */
    elephantFamily: img('photo-1521651201144-634f700b36ef'),
    /** Two rhinos on dry ground. */
    rhinos: img('photo-1547970810-dc1eac37d174'),
    /** Single acacia silhouetted at sunset. */
    loneAcacia: img('photo-1516026672322-bc52d61a55d5'),
  },
  landscape: {
    /** Snow-capped peak above an open plain. */
    snowPeakPlain: img('photo-1489392191049-fc10c97e64b6'),
    /** Green rolling highland hills. */
    greenHighlands: img('photo-1469474968028-56623f02e42e'),
    /** Narrow ridge trail through green hills. */
    ridgeTrail: img('photo-1510797215324-95aa89f43c33'),
    /** Mountain range rising above cloud. */
    mountainsAboveCloud: img('photo-1506905925346-21bda4d32df4'),
    /** Still alpine lake beneath peaks. */
    alpineLake: img('photo-1470770841072-f978cf4d019e'),
    /** Mirror lake and forested mountains. */
    mirrorLake: img('photo-1493246507139-91e8fad9978e'),
    /** Mist hanging over dense forest. */
    mistyForest: img('photo-1509316975850-ff9c5deb0cd9'),
    /** Light through tall forest. */
    forestPath: img('photo-1441974231531-c6227db76b6e'),
    /** Jungle valley under low cloud. */
    jungleValley: img('photo-1488646953014-85cb44e25828'),
    /** Sun rays breaking through cloud. */
    sunRays: img('photo-1500835556837-99ac94a94552'),
    /** Forested mountain range. */
    mountainRange: img('photo-1464822759023-fed622ff2c3b'),
  },
  coast: {
    /** Warm light on an empty shoreline. */
    beachSunset: img('photo-1507525428034-b723cf961d3e'),
    /** Palm, parasols and turquoise water. */
    palmParasols: img('photo-1519046904884-53103b34b206'),
    /** Island fringed with palms and a wooden boat. */
    islandTurquoise: img('photo-1516815231560-8f41ec531527'),
    /** Diver among a school of fish. */
    diver: img('photo-1544551763-46a013bb70d5'),
    /** Stilt houses over shallow water. */
    stiltHouses: img('photo-1587922546307-776227941871'),
    /** Aerial over a palm lagoon. */
    lagoonAerial: img('photo-1552733407-5d5c46c3bb3b'),
    /** Aerial of forest meeting turquoise sea. */
    coastlineAerial: img('photo-1497436072909-60f360e1d4b1'),
    /** Open ocean swell. */
    ocean: img('photo-1559827260-dc66d52bef19'),
    /** Wooden boats moored below cliffs. */
    mooredBoats: img('photo-1552465011-b4e21bf6e79a'),
  },
  international: {
    /** Aerial of a river city — stands in for an international metropolis. */
    cityAerial: img('photo-1513635269975-59663e0ac1ad'),
    /** Whitewashed Mediterranean coastline. */
    mediterranean: img('photo-1533105079780-92b9be482077'),
    /** Ornate temple architecture. */
    temple: img('photo-1528181304800-259b08848526'),
    /** Green mountain terraces and ruins. */
    mountainRuins: img('photo-1526392060635-9d6019884377'),
  },
  people: {
    /** A group of friends together outdoors. */
    group: img('photo-1517486808906-6ca8b3f04846'),
    /** A crowd gathered at an outdoor event. */
    gathering: img('photo-1517457373958-b7bdd4587205'),
    /** Cooking over open heat. */
    cooking: img('photo-1534177616072-ef7dc120449d'),
    /** A traveller facing the sunrise, arms open. */
    sunriseTraveller: img('photo-1506126613408-eca07ce68773'),
    /** Map, camera and notebook laid out for planning. */
    planning: img('photo-1502920917128-1aa500764cbd'),
    /** Boat on a still lake at dawn. */
    boatDawn: img('photo-1476514525535-07fb3b4ae5f1'),
  },
  impact: {
    /** Open book — used for education projects. */
    openBook: img('photo-1541963463532-d68292c34b19'),
    /** Stacked textbooks. */
    books: img('photo-1497633762265-9d179a990aa6'),
    /** Clinician with a stethoscope. */
    healthcare: img('photo-1576091160399-112ba8d25d1d'),
    /** Clean water running into open hands. */
    water: img('photo-1538300342682-cf57afb97285'),
    /** A busy street scene. */
    community: img('photo-1517154421773-0529f29ea451'),
    /** Hands holding a hand-written note. */
    hands: img('photo-1532629345422-7515f3d16bb6'),
  },
} as const;
