import fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from '../config';
import { logger } from '../lib/logger';

// Create server
const server = fastify({
  logger,
});

// Setup CORS
await server.register(cors, {
  origin: config.MINIAPP_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-user-id'],
});

// Start server
try {
  const port = parseInt(config.PORT);
  await server.listen({ port });
  logger.info({ port }, 'Server started');
} catch (err) {
  logger.error(err);
  process.exit(1);
}

export default server;