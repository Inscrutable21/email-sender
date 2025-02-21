import { PrismaClient } from '@prisma/client';

type GlobalWithPrisma = typeof globalThis & {
  prisma: PrismaClient | undefined;
};

const globalWithPrisma = global as GlobalWithPrisma;

if (!globalWithPrisma.prisma) {
  globalWithPrisma.prisma = new PrismaClient();
}

const prisma = globalWithPrisma.prisma;

export { prisma };