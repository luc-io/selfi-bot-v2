import type { FalImage, FalResponse } from '@fal-ai/client';
import fal from '@fal-ai/client';
import type { GenerateImageParams, GenerationResponse } from '../types/generation';

export async function generateImage(params: GenerateImageParams): Promise<GenerationResponse> {
  const response = await fal.invoke<FalResponse>('fal-ai/flux-lora', {
    prompt: params.prompt,
    loras: params.loras,
    image_size: params.imageSize || 'landscape_4_3',
    num_inference_steps: params.numInferenceSteps || 28,
    seed: params.seed,
    guidance_scale: params.guidanceScale || 3.5,
    num_images: params.numImages || 1,
    sync_mode: params.syncMode || false,
    enable_safety_checker: params.enableSafetyChecker ?? true,
    output_format: params.outputFormat || 'jpeg'
  });

  return {
    images: response.images.map((img: FalImage) => ({
      url: img.url,
      contentType: `image/${params.outputFormat || 'jpeg'}`
    })),
    seed: response.seed,
    hasNsfwConcepts: response.has_nsfw_concepts || []
  };
}