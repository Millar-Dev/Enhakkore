import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

export { prisma };

/** Password shared by every demonstration account in the seed. */
export const DEMO_PASSWORD = 'Enhakkore2026!';

export const ACCOUNTS = {
  admin: 'admin@enhakkore.com',
  organizer: 'trips@tanzuexpeditions.demo', // verified, runs Mikumi Adventure
  otherOrganizer: 'hello@serengeticollective.demo',
  pendingOrganizer: 'team@baharinomad.demo', // owns the draft Tanga trip
  michael: 'michael@traveller.demo', // member of the Mikumi trip group
  grace: 'grace@traveller.demo', // not in the Mikumi group
};

export interface Api {
  base: string;
  request<T = any>(
    method: string,
    path: string,
    options?: { body?: unknown; token?: string | null },
  ): Promise<{ status: number; body: T }>;
  login(email: string, password?: string): Promise<string>;
  register(prefix: string): Promise<{ token: string; email: string; id: string }>;
  close(): Promise<void>;
}

/**
 * Starts the real Express app on a random local port. Tests talk to it over
 * HTTP, exactly as the website does, so routing, middleware, validation and
 * permissions are all exercised — not just the functions underneath.
 */
export async function startApi(): Promise<Api> {
  const server = http.createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}/api`;
  const tokens = new Map<string, string>();
  let counter = 0;

  async function request<T = any>(
    method: string,
    path: string,
    { body, token }: { body?: unknown; token?: string | null } = {},
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
  }

  return {
    base,
    request,
    async login(email, password = DEMO_PASSWORD) {
      const key = `${email}:${password}`;
      const cached = tokens.get(key);
      if (cached) return cached;
      const result = await request<{ token: string }>('POST', '/auth/login', { body: { email, password } });
      if (result.status !== 200) throw new Error(`login failed for ${email}: ${result.status}`);
      tokens.set(key, result.body.token);
      return result.body.token;
    },
    async register(prefix) {
      counter += 1;
      const email = `${prefix}-${Date.now()}-${counter}@test.local`;
      const result = await request<{ token: string; user: { id: string } }>('POST', '/auth/register', {
        body: { name: `Test ${prefix}`, email, password: 'TestPass-123', accountType: 'TRAVELER' },
      });
      if (result.status !== 201) throw new Error(`register failed: ${result.status} ${JSON.stringify(result.body)}`);
      return { token: result.body.token, email, id: result.body.user.id };
    },
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/** An upcoming, bookable departure of a published trip, with seats to spare. */
export async function openDeparture(slug: string, minSeats = 2) {
  const departure = await prisma.tripDate.findFirst({
    where: {
      trip: { slug, status: 'PUBLISHED' },
      startDate: { gt: new Date() },
      status: { in: ['OPEN', 'ALMOST_FULL'] },
    },
    orderBy: { startDate: 'asc' },
    include: { trip: true },
  });
  if (!departure) throw new Error(`no open departure for ${slug}`);
  // Make room if earlier tests filled it.
  if (departure.capacity - departure.seatsBooked < minSeats) {
    await prisma.tripDate.update({
      where: { id: departure.id },
      data: { seatsBooked: departure.capacity - minSeats, status: 'OPEN' },
    });
  }
  return prisma.tripDate.findUniqueOrThrow({ where: { id: departure.id }, include: { trip: true } });
}

export async function waitFor<T>(check: () => T | undefined, timeoutMs = 3000): Promise<T> {
  const started = Date.now();
  for (;;) {
    const value = check();
    if (value !== undefined) return value;
    if (Date.now() - started > timeoutMs) throw new Error('timed out waiting');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
