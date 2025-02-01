import fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { paramsRoutes } from './routes/params.js';

export async function setupServer() {
  const server = fastify({
    logger,
  });

  // Register CORS
  await server.register(cors, {
    origin: config.MINIAPP_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'x-telegram-init-data'],
  });

  // Register routes
  await server.register(paramsRoutes, { prefix: '/' });

  // Add error handler
  server.setErrorHandler((error, request, reply) => {
    logger.error({ error, path: request.url, method: request.method }, 'Server error');
    reply.status(500).send({
      success: false,
      message: 'Internal server error',
    });
  });

  try {
    const port = parseInt(config.PORT);
    await server.listen({ port, host: '0.0.0.0' });
    logger.info({ port }, 'Server started');
  } catch (err) {
    logger.error({ error: err }, 'Failed to start server');
    process.exit(1);
  }

  return server;
}