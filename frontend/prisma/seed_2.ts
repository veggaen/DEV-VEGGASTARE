import 'dotenv/config'
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg'
import { faker } from '@faker-js/faker';
import { createApi } from 'unsplash-js';
import * as nodeFetch from 'node-fetch'

const A_KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!A_KEY) throw new Error('UNSPLASH_ACCESS_KEY is not set');

// Configure Unsplash
const unsplash = createApi({
  accessKey: A_KEY, // Replace with your Unsplash access key
  fetch: nodeFetch.default as unknown as typeof fetch,
});

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL_MAINLIVE!, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter });

async function getUnsplashImage(query: string): Promise<string> {
  try {
    const result = await unsplash.search.getPhotos({
      query,
      page: 1,
      perPage: 1,
      orientation: 'landscape',
    });

    if (result.response?.results.length) {
      return result.response.results[0].urls.regular;
    }

    return faker.image.url(); // Fallback to Faker if no image is found
  } catch (error) {
    console.error('Error fetching image from Unsplash:', error);
    return faker.image.url(); // Fallback to Faker in case of an error
  }
}

async function main() {
  console.log("Seeding...");

  // Create Users
  const users = await Promise.all(
    Array.from({ length: 10 }).map(() => {
      return prisma.user.create({
        data: {
          name: faker.person.fullName(),
          email: faker.internet.email(),
          image: faker.image.avatar(),
          password: faker.internet.password(),
          role: "USER",
        },
      });
    })
  );

  // Create Companies
  const companies = await Promise.all(
    Array.from({ length: 5 }).map(async (_, index) => {
      return prisma.company.create({
        data: {
          name: faker.company.name(),
          description: faker.company.catchPhrase(),
          websiteUrl: faker.internet.url(),
          logo: [await getUnsplashImage('business logo')],
          bannerImage: [await getUnsplashImage('business banner')],
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
    Array.from({ length: 90 }).map(async () => {
      return prisma.product.create({
        data: {
          title: faker.commerce.productName(),
          description: faker.commerce.productDescription(),
          category: faker.commerce.department(),
          price: parseFloat(faker.commerce.price()),
          stock: faker.number.int({ min: 0, max: 100 }),
          shipFromPostalId: faker.location.zipCode(),
          image: [await getUnsplashImage(faker.commerce.department())],
          userId: users[faker.number.int({ min: 0, max: users.length - 1 })].id,
          companyId: companies[faker.number.int({ min: 0, max: companies.length - 1 })].id,
        },
      });
    })
  );

  // Create Job Requests
  await Promise.all(
    Array.from({ length: 10 }).map(async () => {
      return prisma.jobRequest.create({
        data: {
          title: faker.company.bs(),
          descriptions: [faker.lorem.paragraph()],
          images: [await getUnsplashImage('job')],
          links: [faker.internet.url()],
          docs: [],
          price: parseFloat(faker.commerce.price()),
          negotiable: faker.datatype.boolean(),
          paymentMethod: faker.finance.transactionType(),
          delivery: faker.date.future().toISOString(),
          additionalNotes: faker.lorem.sentences(),
          email: faker.internet.email(),
          userId: users[faker.number.int({ min: 0, max: users.length - 1 })].id,
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
  });