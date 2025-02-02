import { PrismaClient } from '@prisma/client';
import { MODELS } from '../src/config/models';

const prisma = new PrismaClient();

async function main() {
  // Clear existing models
  await prisma.baseModel.deleteMany();

  // Add models from config
  for (const [modelPath, config] of Object.entries(MODELS)) {
    await prisma.baseModel.create({
      data: {
        modelPath,
        costPerGeneration: config.cost
      }
    });
  }

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });