import { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { validateTelegramWebAppData } from '../../lib/telegram.js';
import { LoraStatus } from '@prisma/client';

export async function loraRoutes(app: FastifyInstance) {
  // Get available (public) LoRAs
  app.get('/loras/available', {
    schema: {
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              databaseId: { type: 'string' },
              name: { type: 'string' },
              triggerWord: { type: 'string' },
              status: { type: 'string' },
              isPublic: { type: 'boolean' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const loras = await prisma.loraModel.findMany({
        where: {
          status: 'COMPLETED',
          isPublic: true
        },
        select: {
          databaseId: true,
          name: true,
          triggerWord: true,
          weightsUrl: true,
          status: true,
          isPublic: true
        },
        orderBy: {
          name: 'asc'
        }
      });
      
      logger.info({ count: loras.length }, 'Fetched available LoRAs');
      return loras;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch available LoRAs');
      reply.status(500).send({ error: 'Failed to fetch available LoRAs' });
    }
  });

  // Get user's LoRAs
  app.get('/loras/user', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-telegram-user-id'],
        properties: {
          'x-telegram-user-id': { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const telegramId = request.headers['x-telegram-user-id'] as string;

      if (!telegramId) {
        logger.warn('Missing user ID in request');
        return reply.status(400).send({ error: 'Missing user ID' });
      }

      const user = await prisma.user.findUnique({
        where: { telegramId },
        select: { databaseId: true }
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const loras = await prisma.loraModel.findMany({
        where: {
          OR: [
            { isPublic: true },
            { userDatabaseId: user.databaseId }
          ]
        },
        include: {
          training: {
            select: {
              steps: true,
              metadata: true,
              is_style: true,
              create_masks: true,
              trigger_word: true,
              imageUrls: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      logger.info({
        userDatabaseId: user.databaseId,
        count: loras.length
      }, 'Fetched user LoRAs');

      return loras;
    } catch (error) {
      logger.error({ error }, 'Failed to fetch user LoRAs');
      reply.status(500).send({ error: 'Failed to fetch user LoRAs' });
    }
  });

  // Toggle LoRA public status
  app.post('/loras/:id/toggle-public', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-telegram-user-id'],
        properties: {
          'x-telegram-user-id': { type: 'string' }
        }
      },
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['isPublic'],
        properties: {
          isPublic: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { isPublic } = request.body as { isPublic: boolean };
      const telegramId = request.headers['x-telegram-user-id'] as string;

      if (!telegramId) {
        return reply.status(400).send({ error: 'Missing user ID' });
      }

      const user = await prisma.user.findUnique({
        where: { telegramId },
        select: { databaseId: true }
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Find the lora and verify ownership
      const lora = await prisma.loraModel.findFirst({
        where: {
          databaseId: id,
          userDatabaseId: user.databaseId
        }
      });

      if (!lora) {
        return reply.status(404).send({ error: 'LoRA not found or not owned by user' });
      }

      const updatedLora = await prisma.loraModel.update({
        where: { databaseId: id },
        data: { isPublic }
      });

      logger.info({
        loraId: id,
        isPublic
      }, 'LoRA public status updated');

      return updatedLora;
    } catch (error) {
      logger.error({ error }, 'Failed to toggle LoRA public status');
      reply.status(500).send({ error: 'Failed to toggle LoRA public status' });
    }
  });

  // Delete LoRA
  app.delete('/loras/:id', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-telegram-user-id'],
        properties: {
          'x-telegram-user-id': { type: 'string' }
        }
      },
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const telegramId = request.headers['x-telegram-user-id'] as string;

      if (!telegramId) {
        return reply.status(400).send({ error: 'Missing user ID' });
      }

      const user = await prisma.user.findUnique({
        where: { telegramId },
        select: { databaseId: true }
      });

      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      // Find the lora and verify ownership
      const lora = await prisma.loraModel.findFirst({
        where: {
          databaseId: id,
          userDatabaseId: user.databaseId
        }
      });

      if (!lora) {
        return reply.status(404).send({ error: 'LoRA not found or not owned by user' });
      }

      // Check if lora is in training
      if (lora.status === LoraStatus.TRAINING) {
        return reply.status(400).send({ error: 'Cannot delete LoRA while it is training' });
      }

      // Delete the lora and its related training data in a transaction
      await prisma.$transaction([
        prisma.training.deleteMany({
          where: { loraId: id }
        }),
        prisma.loraModel.delete({
          where: { databaseId: id }
        })
      ]);

      logger.info({
        loraId: id,
        userDatabaseId: user.databaseId
      }, 'LoRA deleted successfully');

      return reply.send({ message: 'LoRA deleted successfully' });
    } catch (error) {
      logger.error({ error }, 'Failed to delete LoRA');
      reply.status(500).send({ error: 'Failed to delete LoRA' });
    }
  });

  logger.info('LoRA routes registered');
}