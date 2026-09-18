import type { Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { MessageDto } from '@enhakkore/shared';
import { env } from '../env';
import { prisma } from '../lib/prisma';
import { isTokenStale } from '../middleware/auth';

let io: SocketServer | null = null;

/**
 * Realtime layer for trip group chat.
 *
 * Sockets carry the same bearer token as the REST API and are authorised the
 * same way: a client can only join a room for a conversation it is already a
 * member of. The REST endpoint remains the source of truth — sockets only push
 * messages that were already persisted, so a dropped connection loses nothing.
 */
export function attachRealtime(server: HttpServer) {
  io = new SocketServer(server, {
    cors: { origin: env.corsOrigins, credentials: true },
    path: '/realtime',
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('unauthorized'));

    try {
      const payload = jwt.verify(token, env.jwtSecret) as { sub: string; iat?: number };
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, status: true, role: true, passwordChangedAt: true },
      });
      if (!user || user.status !== 'ACTIVE') return next(new Error('unauthorized'));
      // Same rule as the REST API: a session from before the last password
      // change cannot open a realtime connection either.
      if (isTokenStale(payload.iat, user.passwordChangedAt)) return next(new Error('unauthorized'));
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;

    socket.on('conversation:join', async (conversationId: string) => {
      const membership = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId, userId } },
      });
      if (!membership) {
        socket.emit('conversation:error', { conversationId, message: 'You are not in this trip group.' });
        return;
      }
      socket.join(room(conversationId));
      socket.emit('conversation:joined', { conversationId });
    });

    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(room(conversationId));
    });

    socket.on('conversation:typing', (conversationId: string) => {
      if (!socket.rooms.has(room(conversationId))) return;
      socket.to(room(conversationId)).emit('conversation:typing', { conversationId, userId });
    });
  });

  return io;
}

/** Pushes an already-persisted message to everyone in the group. */
export function broadcastMessage(conversationId: string, message: MessageDto) {
  io?.to(room(conversationId)).emit('message:new', { conversationId, message });
}

function room(conversationId: string): string {
  return `conversation:${conversationId}`;
}
