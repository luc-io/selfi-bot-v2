import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Replace with your Telegram ID
  const telegramId = '2061615306';

  const user = await prisma.user.findUnique({
    where: { telegramId }
  });

  console.log('User found:', user);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());