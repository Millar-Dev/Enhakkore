import Anthropic from '@anthropic-ai/sdk';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { ApiError, route } from '../lib/http';
import { prisma } from '../lib/prisma';
import { requireAuth, requireStaff } from '../middleware/auth';
import { audit } from '../services/audit';
import { ASSISTANT_MODEL, assistantConfigured, ask, runTool, toolsFor, type Mode } from '../services/assistant';

/**
 * The control centre's assistant (Bethany / Ariel). Owner only. The API key
 * lives on the server (ANTHROPIC_API_KEY); nothing about it reaches the browser.
 */
export const assistantRouter = Router();
assistantRouter.use(requireAuth, requireStaff);
assistantRouter.use((req, _res, next) => {
  // Full-platform access: the Super Administrator (owner) only.
  if (!req.auth!.permissions.includes('*')) return next(ApiError.forbidden('The assistant is available to the Super Administrator only.'));
  next();
});

const limiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { error: { code: 'rate_limited', message: 'The assistant has had many requests this hour. Try again shortly.' } } });

/** "Hey Bethany, …" → working mode; "Hello Ariel, …" → reporting mode; otherwise the tab the person chose. */
export function modeFor(prompt: string, chosen?: Mode): { mode: Mode; text: string } {
  const bethany = /^\s*(hey|hi|hello)\s+bethany[\s,.:!-]*/i;
  const ariel = /^\s*(hey|hi|hello)\s+ariel[\s,.:!-]*/i;
  if (bethany.test(prompt)) return { mode: 'BETHANY', text: prompt.replace(bethany, '').trim() || prompt };
  if (ariel.test(prompt)) return { mode: 'ARIEL', text: prompt.replace(ariel, '').trim() || prompt };
  return { mode: chosen ?? 'ARIEL', text: prompt.trim() };
}

const view = (row: { id: string; mode: string; prompt: string; reply: string; actions: string; pending: string | null; status: string; createdAt: Date }) => ({
  id: row.id,
  mode: row.mode,
  prompt: row.prompt,
  reply: row.reply,
  actions: JSON.parse(row.actions || '[]'),
  pending: row.pending ? JSON.parse(row.pending) : null,
  status: row.status,
  createdAt: row.createdAt,
});

assistantRouter.get(
  '/',
  route(async (req, res) => {
    const rows = await prisma.assistantEntry.findMany({ where: { userId: req.auth!.id }, orderBy: { createdAt: 'desc' }, take: 40 });
    res.json({
      configured: assistantConfigured(),
      model: ASSISTANT_MODEL(),
      tools: { BETHANY: toolsFor('BETHANY').map((tool) => ({ name: tool.name, sensitive: !!tool.sensitive })), ARIEL: toolsFor('ARIEL').map((tool) => ({ name: tool.name })) },
      items: rows.reverse().map(view),
    });
  }),
);

assistantRouter.post(
  '/',
  limiter,
  route(async (req, res) => {
    const input = z.object({ prompt: z.string().trim().min(2).max(4000), mode: z.enum(['BETHANY', 'ARIEL']).optional() }).parse(req.body);
    const { mode, text } = modeFor(input.prompt, input.mode);
    if (!assistantConfigured()) {
      const row = await prisma.assistantEntry.create({ data: { userId: req.auth!.id, mode, prompt: input.prompt, reply: 'The assistant is not connected yet: an Anthropic API key (ANTHROPIC_API_KEY) must be added to the API’s environment on Render. Nothing was done.', status: 'NOT_CONFIGURED' } });
      return res.status(200).json(view(row));
    }
    const history = (await prisma.assistantEntry.findMany({ where: { userId: req.auth!.id, mode, status: { in: ['DONE', 'CONFIRMED', 'AWAITING_CONFIRMATION', 'CANCELLED'] } }, orderBy: { createdAt: 'desc' }, take: 6 })).reverse();
    try {
      const result = await ask(mode, text, history.map((row) => ({ prompt: row.prompt, reply: row.reply })), { req, permissions: req.auth!.permissions });
      const row = await prisma.assistantEntry.create({
        data: { userId: req.auth!.id, mode, prompt: input.prompt, reply: result.reply, actions: JSON.stringify(result.actions), pending: result.pending ? JSON.stringify(result.pending) : null, status: result.pending ? 'AWAITING_CONFIRMATION' : 'DONE' },
      });
      res.json(view(row));
    } catch (error) {
      const message =
        error instanceof Anthropic.AuthenticationError
          ? 'The Anthropic API key on the server was rejected. Check ANTHROPIC_API_KEY on Render.'
          : error instanceof Anthropic.RateLimitError
            ? 'The AI service is busy (rate limited). Try again in a minute.'
            : error instanceof Anthropic.APIError
              ? `The AI service returned an error (${error.status ?? 'unknown'}). Nothing was changed.`
              : 'The assistant could not finish. Nothing was changed.';
      const row = await prisma.assistantEntry.create({ data: { userId: req.auth!.id, mode, prompt: input.prompt, reply: message, status: 'FAILED' } });
      res.status(200).json(view(row));
    }
  }),
);

/** The owner confirms (or cancels) a sensitive action Bethany proposed. */
assistantRouter.post(
  '/:id/confirm',
  route(async (req, res) => {
    const { confirm } = z.object({ confirm: z.boolean() }).parse(req.body);
    const row = await prisma.assistantEntry.findFirst({ where: { id: req.params.id, userId: req.auth!.id } });
    if (!row || row.status !== 'AWAITING_CONFIRMATION' || !row.pending) throw ApiError.notFound('Nothing is waiting for confirmation.');
    const pending = JSON.parse(row.pending) as { tool: string; input: Record<string, unknown>; summary: string };
    const actions = JSON.parse(row.actions || '[]');
    if (!confirm) {
      const updated = await prisma.assistantEntry.update({ where: { id: row.id }, data: { status: 'CANCELLED', reply: `${row.reply}\n\nCancelled — nothing was changed.` } });
      return res.json(view(updated));
    }
    const outcome = await runTool(row.mode as Mode, pending.tool, pending.input, { req, permissions: req.auth!.permissions }, true);
    actions.push({ tool: pending.tool, input: pending.input, ok: outcome.ok, result: outcome.result, error: outcome.error, confirmed: true });
    const updated = await prisma.assistantEntry.update({
      where: { id: row.id },
      data: { status: outcome.ok ? 'CONFIRMED' : 'FAILED', actions: JSON.stringify(actions), reply: `${row.reply}\n\n${outcome.ok ? `Done: ${pending.summary}.` : `Not done: ${outcome.error}`}` },
    });
    await audit(req, { action: 'update', entityType: 'assistant', entityId: row.id, summary: `${outcome.ok ? 'Confirmed' : 'Failed'} assistant action: ${pending.summary}` });
    res.json(view(updated));
  }),
);
