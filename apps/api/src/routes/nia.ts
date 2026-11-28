import Anthropic from '@anthropic-ai/sdk';
import { Router } from 'express';
import { z } from 'zod';
import { ApiError, route } from '../lib/http';
import { writeJsonSetting } from '../lib/json';
import { prisma } from '../lib/prisma';
import { assertPermission, requireAuth } from '../middleware/auth';
import { audit } from '../services/audit';
import { NIA_CATEGORIES, NIA_DEFAULTS, askNia, niaAiConnected, niaSettings } from '../services/nia';

/**
 * Nia for members (history, usage limits) and her settings for the team.
 * History can be renamed, reopened, deleted one by one, cleared, or switched
 * off entirely — then nothing is stored (only a daily usage count).
 */
export const niaRouter = Router();
export const niaAdmin = Router();

const today = () => new Date().toISOString().slice(0, 10);

niaRouter.get(
  '/config',
  route(async (req, res) => {
    const settings = await niaSettings();
    const me = req.auth ? await prisma.user.findUnique({ where: { id: req.auth.id }, select: { niaHistory: true } }) : null;
    const used = req.auth ? (await prisma.niaUsage.findUnique({ where: { userId_day: { userId: req.auth.id, day: today() } } }))?.count ?? 0 : 0;
    res.json({
      enabled: settings.enabled,
      text: settings.text,
      voice: settings.voice,
      aiConnected: niaAiConnected(),
      categories: settings.categories.map((key) => ({ key, label: NIA_CATEGORIES[key] ?? key })),
      history: me?.niaHistory ?? true,
      dailyLimit: settings.dailyLimit,
      usedToday: used,
    });
  }),
);

niaRouter.use(requireAuth);

niaRouter.get(
  '/conversations',
  route(async (req, res) => {
    const rows = await prisma.niaConversation.findMany({ where: { userId: req.auth!.id }, orderBy: { updatedAt: 'desc' }, take: 100 });
    res.json({ items: rows.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updatedAt })) });
  }),
);

niaRouter.get(
  '/conversations/:id',
  route(async (req, res) => {
    const row = await prisma.niaConversation.findFirst({ where: { id: req.params.id, userId: req.auth!.id }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    if (!row) throw ApiError.notFound('That conversation does not exist.');
    res.json({ id: row.id, title: row.title, messages: row.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, results: JSON.parse(m.results || '[]'), createdAt: m.createdAt })) });
  }),
);

niaRouter.patch(
  '/conversations/:id',
  route(async (req, res) => {
    const { title } = z.object({ title: z.string().trim().min(1).max(80) }).parse(req.body);
    const updated = await prisma.niaConversation.updateMany({ where: { id: req.params.id, userId: req.auth!.id }, data: { title } });
    if (updated.count === 0) throw ApiError.notFound();
    res.json({ ok: true });
  }),
);

niaRouter.delete(
  '/conversations/:id',
  route(async (req, res) => {
    await prisma.niaConversation.deleteMany({ where: { id: req.params.id, userId: req.auth!.id } });
    res.json({ ok: true });
  }),
);

niaRouter.delete(
  '/conversations',
  route(async (req, res) => {
    const removed = await prisma.niaConversation.deleteMany({ where: { userId: req.auth!.id } });
    res.json({ ok: true, removed: removed.count });
  }),
);

/** Turn history saving on or off. Off also offers to delete what is stored. */
niaRouter.put(
  '/history',
  route(async (req, res) => {
    const input = z.object({ enabled: z.boolean(), deleteExisting: z.boolean().default(false) }).parse(req.body);
    await prisma.user.update({ where: { id: req.auth!.id }, data: { niaHistory: input.enabled } });
    if (!input.enabled && input.deleteExisting) await prisma.niaConversation.deleteMany({ where: { userId: req.auth!.id } });
    res.json({ ok: true, history: input.enabled });
  }),
);

