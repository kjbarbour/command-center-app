import { prisma } from '@/lib/prisma';

async function main() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully.');
    const count = await prisma.customer.count();
    console.log(`Customer records: ${count}`);
  } catch (err) {
    console.error('❌ Healthcheck failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();