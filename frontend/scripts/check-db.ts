import 'dotenv/config'
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL_MAINLIVE!, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter });

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
