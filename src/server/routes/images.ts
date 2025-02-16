import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../../db';
import { ApiError } from '../../errors';
import { logger } from '../../logger';

const router = Router();

// Existing routes...

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.headers['x-telegram-user-id'];

  if (!userId) {
    throw new ApiError('Unauthorized', 401);
  }

  const user = await prisma.user.findUnique({
    where: { telegramId: userId.toString() },
  });

  if (!user) {
    throw new ApiError('User not found', 404);
  }

  const generation = await prisma.generation.findUnique({
    where: { databaseId: id },
  });

  if (!generation) {
    throw new ApiError('Image not found', 404);
  }

  if (generation.userDatabaseId !== user.databaseId) {
    throw new ApiError('Unauthorized', 401);
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

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error deleting image:', error);
    throw new ApiError('Failed to delete image', 500);
  }
});

export default router;