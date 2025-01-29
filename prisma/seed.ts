import { PrismaClient, BaseModelType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create default Flux model
  await prisma.baseModel.upsert({
    where: { id: 'flux-default' },
    update: {},
    create: {
      id: 'flux-default',
      name: 'Flux',
      version: 'v1',
      type: BaseModelType.FLUX,
      isDefault: true
    }
  });

  // Create Flux fast training model
  await prisma.baseModel.upsert({
    where: { id: 'flux-fast' },
    update: {},
    create: {
      id: 'flux-fast',
      name: 'Flux Fast Training',
      version: 'v1',
      type: BaseModelType.FLUX_FAST,
      isDefault: false
    }
  });

  console.log('Database seeded successfully');
}

main()
  .catch((error) => {
    console.error('Error seeding database:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });