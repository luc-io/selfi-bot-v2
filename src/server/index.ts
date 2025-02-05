import { FastifyInstance } from 'fastify';
import { Bot } from 'grammy';
import { BotContext } from '../types/bot.js';
import cors from '@fastify/cors';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import training from './routes/training.js';

export async function setupServer(server: FastifyInstance, bot: Bot<BotContext>) {
  // Register plugins
  await server.register(cors, {
    origin: config.ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type'],
    exposedHeaders: [],
    credentials: true
  });

  // Register routes
  await server.register(training);

  // Bot webhook endpoint
  server.post('/bot', {
    config: {
      rawBody: true
    },
    handler: async (request, reply) => {
      try {
        await bot.handleUpdate(request.body as any);
        reply.send({ ok: true });
      } catch (error) {
        logger.error({ error }, 'Error handling bot update');
        reply.code(500).send({ error: 'Failed to handle bot update' });
      }
    }
  });

  // Error handler
  server.setErrorHandler((error, request, reply) => {
    logger.error({ error }, 'Server error occurred');
    reply.status(500).send({ error: 'Internal server error' });
  });
}