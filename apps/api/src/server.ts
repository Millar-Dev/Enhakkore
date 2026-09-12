import http from 'node:http';
import { createApp } from './app';
import { env } from './env';
import { prisma } from './lib/prisma';
import { attachRealtime } from './realtime/socket';
import { paymentGateway } from './services/payments';

const app = createApp();
const server = http.createServer(app);

attachRealtime(server);

server.listen(env.port, () => {
  const gateway = paymentGateway();
  console.log(`\n  ENHAKKORE API  ·  http://localhost:${env.port}/api`);
  console.log(`  environment    ·  ${env.nodeEnv}`);
  console.log(`  realtime       ·  ws://localhost:${env.port}/realtime`);
  console.log(
    `  payments       ·  ${gateway.name}${gateway.isLive ? '' : '  (simulated — no real payments are processed)'}\n`,
  );
});

async function shutdown(signal: string) {
  console.log(`\n[api] ${signal} received, shutting down.`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
