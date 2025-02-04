import type { FalImage, FalResponse } from '@fal-ai/client';
import { fal } from '@fal-ai/client';
import type { GenerateImageParams, GenerationResponse } from '../types/generation';

export async function generateImage(params: GenerateImageParams): Promise<GenerationResponse> {
  console.log('Generation params:', params);
  
  // Build FAL request payload
  const falParams = {
    prompt: params.prompt,
    image_size: params.imageSize || 'square',
    num_inference_steps: params.numInferenceSteps || 28,
    seed: params.seed,
    guidance_scale: params.guidanceScale || 3.5,
    num_images: params.numImages || 1,
    enable_safety_checker: params.enableSafetyChecker ?? true,
    output_format: params.outputFormat || 'jpeg'
  };

  if (params.loras && params.loras.length > 0) {
    falParams['loras'] = params.loras;
  }

  console.log('FAL params:', falParams);

  const response = await (fal as any).run('fal-ai/flux-lora', falParams);

  return {
    images: response.images.map((img: FalImage) => ({
      url: img.url,
      contentType: `image/${params.outputFormat || 'jpeg'}`
    })),
    seed: response.seed,
    hasNsfwConcepts: response.has_nsfw_concepts || []
  };
}