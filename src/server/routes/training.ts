import { FastifyPluginAsync } from 'fastify';
import { startTraining, getTrainingProgress } from '../../lib/fal.js';
import { fal } from '@fal-ai/client';
import JSZip from 'jszip';
import { logger } from '../../lib/logger.js';
import { Readable } from 'node:stream';
import { MultipartFile } from '@fastify/multipart';

interface MultipartData {
  fields: {
    steps: string;
    isStyle: string;
    createMasks: string;
    triggerWord: string;
    captions: string;
  };
  files: MultipartFile[];
}

interface FalTrainingResult {
  data: {
    diffusers_lora_file: {
      url: string;
    };
    config_file: {
      url: string;
    };
  };
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
      const parts = await request.parts();
      const data: MultipartData = {
        fields: {
          steps: '',
          isStyle: 'false',
          createMasks: 'true',
          triggerWord: '',
          captions: '{}'
        },
        files: []
      };

      // Process all parts
      for await (const part of parts) {
        if (part.type === 'file') {
          data.files.push(part);
        } else if (part.fieldname in data.fields) {
          // This cast is safe because we check fieldname
          const fieldName = part.fieldname as keyof typeof data.fields;
          data.fields[fieldName] = part.value as string;
        }
      }

      // Parse captions
      const captions = JSON.parse(data.fields.captions);

      // Create ZIP file
      const zip = new JSZip();
      
      // Add images and caption files to ZIP
      for (const file of data.files) {
        const buffer = await file.toBuffer();
        zip.file(file.filename, buffer);

        // Add caption file if exists
        const caption = captions[file.filename];
        if (caption) {
          const captionFileName = file.filename.replace(/\.[^/.]+$/, '.txt');
          zip.file(captionFileName, caption);
        }
      }

      // Generate ZIP buffer
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      const zipBlob = new Blob([zipBuffer], { type: 'application/zip' });
      const zipFile = new File([zipBlob], 'training_images.zip', { type: 'application/zip' });

      // Upload ZIP to fal storage
      const imagesDataUrl = await fal.storage.upload(zipFile);

      // Start training
      const requestId = await startTraining({
        steps: parseInt(data.fields.steps),
        isStyle: data.fields.isStyle === 'true',
        createMasks: data.fields.createMasks === 'true',
        triggerWord: data.fields.triggerWord,
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
      const result = await fal.subscribe('fal-ai/flux-lora-fast-training', { requestId }) as unknown as FalTrainingResult;

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