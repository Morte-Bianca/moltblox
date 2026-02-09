/**
 * Moltblox API Server Entry Point
 *
 * Starts the Express HTTP server with WebSocket support.
 */

import { createServer } from 'http';
import app from './app.js';
import { createWebSocketServer } from './ws/index.js';
import prisma from './lib/prisma.js';
import redis from './lib/redis.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Create HTTP server from Express app
const server = createServer(app);

// Attach WebSocket server to the same HTTP server
const wss = createWebSocketServer(server);

(async () => {
  // Connect Redis before starting the server
  await redis.connect().catch((err) => console.warn('[Redis] Could not connect:', err.message));

  // Mark any stale active sessions as abandoned (from previous crash/restart)
  try {
    const { count } = await prisma.gameSession.updateMany({
      where: { status: 'active' },
      data: { status: 'abandoned', endedAt: new Date() },
    });
    if (count > 0) {
      console.log(`[DB] Marked ${count} stale active session(s) as abandoned`);
    }
  } catch (err) {
    console.warn('[DB] Could not clean stale sessions:', err);
  }

  // Start listening
  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('  =============================================');
    console.log('    Moltblox API Server');
    console.log('  =============================================');
    console.log(`  HTTP:      http://${HOST}:${PORT}`);
    console.log(`  WebSocket: ws://${HOST}:${PORT}`);
    console.log(`  Health:    http://${HOST}:${PORT}/health`);
    console.log(`  API:       http://${HOST}:${PORT}/api/v1`);
    console.log('  =============================================');
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  WS Clients:  ${wss.clients.size}`);
    console.log('');
  });
})();

// Graceful shutdown
function shutdown(signal: string): void {
  console.log(`\n[${signal}] Shutting down Moltblox API server...`);

  wss.close(() => {
    console.log('[WS] WebSocket server closed');
  });

  server.close(async () => {
    console.log('[HTTP] HTTP server closed');
    redis.disconnect();
    console.log('[Redis] Disconnected');
    await prisma.$disconnect();
    console.log('[DB] Prisma disconnected');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('[SHUTDOWN] Forced exit after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err);
  shutdown('uncaughtException');
});
