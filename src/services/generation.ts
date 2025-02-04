import type { FalImage, FalResponse } from '@fal-ai/client';
import { fal } from '@fal-ai/client';
import type { GenerateImageParams, GenerationResponse } from '../types/generation';

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
  console.log('Generation params:', params);
  
  const requestParams: FalRequestParams = {
    input: {
      prompt: params.prompt,
      image_size: params.imageSize || 'square',
      num_inference_steps: params.numInferenceSteps || 28,
      seed: params.seed,
      guidance_scale: params.guidanceScale || 3.5,
      num_images: params.numImages || 1,
      enable_safety_checker: params.enableSafetyChecker ?? true,
      output_format: params.outputFormat || 'jpeg'
    }
  };

  if (params.loras && params.loras.length > 0) {
    requestParams.input.loras = params.loras.map(lora => ({
      path: lora.weightsUrl,
      scale: lora.scale
    }));
  }

  console.log('FAL params:', requestParams);

  const result = await fal.subscribe('fal-ai/flux-lora', requestParams);
  const response = result.data;

  return {
    images: response.images.map((img: FalImage) => ({
      url: img.url,
      contentType: `image/${params.outputFormat || 'jpeg'}`
    })),
    seed: response.seed,
    hasNsfwConcepts: response.has_nsfw_concepts || []
  };
}