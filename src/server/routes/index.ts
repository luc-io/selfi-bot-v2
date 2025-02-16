import { FastifyInstance } from 'fastify';
import imagesRoutes from './images';

export async function setupRoutes(app: FastifyInstance) {
  // Health check route
  app.get('/health', async (request, reply) => {
    return { status: 'ok' };
  });

  // Register routes
  await app.register(imagesRoutes, { prefix: '/api/images' });
}