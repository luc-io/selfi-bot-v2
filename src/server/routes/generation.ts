import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { GenerationService } from '../../services/generation';
import { GenerationBody, GenerationQuery } from '../../types/interfaces';
import { logger } from '../../lib/logger';

const prisma = new PrismaClient();

export default async function generationRoutes(server: FastifyInstance) {
  server.post('/generate', {
    schema: {
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt: { type: 'string' },
          negativePrompt: { type: 'string' },
          loraId: { type: 'string' },
          seed: { type: 'number' },
        },
      },
    },
  }, async (request, reply) => {
    const { prompt, negativePrompt, loraId, seed } = request.body as GenerationBody;

    try {
      let lora = null;
      if (loraId) {
        lora = await prisma.loraModel.findUnique({
          where: { id: loraId },
          include: {
            baseModel: true,
          }
        });

        if (!lora) {
          return reply.status(404).send({ error: 'LoRA model not found' });
        }
      }

      const result = await GenerationService.generate(request.user.id, {
        prompt,
        negativePrompt,
        loraPath: lora?.weightsUrl ?? undefined,
        seed,
      });

      return reply.send(result);
    } catch (error) {
      logger.error({ error }, 'Generation failed');
      return reply.status(500).send({ error: 'Generation failed' });
    }
  });

  server.get('/generations', async (request, reply) => {
    const { limit = 10, offset = 0 } = request.query as GenerationQuery;

    try {
      const generations = await GenerationService.listUserGenerations(
        request.user.id,
        limit,
        offset
      );

      return reply.send(generations);
    } catch (error) {
      logger.error({ error }, 'Failed to list generations');
      return reply.status(500).send({ error: 'Failed to list generations' });
    }
  });
}