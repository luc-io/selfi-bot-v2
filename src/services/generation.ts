import type { FalImage, FalResponse } from '@fal-ai/client';
import { fal } from '@fal-ai/client';
import type { GenerateImageParams, GenerationResponse } from '../types/generation';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';

interface FalRequestParams {
  input: {
    prompt: string;
    image_size?: string;
    num_inference_steps?: number;
    seed?: number;
    guidance_scale?: number;
    num_images?: number;
    enable_safety_checker?: boolean;
    output_format?: 'jpeg' | 'png';
    loras?: { path: string; scale: number }[];
  };
  logs?: boolean;
}

// Configure Fal client with environment variables
fal.config({
  credentials: process.env.FAL_KEY
});

export async function generateImage(params: GenerateImageParams): Promise<GenerationResponse> {
  logger.info({ params }, 'Starting image generation with params');
  
  const requestParams: FalRequestParams = {
    input: {
      prompt: params.prompt,
      image_size: params.imageSize ?? 'square',
      num_inference_steps: params.numInferenceSteps ?? 28,
      seed: params.seed,
      guidance_scale: params.guidanceScale ?? 3.5,
      num_images: params.numImages ?? 1,
      enable_safety_checker: params.enableSafetyChecker ?? true,
      output_format: params.outputFormat ?? 'jpeg'
    },
    logs: true
  };

  // Add LoRA configuration if present
  if (params.loras && params.loras.length > 0) {
    const loraPromises = params.loras.map(async (lora) => {
      // Get LoRA details from database
      const loraModel = await prisma.loraModel.findUnique({
        where: { databaseId: lora.path },
        select: { weightsUrl: true }
      });

      if (!loraModel?.weightsUrl) {
        logger.warn({ loraId: lora.path }, 'LoRA weights URL not found');
        return null;
      }

      return {
        path: loraModel.weightsUrl,
        scale: lora.scale
      };
    });

    const loraConfigs = await Promise.all(loraPromises);
    const validLoraConfigs = loraConfigs.filter((config): config is { path: string; scale: number } => config !== null);

    if (validLoraConfigs.length > 0) {
      requestParams.input.loras = validLoraConfigs;
      logger.info({ loras: validLoraConfigs }, 'Added LoRA configurations to request');
    }
  }

  logger.info({ requestParams }, 'Sending request to FAL');

  const result = await fal.run('fal-ai/flux-lora', requestParams);
  logger.info({ result }, 'Received FAL response');

  const images = Array.isArray(result.data.images) ? result.data.images : [result.data.images];
  
  const generationResponse = {
    images: images.map((img: FalImage) => ({
      url: img.url,
      contentType: `image/${params.outputFormat ?? 'jpeg'}`
    })),
    seed: result.data.seed,
    hasNsfwConcepts: result.data.has_nsfw_concepts || []
  };

  logger.info({ generationResponse }, 'Generation completed successfully');
  return generationResponse;
}