import { FastifyPluginAsync } from 'fastify';
import { startTraining, getTrainingProgress } from '../../lib/fal.js';
import { fal } from '@fal-ai/client';
import JSZip from 'jszip';
import { logger } from '../../lib/logger.js';
import { Readable } from 'node:stream';
import type { MultipartValue } from '@fastify/multipart';

interface TrainingFormFields {
  steps: MultipartValue<string>;
  isStyle: MultipartValue<string>;
  createMasks: MultipartValue<string>;
  triggerWord: MultipartValue<string>;
  captions: MultipartValue<string>;
}

interface TrainingFiles {
  images: AsyncIterableIterator<MultipartValue<Readable>>;
}

const training: FastifyPluginAsync = async (fastify) => {
  // Register multipart support
  await fastify.register(import('@fastify/multipart'), {
    limits: {
      fileSize: 50 * 1024 * 1024 // 50MB
    }
  });

  // Start training
  fastify.post<{
    Body: { [K in keyof TrainingFormFields]: TrainingFormFields[K]['value'] } & TrainingFiles;
  }>('/training/start', async (request, reply) => {
    try {
      const parts = request.parts();

      // Initialize ZIP
      const zip = new JSZip();
      
      // Process form fields
      const fields: Partial<TrainingFormFields> = {};
      let captions: Record<string, string> = {};

      // Process all parts
      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'images') {
          // Handle image file
          const buffer = await part.toBuffer();
          zip.file(part.filename, buffer);
        } else {
          // Handle form fields
          if (part.fieldname === 'captions') {
            captions = JSON.parse(part.value as string);
          } else {
            fields[part.fieldname as keyof TrainingFormFields] = part;
          }
        }
      }

      // Add caption files to ZIP
      Object.entries(captions).forEach(([filename, caption]) => {
        const captionFileName = filename.replace(/\.[^/.]+$/, '.txt');
        zip.file(captionFileName, caption);
      });

      // Validate required fields
      if (!fields.steps?.value || !fields.triggerWord?.value) {
        reply.code(400).send({ error: 'Missing required fields' });
        return;
      }

      // Generate ZIP buffer
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // Upload ZIP to fal storage using buffer
      const blob = new Blob([zipBuffer], { type: 'application/zip' });
      const zipFile = new File([blob], 'training_images.zip', { type: 'application/zip' });
      const imagesDataUrl = await fal.storage.upload(zipFile);

      // Start training
      const requestId = await startTraining({
        steps: parseInt(fields.steps.value),
        isStyle: fields.isStyle?.value === 'true',
        createMasks: fields.createMasks?.value === 'true',
        triggerWord: fields.triggerWord.value,
        imagesDataUrl
      });

      reply.send({ requestId });

    } catch (error) {
      logger.error({ error }, 'Error starting training');
      reply.code(500).send({ error: 'Failed to start training' });
    }
  });

  // Get training progress
  fastify.get<{
    Params: { requestId: string }
  }>('/training/:requestId/progress', async (request, reply) => {
    const { requestId } = request.params;
    
    try {
      const progress = getTrainingProgress(requestId);
      
      if (!progress) {
        reply.code(404).send({ error: 'Training not found' });
        return;
      }

      reply.send(progress);

    } catch (error) {
      logger.error({ error, requestId }, 'Error getting training progress');
      reply.code(500).send({ error: 'Failed to get training progress' });
    }
  });

  // Get training result
  fastify.get<{
    Params: { requestId: string }
  }>('/training/:requestId/result', async (request, reply) => {
    const { requestId } = request.params;
    
    try {
      const result = await fal.queue.result('fal-ai/flux-lora-fast-training', {
        requestId
      });

      if (!result?.data) {
        reply.code(404).send({ error: 'Training result not found' });
        return;
      }

      reply.send({
        requestId,
        loraUrl: result.data.diffusers_lora_file.url,
        configUrl: result.data.config_file.url
      });

    } catch (error) {
      logger.error({ error, requestId }, 'Error getting training result');
      reply.code(500).send({ error: 'Failed to get training result' });
    }
  });
};

export default training;