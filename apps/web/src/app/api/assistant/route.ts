import { NextResponse } from 'next/server';
import { answerLocally, answerWithClaude } from '@/lib/assistant/answer';

/**
 * The assistant endpoint.
 *
 * Runs on the website's own server rather than the API, because everything it
 * knows comes from the content files next to it — there is nothing to fetch
 * and nothing to keep in step.
 *
 * With ANTHROPIC_API_KEY set it asks Claude, grounded in those same facts. If
 * that fails for any reason — missing key, rate limit, outage — it answers
 * from the facts directly instead. The visitor always gets an answer.
 */

export const runtime = 'nodejs';

/** A crude ceiling on how much one browser can ask, per server instance. */
const seen = new Map<string, { count: number; until: number }>();
const WINDOW = 60_000;
const LIMIT = 20;

function overLimit(key: string): boolean {
  const now = Date.now();
  const entry = seen.get(key);
  if (!entry || entry.until < now) {
    seen.set(key, { count: 1, until: now + WINDOW });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT;
}

export async function POST(request: Request) {
  let body: { message?: unknown; history?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON body.' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 500) : '';
  if (!message) {
    return NextResponse.json({ error: 'Ask me something.' }, { status: 400 });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'anonymous';
  if (overLimit(ip)) {
    return NextResponse.json(
      { reply: 'That is a lot of questions at once — give me a moment and try again.', source: 'local' },
      { status: 429 },
    );
  }

  const history = Array.isArray(body.history)
    ? (body.history as unknown[])
        .filter(
          (turn): turn is { role: 'user' | 'assistant'; content: string } =>
            typeof turn === 'object' &&
            turn !== null &&
            (('role' in turn && (turn as { role: string }).role === 'user') ||
              (turn as { role: string }).role === 'assistant') &&
            typeof (turn as { content: unknown }).content === 'string',
        )
        .slice(-6)
        .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 1000) }))
    : [];

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (apiKey) {
    try {
      return NextResponse.json(await answerWithClaude(message, history, apiKey));
    } catch (error) {
      console.warn('[assistant] falling back to the offline answers:', (error as Error).message);
    }
  }

  return NextResponse.json(answerLocally(message));
}
