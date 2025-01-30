import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import { config } from '../config';
import { logger } from '../lib/logger';
import generationRoutes from './routes/generation';

// Create fastify instance
const server = Fastify({
  logger,
});

// Register plugins
server.register(fastifyCors, {
  origin: config.NODE_ENV === 'development' ? true : 'https://selfi-dev.blackiris.art',
  credentials: true
});

// Add auth hook
server.addHook('preHandler', async (request, reply) => {
  const userId = request.headers['x-user-id'];

  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  request.user = { id: userId.toString() };
});

// Register routes
server.register(generationRoutes);

// Error handler
server.setErrorHandler((error, request, reply) => {
  logger.error({ error, request }, 'Request error');
  reply.status(500).send({ error: 'Internal server error' });
});

export async function setupServer() {
  try {
    await server.listen({
      port: config.PORT,
      host: '127.0.0.1'
    });
    logger.info({ port: config.PORT }, 'Server started');
  } catch (err) {
    logger.error({ error: err }, 'Failed to start server');
    process.exit(1);
  }
}