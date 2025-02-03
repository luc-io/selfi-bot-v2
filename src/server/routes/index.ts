import { FastifyInstance } from 'fastify';

export function setupRoutes(app: FastifyInstance) {
  // Health check route
  app.get('/health', async (request, reply) => {
    return { status: 'ok' };
  });

  // Add other routes here
}