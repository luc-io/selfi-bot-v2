import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../db';
import { FalError } from '../../errors';
import { logger } from '../../logger';

export default async function imagesRoutes(fastify: FastifyInstance) {
  // Existing routes...

  fastify.delete('/:id', async (request: FastifyRequest<{
    Params: { id: string };
  }>, reply: FastifyReply) => {
    const { id } = request.params;
    const userId = request.headers['x-telegram-user-id'];

    if (!userId) {
      throw new FalError('Unauthorized');
    }

    const user = await prisma.user.findUnique({
      where: { telegramId: userId.toString() },
    });

    if (!user) {
      throw new FalError('User not found');
    }

    const generation = await prisma.generation.findUnique({
      where: { databaseId: id },
    });

    if (!generation) {
      throw new FalError('Image not found');
    }

    if (generation.userDatabaseId !== user.databaseId) {
      throw new FalError('Unauthorized');
    }

    try {
      // Delete the actual file
      const imagePath = path.join(process.cwd(), 'public', generation.imageUrl);
      await fs.unlink(imagePath).catch((error) => {
        logger.error('Failed to delete image file:', error);
        // Continue with DB deletion even if file deletion fails
      });

      // Delete the database record
      await prisma.generation.delete({
        where: { databaseId: id },
      });

      return { success: true };
    } catch (error) {
      logger.error('Error deleting image:', error);
      throw new FalError('Failed to delete image');
    }
  });
}