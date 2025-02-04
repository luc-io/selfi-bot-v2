import type { FalImage, FalResponse } from '@fal-ai/client';
import { fal } from '@fal-ai/client';
import type { GenerateImageParams, GenerationResponse } from '../types/generation';
import { logger } from '../lib/logger.js';

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
    logs: true // Enable FAL logs
  };

  // Add LoRA configuration if present
  if (params.loras && params.loras.length > 0) {
    logger.info({ loras: params.loras }, 'Adding LoRA configuration');
    requestParams.input.loras = params.loras.map(lora => ({
      path: lora.path,  // Use path directly from the parameter
      scale: lora.scale
    }));
  }

  logger.info({ requestParams }, 'Sending request to FAL');

  const result = await fal.run('fal-ai/flux-lora', requestParams);
  logger.info({ result }, 'Received FAL response');

  // Extract images from result.data.images
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