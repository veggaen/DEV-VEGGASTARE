import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const userCount = await prisma.user.count();
  const productCount = await prisma.product.count();
  const companyCount = await prisma.company.count();
  
  console.log('\n📊 Database Status:');
  console.log(`   Users: ${userCount}`);
  console.log(`   Products: ${productCount}`);
  console.log(`   Companies: ${companyCount}`);
  console.log(userCount === 0 ? '\n✅ Database is clean and ready!' : '\n⚠️ Database still has data');
  
  await prisma.$disconnect();
}

check();
