import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../lib/prisma.js';

const loras: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/loras', async (_, reply) => {
    try {
      const loras = await prisma.loraModel.findMany({
        orderBy: { createdAt: 'desc' }
      });
      reply.send(loras);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch LoRAs' });
    }
  });

  fastify.get('/api/loras/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const lora = await prisma.loraModel.findUnique({
        where: { id }
      });
      if (!lora) {
        reply.code(404).send({ error: 'LoRA not found' });
        return;
      }
      reply.send(lora);
    } catch (error) {
      reply.code(500).send({ error: 'Failed to fetch LoRA' });
    }
  });
};

export default loras;