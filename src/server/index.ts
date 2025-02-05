import { Bot } from 'grammy';
import { Update } from '@grammyjs/types';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../lib/logger.js';
import { BotContext } from '../types/bot.js';

export function setupServer(server: FastifyInstance, bot: Bot<BotContext>) {
  // Webhook endpoint - now matches the URL in setupWebhook
  server.post<{
    Body: Update
  }>('/bot', async (request: FastifyRequest<{
    Body: Update
  }>, reply: FastifyReply) => {
    try {
      await bot.handleUpdate(request.body);
      return reply.status(200).send();
    } catch (error) {
      logger.error('Error handling update:', error);
      return reply.status(500).send();
    }
  });

  // Health check endpoint
  server.get('/ping', async (request, reply) => {
    return reply.status(200).send({ status: 'ok' });
  });

  return server;
}