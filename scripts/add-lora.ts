import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Find or create the base model
  const baseModel = await prisma.baseModel.upsert({
    where: { modelPath: 'fal-ai/flux-lora' },
    update: {},
    create: {
      modelPath: 'fal-ai/flux-lora',
      costPerGeneration: 1
    }
  });

  // 2. Create the LoRA model
  const lora = await prisma.loraModel.create({
    data: {
      name: 'TOK Style',
      triggerWord: 'TOK',
      weightsUrl: 'https://v3.fal.media/files/lion/wh1mXu5G7cNTAz01NnbG9_pytorch_lora_weights.safetensors',
      configUrl: 'https://v3.fal.media/files/panda/X1qP-fJhUlclTMJDLG0VR_config.json',
      baseModelId: baseModel.databaseId,
      status: 'COMPLETED',
      isPublic: true,
      starsRequired: 2,
      userDatabaseId: 'YOUR_USER_ID_HERE' // Replace with your user ID
    }
  });

  console.log('LoRA added successfully:', lora);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());