niaRouter.post(
  '/ask',
  route(async (req, res) => {
    const input = z.object({ message: z.string().trim().min(1, 'Ask Nia something.').max(1000), conversationId: z.string().min(5).nullable().optional() }).parse(req.body);
    const settings = await niaSettings();
    if (!settings.enabled || !settings.text) throw new ApiError(503, 'Nia is switched off at the moment.', 'nia_disabled');
    // Usage limit: counted atomically per member per day, whether or not history is kept.
    const usage = await prisma.niaUsage.upsert({ where: { userId_day: { userId: req.auth!.id, day: today() } }, create: { userId: req.auth!.id, day: today(), count: 1 }, update: { count: { increment: 1 } } });
    if (usage.count > settings.dailyLimit) throw new ApiError(429, `You have reached today’s limit of ${settings.dailyLimit} questions to Nia. Try again tomorrow.`, 'nia_limit');
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.id }, select: { niaHistory: true } });

    let conversation = input.conversationId && me.niaHistory ? await prisma.niaConversation.findFirst({ where: { id: input.conversationId, userId: req.auth!.id } }) : null;
    const history = conversation ? await prisma.niaMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'asc' }, take: 20 }) : [];
    let answer: Awaited<ReturnType<typeof askNia>>;
    try {
      answer = await askNia(input.message, history, settings);
    } catch (error) {
      // Never pretend: say the service failed. Typed SDK errors carry the HTTP status.
      const status = error instanceof Anthropic.APIError ? error.status : null;
      console.error('[nia]', status, error instanceof Error ? error.message : error);
      throw new ApiError(502, status === 429 ? 'Nia is very busy right now. Try again in a minute.' : 'Nia could not answer just now. Please try again.', 'nia_failed');
    }
    if (me.niaHistory) {
      if (!conversation) conversation = await prisma.niaConversation.create({ data: { userId: req.auth!.id, title: input.message.slice(0, 60) } });
      await prisma.niaMessage.createMany({
        data: [
          { conversationId: conversation.id, role: 'USER', content: input.message },
          { conversationId: conversation.id, role: 'NIA', content: answer.reply, results: JSON.stringify(answer.results) },
        ],
      });
      await prisma.niaConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    }
    res.json({ conversationId: conversation?.id ?? null, reply: answer.reply, results: answer.results, guide: answer.guide, ai: answer.ai, usedToday: usage.count, dailyLimit: settings.dailyLimit });
  }),
);

/* ---------------------------------- Admin ---------------------------------- */

niaAdmin.get(
  '/nia',
  route(async (req, res) => {
    assertPermission(req, 'nia.view');
    const settings = await niaSettings();
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const usage = await prisma.niaUsage.findMany({ where: { day: { gte: since } } });
    const byDay = new Map<string, { questions: number; members: number }>();
    for (const row of usage) {
      const day = byDay.get(row.day) ?? { questions: 0, members: 0 };
      day.questions += row.count;
      day.members += 1;
      byDay.set(row.day, day);
    }
    // Privacy-safe: counts only — no member names and no question text.
    const results = await prisma.niaMessage.findMany({ where: { role: 'NIA', createdAt: { gte: new Date(since) } }, select: { results: true }, take: 5000 });
    const shown: Record<string, number> = {};
    for (const row of results) for (const item of JSON.parse(row.results || '[]') as { type: string }[]) shown[item.type] = (shown[item.type] ?? 0) + 1;
    res.json({
      settings,
      categories: Object.entries(NIA_CATEGORIES).map(([key, label]) => ({ key, label })),
      aiConnected: niaAiConnected(),
      analytics: {
        days: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ day, ...value })),
        totalQuestions: usage.reduce((sum, row) => sum + row.count, 0),
        resultsShownByType: shown,
        note: 'Counts only. Questions are not shown to the team; members who switch history off store nothing but a daily count.',
      },
    });
  }),
);

niaAdmin.put(
  '/nia',
  route(async (req, res) => {
    assertPermission(req, 'nia.edit');
    const input = z
      .object({
        enabled: z.boolean(),
        text: z.boolean(),
        voice: z.boolean(),
        dailyLimit: z.number().int().min(1).max(1000),
        categories: z.array(z.enum(Object.keys(NIA_CATEGORIES) as [string, ...string[]])).min(1),
      })
      .parse(req.body);
    const before = await niaSettings();
    await writeJsonSetting('nia', { ...NIA_DEFAULTS, ...input });
    await audit(req, { action: 'update', entityType: 'settings', entityId: 'nia', summary: 'Changed Nia AI settings', before, after: input });
    res.json({ ok: true });
  }),
);
