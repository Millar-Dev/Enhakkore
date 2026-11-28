import { prisma } from '../lib/prisma';
import { ApiError } from '../lib/http';

/**
 * Tournament fixtures, brackets, results and standings.
 *
 * Formats:
 * - SINGLE_ELIMINATION — seeded bracket (1 v N, 2 v N-1 …), byes for missing places.
 * - DOUBLE_ELIMINATION — winners and losers brackets and a grand final
 *   (one grand-final match; no bracket reset).
 * - ROUND_ROBIN — everyone plays everyone once.
 * - LEAGUE — everyone plays everyone twice (home and away).
 *
 * A match slot can be filled, waiting for an earlier match, or empty for good
 * (a bye). After every result the bracket is resolved again, so byes advance
 * on their own and nobody waits for a match that can never happen.
 */

type Match = Awaited<ReturnType<typeof prisma.tournamentMatch.findMany>>[number];

const nextPow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(2, n)));

/** Standard seed order for a bracket of this size: [1, 8, 4, 5, 2, 7, 3, 6] for 8. */
function seedOrder(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const total = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, total - seed]);
  }
  return order;
}

async function eligibleEntries(tournamentId: string) {
  return prisma.tournamentEntry.findMany({
    where: { tournamentId, status: { in: ['REGISTERED', 'CONFIRMED'] } },
    orderBy: [{ seed: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function generateFixtures(tournamentId: string) {
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  const entries = await eligibleEntries(tournamentId);
  if (entries.length < 2) throw ApiError.badRequest('At least two entries are needed to make the fixtures.');
  const format = tournament.bracketFormat;
  if (format === 'DOUBLE_ELIMINATION' && entries.length < 4) throw ApiError.badRequest('Double elimination needs at least four entries. Use single elimination or round-robin.');
  await prisma.tournamentMatch.deleteMany({ where: { tournamentId } });
  // Seeds follow registration order unless the organiser set them.
  await prisma.$transaction(entries.map((entry, index) => prisma.tournamentEntry.update({ where: { id: entry.id }, data: { seed: index + 1 } })));

  if (format === 'ROUND_ROBIN' || format === 'LEAGUE') {
    await roundRobin(tournamentId, entries.map((entry) => entry.id), format === 'LEAGUE');
  } else {
    await elimination(tournamentId, entries.map((entry) => entry.id), format === 'DOUBLE_ELIMINATION');
    await resolve(tournamentId);
  }
  await prisma.tournament.update({ where: { id: tournamentId }, data: { status: 'IN_PROGRESS' } });
}

/** Circle method. Odd numbers get a rest ("bye") each round, which is simply no match. */
async function roundRobin(tournamentId: string, ids: string[], twice: boolean) {
  const players: (string | null)[] = [...ids];
  if (players.length % 2 === 1) players.push(null);
  const n = players.length;
  const rounds: [string, string][][] = [];
  const list = [...players];
  for (let round = 0; round < n - 1; round++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a && b) pairs.push(round % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop()!);
  }
  const all = twice ? [...rounds, ...rounds.map((pairs) => pairs.map(([a, b]) => [b, a] as [string, string]))] : rounds;
  const data = all.flatMap((pairs, roundIndex) =>
    pairs.map(([home, away], position) => ({ tournamentId, stage: 'LEAGUE', round: roundIndex + 1, position: position + 1, homeEntryId: home, awayEntryId: away, status: 'READY' })),
  );
  await prisma.tournamentMatch.createMany({ data });
}

async function elimination(tournamentId: string, ids: string[], double: boolean) {
  const size = nextPow2(ids.length);
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const create = (data: Omit<Parameters<typeof prisma.tournamentMatch.create>[0]['data'], 'tournament'>) =>
    prisma.tournamentMatch.create({ data: { ...data, tournamentId } as never });

  // Winners bracket, built from the final backwards so each match knows where its winner goes.
  const wb: Match[][] = [];
  for (let round = rounds; round >= 1; round--) {
    const count = size / 2 ** round;
    const list: Match[] = [];
    for (let position = 1; position <= count; position++) {
      const next = round < rounds ? wb[0]![Math.ceil(position / 2) - 1]! : null;
      const seedHome = round === 1 ? order[(position - 1) * 2]! : 0;
      const seedAway = round === 1 ? order[(position - 1) * 2 + 1]! : 0;
      list.push(
        await create({
          stage: 'WINNERS',
          round,
          position,
          homeEntryId: round === 1 ? (ids[seedHome - 1] ?? null) : null,
          awayEntryId: round === 1 ? (ids[seedAway - 1] ?? null) : null,
          nextMatchId: next?.id ?? null,
          nextSlot: next ? (position % 2 === 1 ? 'HOME' : 'AWAY') : null,
          status: 'PENDING',
        }),
      );
    }
    wb.unshift(list);
  }
  if (!double) return;

  // Losers bracket: 2 × (rounds − 1) rounds, then a grand final.
  const grandFinal = await create({ stage: 'GRAND_FINAL', round: 1, position: 1, status: 'PENDING' });
  await prisma.tournamentMatch.update({ where: { id: wb[rounds - 1]![0]!.id }, data: { nextMatchId: grandFinal.id, nextSlot: 'HOME' } });

  const lbRounds = 2 * (rounds - 1);
  const lb: Match[][] = [];
  for (let r = lbRounds; r >= 1; r--) {
    // Rounds come in pairs with the same number of matches: size/4, size/4, size/8, size/8 …
    const count = size / 2 ** (Math.ceil(r / 2) + 1);
    const list: Match[] = [];
    for (let position = 1; position <= count; position++) {
      let nextMatchId: string | null;
      let nextSlot: string | null;
      if (r === lbRounds) {
        nextMatchId = grandFinal.id;
        nextSlot = 'AWAY';
      } else if (r % 2 === 1) {
        // Odd round → the next (even) round has the same count; winner plays a winners-bracket loser there.
        nextMatchId = lb[0]![position - 1]!.id;
        nextSlot = 'HOME';
      } else {
        // Even round → the next (odd) round halves; winners pair up.
        nextMatchId = lb[0]![Math.ceil(position / 2) - 1]!.id;
        nextSlot = position % 2 === 1 ? 'HOME' : 'AWAY';
      }
      list.push(await create({ stage: 'LOSERS', round: r, position, nextMatchId, nextSlot, status: 'PENDING' }));
    }
    lb.unshift(list);
  }
  // Where winners-bracket losers drop to.
  for (let round = 1; round <= rounds; round++) {
    for (const match of wb[round - 1]!) {
      let target: { id: string; slot: string };
      if (round === 1) {
        target = { id: lb[0]![Math.ceil(match.position / 2) - 1]!.id, slot: match.position % 2 === 1 ? 'HOME' : 'AWAY' };
      } else {
        // WB round k losers meet the winners of LB round 2(k−1) − 1, in LB round 2(k−1). Reverse order spreads rematches.
        const lbRound = lb[2 * (round - 1) - 1]!;
        const index = lbRound.length - match.position;
        target = { id: lbRound[Math.max(0, index)]!.id, slot: 'AWAY' };
      }
      await prisma.tournamentMatch.update({ where: { id: match.id }, data: { loserNextMatchId: target.id, loserNextSlot: target.slot } });
    }
  }
}

/**
 * Fills slots from finished matches and settles byes, repeatedly, until
 * nothing changes. Safe to run at any time.
 */
export async function resolve(tournamentId: string) {
  for (let pass = 0; pass < 64; pass++) {
    const matches = await prisma.tournamentMatch.findMany({ where: { tournamentId, stage: { not: 'LEAGUE' } } });
    const byId = new Map(matches.map((m) => [m.id, m]));
    const feeders = (id: string, slot: string) =>
      matches.filter((m) => (m.nextMatchId === id && m.nextSlot === slot) || (m.loserNextMatchId === id && m.loserNextSlot === slot));
    const done = (m: Match) => m.status === 'COMPLETED' || m.status === 'BYE';
    /** Who a finished feeder sends to this slot: an entry id, or null for nobody. */
    const output = (feeder: Match, id: string, slot: string) => {
      const winnerSide = feeder.nextMatchId === id && feeder.nextSlot === slot;
      if (winnerSide) return feeder.winnerEntryId;
      const loser = feeder.winnerEntryId ? (feeder.homeEntryId === feeder.winnerEntryId ? feeder.awayEntryId : feeder.homeEntryId) : null;
      return feeder.status === 'BYE' ? null : loser;
    };
    let changed = false;
    for (const match of matches) {
      if (done(match)) continue;
      const slotState = (slot: 'HOME' | 'AWAY') => {
        const current = slot === 'HOME' ? match.homeEntryId : match.awayEntryId;
        if (current) return { state: 'FILLED' as const, value: current };
        const from = feeders(match.id, slot);
        if (from.length === 0) return { state: 'EMPTY' as const, value: null };
        const feeder = from[0]!;
        if (!done(byId.get(feeder.id)!)) return { state: 'WAITING' as const, value: null };
        const value = output(feeder, match.id, slot);
        return value ? { state: 'FILLED' as const, value } : { state: 'EMPTY' as const, value: null };
      };
      const home = slotState('HOME');
      const away = slotState('AWAY');
      const update: Record<string, unknown> = {};
      if (home.value && match.homeEntryId !== home.value) update.homeEntryId = home.value;
      if (away.value && match.awayEntryId !== away.value) update.awayEntryId = away.value;
      if (home.state === 'FILLED' && away.state === 'FILLED') {
        if (match.status !== 'READY') update.status = 'READY';
      } else if (home.state !== 'WAITING' && away.state !== 'WAITING') {
        // One side (or both) can never arrive: a bye.
        update.status = 'BYE';
        update.winnerEntryId = home.value ?? away.value ?? null;
      }
      if (Object.keys(update).length) {
        await prisma.tournamentMatch.update({ where: { id: match.id }, data: update });
        changed = true;
      }
    }
    if (!changed) break;
  }
  await maybeFinish(tournamentId);
}

async function maybeFinish(tournamentId: string) {
  const matches = await prisma.tournamentMatch.findMany({ where: { tournamentId } });
  if (matches.length === 0 || matches.some((m) => m.status !== 'COMPLETED' && m.status !== 'BYE')) return;
  const tournament = await prisma.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
  if (tournament.status === 'COMPLETED') return;
  const champion = await championOf(tournamentId, tournament.bracketFormat);
  const name = champion ? (champion.teamName || champion.playerName) : null;
  await prisma.tournament.update({ where: { id: tournamentId }, data: { status: 'COMPLETED', results: name ? `Winner: ${name}` : tournament.results } });
}

async function championOf(tournamentId: string, format: string) {
  if (format === 'ROUND_ROBIN' || format === 'LEAGUE') {
    const table = await standings(tournamentId);
    return table[0] ? prisma.tournamentEntry.findUnique({ where: { id: table[0].entryId } }) : null;
  }
  const final =
    (await prisma.tournamentMatch.findFirst({ where: { tournamentId, stage: 'GRAND_FINAL' } })) ??
    (await prisma.tournamentMatch.findFirst({ where: { tournamentId, stage: 'WINNERS', nextMatchId: null } }));
  return final?.winnerEntryId ? prisma.tournamentEntry.findUnique({ where: { id: final.winnerEntryId } }) : null;
}

export async function recordResult(matchId: string, homeScore: number, awayScore: number, reporterId: string) {
  const match = await prisma.tournamentMatch.findUniqueOrThrow({ where: { id: matchId } });
  if (!match.homeEntryId || !match.awayEntryId) throw ApiError.badRequest('Both sides of this match are not known yet.');
  if (match.stage !== 'LEAGUE' && homeScore === awayScore) throw ApiError.badRequest('Knockout matches need a winner. Enter the score after extra time or penalties.');
  // A finished knockout match cannot change once later matches depend on it.
  if (match.stage !== 'LEAGUE' && match.status === 'COMPLETED') {
    const downstream = await prisma.tournamentMatch.findMany({ where: { id: { in: [match.nextMatchId, match.loserNextMatchId].filter((id): id is string => !!id) }, status: 'COMPLETED' } });
    if (downstream.length > 0) throw ApiError.conflict('Later matches already depend on this result. Correct those first.');
  }
  const winner = homeScore === awayScore ? null : homeScore > awayScore ? match.homeEntryId : match.awayEntryId;
  await prisma.tournamentMatch.update({ where: { id: match.id }, data: { homeScore, awayScore, winnerEntryId: winner, status: 'COMPLETED', reportedById: reporterId, disputed: false } });
  if (match.stage !== 'LEAGUE') {
    // A corrected result clears what it had pushed forward, then the bracket is resolved again.
    for (const [nextId, slot] of [[match.nextMatchId, match.nextSlot], [match.loserNextMatchId, match.loserNextSlot]] as const) {
      if (nextId && slot) await prisma.tournamentMatch.update({ where: { id: nextId }, data: slot === 'HOME' ? { homeEntryId: null, status: 'PENDING' } : { awayEntryId: null, status: 'PENDING' } });
    }
  }
  await resolve(match.tournamentId);
}

export async function standings(tournamentId: string) {
  const [entries, matches] = await Promise.all([
    prisma.tournamentEntry.findMany({ where: { tournamentId, status: { in: ['REGISTERED', 'CONFIRMED'] } } }),
    prisma.tournamentMatch.findMany({ where: { tournamentId, stage: 'LEAGUE', status: 'COMPLETED' } }),
  ]);
  const table = new Map(entries.map((entry) => [entry.id, { entryId: entry.id, name: entry.teamName || entry.playerName, played: 0, won: 0, drawn: 0, lost: 0, scored: 0, conceded: 0, points: 0 }]));
  for (const match of matches) {
    const home = table.get(match.homeEntryId!);
    const away = table.get(match.awayEntryId!);
    if (!home || !away || match.homeScore === null || match.awayScore === null) continue;
    home.played++;
    away.played++;
    home.scored += match.homeScore;
    home.conceded += match.awayScore;
    away.scored += match.awayScore;
    away.conceded += match.homeScore;
    if (match.homeScore > match.awayScore) {
      home.won++;
      away.lost++;
      home.points += 3;
    } else if (match.homeScore < match.awayScore) {
      away.won++;
      home.lost++;
      away.points += 3;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
  }
  return [...table.values()]
    .map((row) => ({ ...row, difference: row.scored - row.conceded }))
    .sort((a, b) => b.points - a.points || b.difference - a.difference || b.scored - a.scored || a.name.localeCompare(b.name));
}
