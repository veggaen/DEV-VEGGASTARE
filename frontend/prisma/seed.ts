import 'dotenv/config'
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { faker } from "@faker-js/faker";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter })

// Helper to create slug
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

async function seedCategories() {
  console.log("Seeding categories...");

  // Define parent categories with their subcategories
  const categoryStructure = [
    {
      name: 'Software',
      description: 'Software products and applications',
      children: [
        { name: 'Desktop Apps', description: 'Applications for desktop computers' },
        { name: 'Mobile Apps', description: 'Applications for mobile devices' },
        { name: 'Web Apps', description: 'Web-based applications and SaaS' },
        { name: 'Plugins', description: 'Extensions and plugins for other software' },
        { name: 'Scripts', description: 'Automation scripts and utilities' },
      ],
    },
    {
      name: 'Templates',
      description: 'Ready-to-use templates and themes',
      children: [
        { name: 'Website Templates', description: 'HTML/CSS website templates' },
        { name: 'Landing Pages', description: 'Landing page templates' },
        { name: 'Email Templates', description: 'Email marketing templates' },
        { name: 'UI Kits', description: 'User interface component kits' },
        { name: 'Presentations', description: 'Presentation and slide templates' },
      ],
    },
    {
      name: 'Digital Assets',
      description: 'Digital files and creative assets',
      children: [
        { name: 'Graphics', description: 'Illustrations, icons, and graphics' },
        { name: 'Photos', description: 'Stock photos and images' },
        { name: 'Videos', description: 'Video content and footage' },
        { name: 'Audio', description: 'Music, sounds, and audio files' },
        { name: 'Fonts', description: 'Typography and font files' },
        { name: '3D Models', description: '3D models and assets' },
      ],
    },
    {
      name: 'Courses',
      description: 'Educational content and tutorials',
      children: [
        { name: 'Programming', description: 'Coding and development courses' },
        { name: 'Design', description: 'Design and creative courses' },
        { name: 'Business', description: 'Business and marketing courses' },
        { name: 'Personal Development', description: 'Self-improvement courses' },
      ],
    },
    {
      name: 'Services',
      description: 'Professional services',
      children: [
        { name: 'Static', description: 'One-time deliverables' },
        { name: 'Dynamic', description: 'Ongoing or interactive services' },
        { name: 'Consulting', description: 'Expert advice and consultation' },
        { name: 'Support', description: 'Technical support packages' },
      ],
    },
    {
      name: 'Memberships',
      description: 'Subscription and membership products',
      children: [
        { name: 'Signups', description: 'Account and access products' },
        { name: 'Communities', description: 'Community memberships' },
        { name: 'Newsletters', description: 'Newsletter subscriptions' },
      ],
    },
    {
      name: 'Electronics',
      description: 'Electronic devices and gadgets',
      children: [
        { name: 'Computers', description: 'Desktops, laptops, and components' },
        { name: 'Mobile Devices', description: 'Phones, tablets, and wearables' },
        { name: 'Accessories', description: 'Cables, chargers, and peripherals' },
        { name: 'Gaming', description: 'Gaming hardware and accessories' },
      ],
    },
    {
      name: 'Fashion',
      description: 'Clothing and fashion items',
      children: [
        { name: 'Clothing', description: 'Apparel and garments' },
        { name: 'Shoes', description: 'Footwear' },
        { name: 'Accessories', description: 'Bags, jewelry, and accessories' },
      ],
    },
    {
      name: 'Home & Living',
      description: 'Home goods and lifestyle products',
      children: [
        { name: 'Furniture', description: 'Home and office furniture' },
        { name: 'Decor', description: 'Decorative items and art' },
        { name: 'Kitchen', description: 'Kitchen tools and appliances' },
      ],
    },
    {
      name: 'Collectibles',
      description: 'Collectible and rare items',
      children: [
        { name: 'Art', description: 'Fine art and prints' },
        { name: 'Vintage', description: 'Vintage and antique items' },
        { name: 'Trading Cards', description: 'Collectible cards' },
      ],
    },
  ];

  // Create categories (skip if they already exist)
  for (const parent of categoryStructure) {
    const parentSlug = createSlug(parent.name);
    
    // Check if parent already exists
    let parentCategory = await prisma.category.findUnique({
      where: { slug: parentSlug },
    });

    if (!parentCategory) {
      parentCategory = await prisma.category.create({
        data: {
          name: parent.name,
          slug: parentSlug,
          description: parent.description,
        },
      });
      console.log(`  Created parent category: ${parent.name}`);
    } else {
      console.log(`  Parent category exists: ${parent.name}`);
    }

    // Create children
    for (const child of parent.children) {
      const childSlug = createSlug(child.name);
      
      const existingChild = await prisma.category.findUnique({
        where: { slug: childSlug },
      });

      if (!existingChild) {
        await prisma.category.create({
          data: {
            name: child.name,
            slug: childSlug,
            description: child.description,
            parentId: parentCategory.id,
          },
        });
        console.log(`    Created subcategory: ${child.name}`);
      } else {
        console.log(`    Subcategory exists: ${child.name}`);
      }
    }
  }

  console.log("Categories seeded!");
}

async function main() {
  console.log("Seeding...");

  // Seed categories first
  await seedCategories();

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
          stock: 0,
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