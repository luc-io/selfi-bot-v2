import fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { paramsRoutes } from './routes/params.js';

export async function setupServer() {
  const server = fastify({
    logger,
  });

  await server.register(cors, {
    origin: config.MINIAPP_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-user-id'],
  });

  // Register routes
  await server.register(paramsRoutes);

  try {
    const port = parseInt(config.PORT);
    await server.listen({ port, host: '0.0.0.0' });
    logger.info({ port }, 'Server started');
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }

  return server;
}
