import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.submission.createMany({
    data: [
      { businessName: 'Acme Plumbing' },
      { businessName: 'Blue Oak Landscapes' },
    ],
  });
}
main().finally(() => prisma.$disconnect());
