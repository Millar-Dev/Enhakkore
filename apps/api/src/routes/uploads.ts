import fs from 'node:fs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../env';
import { ApiError, route } from '../lib/http';
import { requireAuth } from '../middleware/auth';
import {
  UPLOAD_RULES,
  assertAllowed,
  assetBelongsTo,
  assetIdFor,
  baseUrlOf,
  fileStorage,
  type UploadKind,
} from '../services/storage';
import { acceptLocalUpload, openLocalPrivateToken } from '../services/storage/local';

export const uploadsRouter = Router();

/**
 * Asking for an upload slot is cheap for us and expensive to abuse, so it is
 * limited per account rather than left open.
 */
const ticketLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: env.isProduction ? 60 : 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many uploads just now. Try again shortly.' } },
});

const ticketSchema = z.object({
  kind: z.enum(['TRIP_IMAGE', 'AVATAR', 'VERIFICATION_DOCUMENT']),
  contentType: z.string().trim().min(3).max(100),
  bytes: z.number().int().nonnegative(),
});

/**
 * Issues permission to upload one file.
 *
 * The reply names the exact id the file must be stored under, which contains
 * the account's own id. Nothing about that id is taken from the browser, so an
 * upload cannot be aimed at another account's folder.
 */
uploadsRouter.post(
  '/ticket',
  requireAuth,
  ticketLimiter,
  route(async (req, res) => {
    const input = ticketSchema.parse(req.body);
    const kind = input.kind as UploadKind;

    // Only an operator submits business documents.
    if (kind === 'VERIFICATION_DOCUMENT' && !req.auth!.organizerId) {
      throw ApiError.forbidden('Only a tour operator account can upload verification documents.');
    }

    assertAllowed(kind, input.contentType, input.bytes);

    const storage = fileStorage();
    const ticket = storage.ticket(kind, assetIdFor(kind, req.auth!.id), baseUrlOf(req));
    res.json({ ...ticket, durable: storage.isDurable });
  }),
);

const confirmSchema = z.object({
  kind: z.enum(['TRIP_IMAGE', 'AVATAR', 'VERIFICATION_DOCUMENT']),
  assetId: z.string().trim().min(8).max(200),
  version: z.string().trim().max(40),
  signature: z.string().trim().max(200),
  format: z.string().trim().max(10).optional(),
  bytes: z.number().int().nonnegative().optional(),
});

/**
 * Confirms an upload and returns its address.
 *
 * The browser never decides a file's URL: it reports what the provider said,
 * the provider's signature is checked here, and the address comes back from
 * this side. A public image is returned already sized and in a modern format,
 * so a phone photo does not reach visitors at its original weight.
 */
uploadsRouter.post(
  '/confirm',
  requireAuth,
  route(async (req, res) => {
    const input = confirmSchema.parse(req.body);
    const kind = input.kind as UploadKind;
    if (!assetBelongsTo(input.assetId, req.auth!.id, kind)) {
      throw ApiError.forbidden('That file belongs to another account.');
    }
    res.json(await fileStorage().verify(kind, input, baseUrlOf(req)));
  }),
);

/* ------------------------- Local adapter only ----------------------------- */

const receive = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(...Object.values(UPLOAD_RULES).map((rule) => rule.maxBytes)), files: 1 },
});

/**
 * Receives a file while no Cloudinary account is configured. With credentials
 * set the browser uploads straight to Cloudinary and never reaches this.
 */
uploadsRouter.post(
  '/local',
  receive.single('file'),
  route(async (req, res) => {
    if (env.storage.provider !== 'local') {
      throw ApiError.notFound();
    }
    const file = req.file;
    const ticket = typeof req.body?.ticket === 'string' ? req.body.ticket : '';
    if (!file || !ticket) {
      throw ApiError.unprocessable('A file and an upload ticket are both required.', 'upload_incomplete');
    }

    const stored = acceptLocalUpload(ticket, { bytes: file.buffer, contentType: file.mimetype });
    // Deliberately the same field names Cloudinary replies with, so the
    // website's upload code does not branch on which adapter is in use.
    res.status(201).json({
      public_id: stored.assetId,
      version: stored.version,
      signature: stored.signature,
      format: stored.format,
      bytes: stored.bytes,
    });
  }),
);

/**
 * Serves one private file against a short-lived link. The link is issued only
 * after a route has checked who is asking; holding it is the permission, and
 * it stops working within minutes.
 */
uploadsRouter.get(
  '/file/:token',
  route(async (req, res) => {
    if (env.storage.provider !== 'local') {
      throw ApiError.notFound();
    }
    const { file, format } = openLocalPrivateToken(req.params.token!);
    if (!fs.existsSync(file)) {
      throw ApiError.notFound('That file is no longer available.');
    }
    res.type(format === 'pdf' ? 'application/pdf' : `image/${format}`);
    // Never let a browser or proxy keep a copy of someone's business papers.
    res.setHeader('Cache-Control', 'no-store, private');
    fs.createReadStream(file).pipe(res);
  }),
);
