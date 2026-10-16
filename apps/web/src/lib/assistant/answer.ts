import { buildKnowledge, knowledgeAsBrief, type Topic } from './knowledge';
import { CONTACT } from '@/content/contact';

/**
 * Answering a visitor's question.
 *
 * Two adapters, the same shape as payments, email and storage elsewhere in
 * this project:
 *
 * - `local` (the default): matches the question against the facts published on
 *   the site and returns the closest one. No API key, no network call, no
 *   running cost, and it cannot invent anything, because every word it can say
 *   was written by you.
 * - `claude`: with ANTHROPIC_API_KEY set, the same facts are handed to Claude
 *   as the only source it may use, which answers in better English and handles
 *   questions phrased in ways no keyword list anticipated.
 *
 * Neither will guess a price, a date or a policy. Where the answer is not in
 * the brief, both say so and give a phone number — a visitor who is told "ask
 * us" is helped; one who is told a departure time we never set is not.
 */

export interface Answer {
  reply: string;
  /** A page the visitor should probably open next. */
  href?: string;
  /** Which adapter produced this, surfaced for transparency. */
  source: 'local' | 'claude';
}

const STOP = new Set([
  'the', 'a', 'an', 'is', 'are', 'do', 'does', 'i', 'you', 'we', 'to', 'for', 'of', 'in', 'on', 'at',
  'and', 'or', 'it', 'can', 'what', 'how', 'me', 'my', 'your', 'please', 'tell', 'about', 'there',
  'this', 'that', 'be', 'with', 'from', 'will', 'would', 'have', 'has',
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

/** Scores a topic against the question: cue hits, with phrases worth more. */
function score(topic: Topic, question: string, asked: string[]): number {
  const lower = question.toLowerCase();
  let total = 0;
  for (const cue of topic.cues) {
    if (cue.includes(' ')) {
      if (lower.includes(cue)) total += 3;
    } else if (asked.includes(cue)) {
      // A precise word — "refund", "mpesa" — is on its own enough to choose a
      // topic. Requiring two meant distinctive questions fell to the fallback.
      total += 3;
    } else if (asked.some((w) => w.startsWith(cue) || cue.startsWith(w))) {
      total += 1;
    }
  }
  return total;
}

function fallback(): Answer {
  const phones = CONTACT.phones.map((p) => p.display).join(' or ');
  return {
    reply: `I do not have that one, and I would rather say so than guess. Call or message us on ${phones} and someone will answer it properly.`,
    href: '/contact',
    source: 'local',
  };
}

/** The offline adapter. */
export function answerLocally(question: string): Answer {
  const asked = words(question);
  if (asked.length === 0) return fallback();

  const ranked = buildKnowledge()
    .map((topic) => ({ topic, value: score(topic, question, asked) }))
    .sort((a, b) => b.value - a.value);

  const best = ranked[0];
  // Below this, the match is one stray word and the answer would be a
  // non-sequitur, which reads worse than an honest "I don't know".
  if (!best || best.value < 3) return fallback();

  return { reply: best.topic.answer, href: best.topic.href, source: 'local' };
}

const SYSTEM = `You answer questions on the Enhakkore Travel & Impact website.

These are the ONLY facts you may use:

%BRIEF%

Rules, in order of importance:
1. Never state a price, date, inclusion, payment detail or policy that is not in the facts above. If it is not there, say you do not have it and give the phone numbers.
2. Never imply a booking is confirmed, a place is reserved or a payment has been received. Bookings are confirmed by a person after checking the payment.
3. Keep it short — two or three sentences. You are a chat bubble, not a brochure.
4. Write plainly, in British English, warmly but without sales language or exclamation marks.
5. If asked something unrelated to Enhakkore, say that is not something you can help with and offer the contact details.`;

/** The Claude adapter, used when a key is configured. */
export async function answerWithClaude(
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  apiKey: string,
): Promise<Answer> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5-5',
      max_tokens: 400,
      system: SYSTEM.replace('%BRIEF%', knowledgeAsBrief()),
      messages: [...history.slice(-6), { role: 'user', content: question }],
    }),
  });

  if (!response.ok) {
    // A failed key, a rate limit or an outage must not take the assistant
    // down with it — the offline adapter still answers.
    throw new Error(`Anthropic API returned ${response.status}`);
  }

  const body = (await response.json()) as { content?: { type: string; text?: string }[] };
  const reply = (body.content ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('')
    .trim();

  if (!reply) throw new Error('Empty reply from the model');

  // Point at the page the matching topic belongs to, when there is one.
  const local = answerLocally(question);
  return { reply, href: local.href, source: 'claude' };
}
