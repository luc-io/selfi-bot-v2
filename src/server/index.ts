import { Bot, webhookCallback } from 'grammy';
import { FastifyInstance } from 'fastify';
import { BotContext } from '../types/bot.js';
import { setupRoutes } from './routes/index.js';

export function setupServer(app: FastifyInstance, bot: Bot<BotContext>) {
  // Register routes
  setupRoutes(app);

  // Register bot webhook handler
  app.post('/bot', webhookCallback(bot, 'fastify'));
}