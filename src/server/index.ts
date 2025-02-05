import { FastifyInstance } from 'fastify';
import { Bot } from 'grammy';
import { BotContext } from '../types/bot.js';
import cors from '@fastify/cors';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import training from './routes/training.js';

export async function setupServer(server: FastifyInstance, bot: Bot<BotContext>) {
  // Configure server
  server.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    try {
      const json = JSON.parse(body.toString());
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

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
  server.post('/bot', async (request, reply) => {
    try {
      const update = request.body;
      logger.debug({ update }, 'Received Telegram update');

      await bot.handleUpdate(update);
      logger.debug('Update handled successfully');

      reply.send({ ok: true });
    } catch (error) {
      logger.error({ 
        error, 
        body: request.body,
        headers: request.headers
      }, 'Error handling bot update');
      
      reply.code(500).send({ error: 'Failed to handle bot update' });
    }
  });

  // Health check endpoint
  server.get('/bot/health', async (_, reply) => {
    try {
      // Get webhook info
      const webhookInfo = await bot.api.getWebhookInfo();
      
      reply.send({
        ok: true,
        webhook: webhookInfo,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error({ error }, 'Health check failed');
      reply.code(500).send({ 
        ok: false,
        error: 'Health check failed' 
      });
    }
  });

  // Ping endpoint
  server.get('/ping', async (_, reply) => {
    const prisma = (await import('../lib/prisma.js')).prisma;
    try {
      await prisma.$queryRaw`SELECT 1`;
      reply.send({ ok: true, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error({ error }, 'Database ping failed');
      reply.code(500).send({ ok: false, error: 'Database ping failed' });
    }
  });

  // Error handler
  server.setErrorHandler((error, request, reply) => {
    logger.error({ 
      error,
      method: request.method,
      url: request.url,
      body: request.body
    }, 'Server error occurred');

    reply.status(500).send({ error: 'Internal server error' });
  });
}
