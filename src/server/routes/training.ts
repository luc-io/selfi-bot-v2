import { FastifyPluginAsync } from 'fastify';
import { startTraining, getTrainingProgress } from '../../lib/fal.js';
import { fal } from '@fal-ai/client';
import JSZip from 'jszip';
import { logger } from '../../lib/logger.js';

interface MultipartFile {
  filename: string;
  encoding: string;
  mimetype: string;
  file: NodeJS.ReadableStream;
}

const training: FastifyPluginAsync = async (fastify) => {
  // Register multipart support
  await fastify.register(import('@fastify/multipart'), {
    limits: {
      fileSize: 50 * 1024 * 1024 // 50MB
    }
  });

  // Start training
  fastify.post('/training/start', async (request, reply) => {
    try {
      const data = await request.file();
      
      if (!data) {
        reply.code(400).send({ error: 'No files uploaded' });
        return;
      }

      const files: MultipartFile[] = [];
      const captions: Record<string, string> = {};

      // Get form data
      for await (const part of data.parts) {
        if (part.type === 'file') {
          files.push({
            filename: part.filename,
            encoding: part.encoding,
            mimetype: part.mimetype,
            file: part.file
          });
        } else if (part.fieldname === 'captions') {
          captions = JSON.parse(part.value as string);
        }
      }

      // Create ZIP file
      const zip = new JSZip();
      
      // Add images and caption files to ZIP
      for (const file of files) {
        const fileBuffer = await file.file.toBuffer();
        zip.file(file.filename, fileBuffer);

        // Add caption file if exists
        const caption = captions[file.filename];
        if (caption) {
          const captionFileName = file.filename.replace(/\.[^/.]+$/, '.txt');
          zip.file(captionFileName, caption);
        }
      }

      // Generate ZIP buffer
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      const zipFile = new File([zipBuffer], 'training_images.zip', { type: 'application/zip' });

      // Upload ZIP to fal storage
      const imagesDataUrl = await fal.storage.upload(zipFile);

      // Start training
      const requestId = await startTraining({
        steps: parseInt(data.fields.steps.value),
        isStyle: data.fields.isStyle.value === 'true',
        createMasks: data.fields.createMasks.value === 'true',
        triggerWord: data.fields.triggerWord.value,
        imagesDataUrl
      });

      reply.send({ requestId });

    } catch (error) {
      logger.error({ error }, 'Error starting training');
      reply.code(500).send({ error: 'Failed to start training' });
    }
  });

  // Get training progress
  fastify.get('/training/:requestId/progress', async (request, reply) => {
    const { requestId } = request.params as { requestId: string };
    
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
  fastify.get('/training/:requestId/result', async (request, reply) => {
    const { requestId } = request.params as { requestId: string };
    
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