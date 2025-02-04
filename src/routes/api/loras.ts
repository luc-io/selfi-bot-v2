import { Request, Response, Router } from 'express';
import { prisma } from '../../lib/prisma';

const router = Router();

router.get('/available', async (req: Request, res: Response) => {
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
        weightsUrl: true
      }
    });
    
    res.json(loras);
  } catch (error) {
    console.error('Error fetching available LoRAs:', error);
    res.status(500).json({ error: 'Failed to fetch available LoRAs' });
  }
});

export default router;