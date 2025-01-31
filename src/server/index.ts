import fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

export async function setupServer() {
  const server = fastify({
    logger,
  });

  await server.register(cors, {
    origin: config.MINIAPP_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-user-id'],
  });

  try {
    const port = parseInt(config.PORT);
    await server.listen({ port });
    logger.info({ port }, 'Server started');
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }

  return server;
}