import { PrismaClient } from '../generated/prisma';

declare global {
  var prisma: InstanceType<typeof PrismaClient> | undefined; // eslint-disable-line no-var
}

let prisma: InstanceType<typeof PrismaClient>;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!globalThis.prisma) {
    globalThis.prisma = new PrismaClient();
  }
  prisma = globalThis.prisma;
}

export default prisma; 
