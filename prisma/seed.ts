import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create 10 rooms
  for (let i = 1; i <= 10; i++) {
    await prisma.room.upsert({
      where: { id: i },
      update: {},
      create: {
        id: i,
        name: `Room ${i}`,
      },
    });
  }

  console.log('Database seeded successfully with 10 rooms!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
