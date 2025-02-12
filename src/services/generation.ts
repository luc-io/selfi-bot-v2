import type { FalImage, FalResponse } from '@fal-ai/client';
import { fal } from '@fal-ai/client';
import type { GenerateImageParams, GenerationResponse } from '../types/generation';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { StarsService } from './stars.js';
import { generateFalSeed, isValidSeed } from '../utils/seed.js';

interface LoraConfig {
  config: {
    path: string;
    scale: number;
  };
  id: string;
}

interface FalRequestParams {
  input: {
    prompt: string;
    image_size?: string;
    num_inference_steps?: number;
    seed: number;  // Made required as we always pass it
    guidance_scale?: number;
    num_images?: number;
    enable_safety_checker?: boolean;
    output_format?: 'jpeg' | 'png';
    loras?: { path: string; scale: number }[];
  };
  logs?: boolean;
}

const falKey = process.env.FAL_KEY;
if (!falKey) {
  throw new Error('FAL_KEY environment variable is not set');
}

// Configure Fal client with environment variables
fal.config({
  credentials: falKey
});

function validateAndConvertSeed(seed: number): bigint | null {
  if (!seed) return null;
  
  try {
    const bigIntSeed = BigInt(seed);
    
    if (bigIntSeed > BigInt('9223372036854775807') || bigIntSeed < BigInt('-9223372036854775808')) {
      logger.warn({ seed, bigIntSeed: bigIntSeed.toString() }, 'Seed value out of PostgreSQL bigint range, defaulting to null');
      return null;
    }
    
    return bigIntSeed;
  } catch (error) {
    logger.warn({ seed, error }, 'Failed to convert seed to BigInt, defaulting to null');
    return null;
  }
}

export async function generateImage(params: GenerateImageParams & { telegramId: string }): Promise<GenerationResponse> {
  logger.info({ params }, 'Starting image generation with params');

  // Get user database ID
  const user = await prisma.user.findUnique({
    where: { telegramId: params.telegramId },
    select: { databaseId: true }
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Calculate required stars (3 stars per image)
  const numImages = params.numImages ?? 1;
  const requiredStars = numImages * 3;

  // Check if user has enough stars
  const hasEnoughStars = await StarsService.checkBalance(params.telegramId, requiredStars);
  if (!hasEnoughStars) {
    throw new Error(`Insufficient stars. Required: ${requiredStars} stars for ${numImages} image${numImages > 1 ? 's' : ''} (3 stars each)`);
  }

  // Get base model
  const baseModel = await prisma.baseModel.findUnique({
    where: { modelPath: 'fal-ai/flux-lora' },
    select: { databaseId: true }
  });

  if (!baseModel) {
    throw new Error('Base model not found');
  }

  // Handle seed - generate new only if not provided or 0
  let seed = params.seed;
  if (seed === undefined || seed === null || seed === 0) {
    seed = generateFalSeed();
    logger.info({ originalSeed: params.seed, generatedSeed: seed }, 'Generated new seed for request');
  }

  const requestParams: FalRequestParams = {
    input: {
      prompt: params.prompt,
      image_size: params.imageSize ?? 'square',
      num_inference_steps: params.numInferenceSteps ?? 28,
      seed: seed,
      guidance_scale: params.guidanceScale ?? 3.5,
      num_images: numImages,
      enable_safety_checker: params.enableSafetyChecker ?? true,
      output_format: params.outputFormat ?? 'jpeg'
    },
    logs: true
  };

  // Get LoRA info if present
  let validLoraConfigs: LoraConfig[] = [];

  if (params.loras && params.loras.length > 0) {
    const loraPromises = params.loras.map(async (lora) => {
      // Get LoRA details from database
      const loraModel = await prisma.loraModel.findUnique({
        where: { databaseId: lora.path },
        select: { 
          weightsUrl: true,
          databaseId: true,
          name: true,
          triggerWord: true
        }
      });

      if (!loraModel?.weightsUrl) {
        logger.warn({ loraId: lora.path }, 'LoRA weights URL not found');
        return null;
      }

      return {
        config: {
          path: loraModel.weightsUrl,
          scale: lora.scale
        },
        id: loraModel.databaseId,
        name: loraModel.name,
        triggerWord: loraModel.triggerWord
      };
    });

    validLoraConfigs = (await Promise.all(loraPromises)).filter((config): config is LoraConfig & { name: string; triggerWord: string } => config !== null);

    if (validLoraConfigs.length > 0) {
      requestParams.input.loras = validLoraConfigs.map(config => config.config);
      logger.info({ loras: validLoraConfigs }, 'Added LoRA configurations to request');
    }
  }

  logger.info({ requestParams }, 'Sending request to FAL');

  try {
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

    // After successful generation, deduct stars based on number of images
    await StarsService.updateStars(params.telegramId, {
      amount: -requiredStars,
      type: 'GENERATION',
      metadata: {
        prompt: params.prompt,
        seed: result.data.seed,
        numImages: numImages
      }
    });

    // Save each generated image
    const savedImages = await Promise.all(images.map(async (img: FalImage) => {
      const metadata = {
        image_size: requestParams.input.image_size,
        num_inference_steps: requestParams.input.num_inference_steps,
        guidance_scale: requestParams.input.guidance_scale,
        enable_safety_checker: requestParams.input.enable_safety_checker,
        output_format: requestParams.input.output_format,
        loras: validLoraConfigs.map(lora => ({
          id: lora.id,
          name: lora.name,
          triggerWord: lora.triggerWord,
          scale: lora.config.scale,
          weightsUrl: lora.config.path
        }))
      };

      const savedImage = await prisma.generation.create({
        data: {
          userDatabaseId: user.databaseId,
          baseModelId: baseModel.databaseId,
          loraId: validLoraConfigs[0]?.id,  // Keep first LoRA for backwards compatibility
          prompt: params.prompt,
          imageUrl: img.url,
          seed: validateAndConvertSeed(result.data.seed),
          starsUsed: requiredStars / numImages,
          metadata: metadata
        }
      });

      logger.info({ 
        imageId: savedImage.databaseId,
        url: savedImage.imageUrl
      }, 'Saved generated image to database');

      return savedImage;
    }));

    logger.info({ 
      generationResponse, 
      savedImagesCount: savedImages.length 
    }, 'Generation and database save completed successfully');
    
    return generationResponse;
  } catch (error) {
    logger.error({ error, params }, 'Generation failed');
    throw error;
  }
}