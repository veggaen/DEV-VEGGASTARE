import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import { faker } from "@faker-js/faker";

async function main() {
  console.log("Seeding...");

  // Create Users
  const users = await Promise.all(
    Array.from({ length: 10 }).map(() => {
      return prisma.user.create({
        data: {
          name: faker.name.fullName(),
          email: faker.internet.email(),
          image: faker.internet.avatar(),
          password: faker.internet.password(),
          role: "USER",
        },
      });
    })
  );

  // Create Companies
  const companies = await Promise.all(
    Array.from({ length: 5 }).map((_, index) => {
      return prisma.company.create({
        data: {
          name: faker.company.name(),
          description: faker.company.catchPhrase(),
          websiteUrl: faker.internet.url(),
          logo: [faker.image.business()],
          bannerImage: [faker.image.abstract(1080, 1080, true)],
          colorScheme: faker.color.rgb(),
          creatorId: users[index % users.length].id,
          ownerId: users[index % users.length].id,
          usesShipping: faker.datatype.boolean(),
        },
      });
    })
  );

  // Create Products
  await Promise.all(
    Array.from({ length: 90 }).map(() => {
      return prisma.product.create({
        data: {
          title: faker.commerce.productName(),
          description: faker.commerce.productDescription(),
          category: faker.commerce.department(),
          price: parseFloat(faker.commerce.price()),
          stock: faker.datatype.number({ min: 0, max: 100 }),
          shipFromPostalId: faker.address.zipCode(),
          image: [faker.image.abstract(1080, 1080, true)],
          userId: users[faker.datatype.number({ min: 0, max: users.length - 1 })].id,
          companyId: companies[faker.datatype.number({ min: 0, max: companies.length - 1 })].id,
        },
      });
    })
  );

  // Create Job Requests
  await Promise.all(
    Array.from({ length: 10 }).map(() => {
      return prisma.jobRequest.create({
        data: {
          title: faker.company.bs(),
          descriptions: [faker.lorem.paragraph()],
          images: [faker.image.abstract(1080, 1080, true)],
          links: [faker.internet.url()],
          docs: [],
          price: parseFloat(faker.commerce.price()),
          negotiable: faker.datatype.boolean(),
          paymentMethod: faker.finance.transactionType(),
          delivery: faker.date.future().toISOString(),
          additionalNotes: faker.lorem.sentences(),
          email: faker.internet.email(),
          userId: users[faker.datatype.number({ min: 0, max: users.length - 1 })].id,
          companyIds: [],
        },
      });
    })
  );

  console.log("Seeding completed.");
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
})