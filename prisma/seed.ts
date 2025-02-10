import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Ensure the base model exists
  await prisma.baseModel.upsert({
    where: { modelPath: 'fal-ai/flux-lora' },
    update: {},
    create: {
      modelPath: 'fal-ai/flux-lora',
      costPerGeneration: 3,
    },
  });

  console.log('Database seeded successfully');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });