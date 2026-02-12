/**
 * Seed Script: Generate Activity Data for Testing
 * 
 * Creates fake users, companies, products (cheap testnet prices), conversations/pulses,
 * messages, follows, engagement events, nested replies, repulses (quote posts), and advanced polls.
 * 
 * Run with: npx tsx scripts/seed-activity.ts
 * 
 * Uses DEV database by default in development.
 * Products priced for testnet testing (0.001 ETH range / 10 NOK range).
 */

import 'dotenv/config'
import { PrismaClient } from "../generated/prisma/client";
import { ConversationType, ConversationVisibility, EngagementType, UserVerificationTier, PulseType, AdvancedPollType, PollQuestionType, ProductType, ProductCondition, FiatCurrency, CompanyOrgType, EmployeeRole } from "../generated/prisma/enums";
import { PrismaPg } from '@prisma/adapter-pg'

// ─── CONFIG ────────────────────────────────────────────────────────────────
const NUM_USERS = 30;
const NUM_COMPANIES = 8;
const NUM_PRODUCTS = 25;
const NUM_CONVERSATIONS = 60;
const NUM_MESSAGES_PER_CONVO = 5;
const NUM_FOLLOWS = 120;
const NUM_ENGAGEMENT_EVENTS = 300;
const NUM_REPULSES = 15;
const NUM_ADVANCED_POLLS = 10;
// ────────────────────────────────────────────────────────────────────────────

const DEV_DB_URL = process.env.DATABASE_URL_MAINDEV!;
const connectionString = DEV_DB_URL;
const adapter = new PrismaPg({ connectionString, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter });

console.log("🔧 Using DEV database (ep-hidden-water)\n");

// Random helpers
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min: number, max: number) => Math.random() * (max - min) + min;
const randomItem = <T>(arr: T[]): T => arr[randomInt(0, arr.length - 1)];
const randomSubset = <T>(arr: T[], count: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

const FIRST_NAMES = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Parker', 'Avery', 'Sage', 'Blake', 'Drew', 'Hayden', 'Skyler', 'Reese', 'Charlie', 'Emery', 'Finley', 'Rowan', 'Phoenix', 'River', 'Kai', 'Nova', 'Harper', 'Elliott', 'Ole', 'Kari', 'Lars', 'Ingrid', 'Bjørn'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Hansen', 'Olsen', 'Larsen', 'Johansen', 'Pedersen'];

// Realistic Norwegian addresses for warehouses and testing
const NORWEGIAN_ADDRESSES = [
  { postalCode: '0001', city: 'Oslo', street: 'Karl Johans gate 1', lat: 59.9139, lon: 10.7522 },
  { postalCode: '0155', city: 'Oslo', street: 'Stortingsgata 12', lat: 59.9133, lon: 10.7389 },
  { postalCode: '0252', city: 'Oslo', street: 'Bygdøy allé 45', lat: 59.9127, lon: 10.7086 },
  { postalCode: '4006', city: 'Stavanger', street: 'Kirkegata 8', lat: 58.9690, lon: 5.7331 },
  { postalCode: '4014', city: 'Stavanger', street: 'Lagårdsveien 100', lat: 58.9607, lon: 5.7211 },
  { postalCode: '4310', city: 'Hommersåk', street: 'Blåskjellveien 5B', lat: 58.9278, lon: 5.8386 },
  { postalCode: '5003', city: 'Bergen', street: 'Bryggen 15', lat: 60.3973, lon: 5.3242 },
  { postalCode: '5017', city: 'Bergen', street: 'Møhlenpris 28', lat: 60.3840, lon: 5.3275 },
  { postalCode: '6002', city: 'Ålesund', street: 'Kongensgate 22', lat: 62.4722, lon: 6.1495 },
  { postalCode: '6009', city: 'Ålesund', street: 'Brunholmgata 8', lat: 62.4680, lon: 6.1552 },
  { postalCode: '7010', city: 'Trondheim', street: 'Munkegata 3', lat: 63.4305, lon: 10.3951 },
  { postalCode: '7030', city: 'Trondheim', street: 'Olav Tryggvasons gate 40', lat: 63.4312, lon: 10.4010 },
  { postalCode: '9008', city: 'Tromsø', street: 'Storgata 77', lat: 69.6496, lon: 18.9570 },
  { postalCode: '8006', city: 'Bodø', street: 'Sjøgata 21', lat: 67.2826, lon: 14.4049 },
  { postalCode: '3015', city: 'Drammen', street: 'Bragernes torg 5', lat: 59.7439, lon: 10.2045 },
];
const BIOS = [
  "🚀 Building cool stuff",
  "☕ Coffee enthusiast | 💻 Developer",
  "📚 Lifelong learner",
  "🎨 Creative soul",
  "🌍 Digital nomad",
  "🎮 Gamer | Streamer",
  "📷 Photography lover",
  "🎵 Music is life",
  "💡 Ideas person",
  "🌱 Plant parent",
];

const PULSE_CONTENT = [
  "Just shipped a new feature! 🚀",
  "Anyone else love working late at night? The quiet is so productive.",
  "Hot take: tabs > spaces. Fight me. 😤",
  "Coffee count today: ☕☕☕☕ ... I may have a problem.",
  "Finally figured out that bug that's been haunting me for days!",
  "What's everyone working on this weekend?",
  "The sunrise from my home office window is unbeatable 🌅",
  "reminder: drink water, touch grass, ship code",
  "Just hit 1000 followers! Thank you all 🙏",
  "New blog post dropping soon... stay tuned 👀",
  "Does anyone actually read terms of service? Asking for a friend.",
  "Unpopular opinion: meetings can actually be useful sometimes",
  "Learning a new language is hard but so rewarding",
  "Friday vibes are unmatched ✨",
  "Just discovered this amazing new tool and had to share...",
  "Working on something I can't talk about yet but it's going to be 🔥",
  "The debugging life chose me",
  "Who else is procrastinating right now?",
  "Keyboard just arrived. Mechanical clicks = happiness",
  "Taking a mental health day. Self-care is important!",
];

const MESSAGE_CONTENT = [
  "Great point! 💯",
  "I completely agree with this",
  "Interesting perspective, hadn't thought of it that way",
  "This is so true!",
  "Love this energy",
  "Facts 📠",
  "Can we talk about this more?",
  "This made my day",
  "Underrated take",
  "Couldn't have said it better myself",
];

const REPULSE_QUOTES = [
  "This 👆 absolutely this.",
  "Adding my thoughts to this thread...",
  "Had to share this gem 💎",
  "More people need to see this",
  "Dropping this here for later",
  "🔥🔥🔥",
  "Thread of the day right here",
  "Saving this for reference",
];

const POLL_TEMPLATES = [
  {
    title: "Design Reach Metric",
    description: "Help us design the 7-pillar Reach algorithm - your input shapes how influence is measured!",
    type: AdvancedPollType.SURVEY,
    questions: [
      {
        text: "Which pillars should carry most weight?",
        type: PollQuestionType.MULTI_CHOICE,
        options: ["🌊 Amplitude (engagement depth)", "📡 Frequency (posting consistency)", "🎯 Resonance (viral potential)", "🔗 Connection (network building)", "⚡ Velocity (growth speed)", "💎 Authority (expertise trust)", "🔥 Momentum (sustained activity)"],
      },
      {
        text: "How fast should bad actors lose reach?",
        type: PollQuestionType.SINGLE_CHOICE,
        options: ["Instantly on violation", "Gradual decay over weeks", "Only after multiple warnings", "Never - let community self-moderate"],
      },
      {
        text: "Should verified users get a reach boost?",
        type: PollQuestionType.SCALE,
        sliderConfig: { min: 0, max: 10, labels: ["No boost", "Slight edge", "Major advantage"] },
      },
      {
        text: "What new pillar would you add?",
        type: PollQuestionType.TEXT,
      },
    ],
  },
  {
    title: "What's your preferred work setup?",
    description: "Curious about remote vs office preferences in 2026",
    type: AdvancedPollType.SURVEY,
    questions: [
      {
        text: "Where do you primarily work?",
        type: PollQuestionType.SINGLE_CHOICE,
        options: ["Fully remote", "Hybrid (2-3 days office)", "Fully in-office", "Co-working space", "Nomadic/traveling"],
      },
      {
        text: "What tools do you rely on most?",
        type: PollQuestionType.MULTI_CHOICE,
        options: ["Slack/Discord", "Notion/Confluence", "GitHub/GitLab", "Figma/Design tools", "AI assistants"],
      },
    ],
  },
  {
    title: "Tech Stack Preferences 2026",
    description: "What are developers actually using?",
    type: AdvancedPollType.SURVEY,
    questions: [
      {
        text: "Primary frontend framework?",
        type: PollQuestionType.SINGLE_CHOICE,
        options: ["React/Next.js", "Vue/Nuxt", "Svelte/SvelteKit", "Angular", "Solid/Qwik", "HTMX"],
      },
      {
        text: "How much do you use AI coding assistants?",
        type: PollQuestionType.SCALE,
        sliderConfig: { min: 0, max: 10, labels: ["Never", "Sometimes", "All the time"] },
      },
    ],
  },
  {
    title: "Quick Feedback: New Feature",
    description: "Help us prioritize what to build next",
    type: AdvancedPollType.FEEDBACK,
    questions: [
      {
        text: "How useful would dark mode scheduling be?",
        type: PollQuestionType.SCALE,
        sliderConfig: { min: 1, max: 5, labels: ["Not useful", "Somewhat", "Very useful"] },
      },
      {
        text: "Any other features you'd like?",
        type: PollQuestionType.TEXT,
      },
    ],
  },
  {
    title: "Web3 Knowledge Check",
    description: "Test your crypto knowledge!",
    type: AdvancedPollType.QUIZ,
    questions: [
      {
        text: "What does 'gas' refer to in Ethereum?",
        type: PollQuestionType.SINGLE_CHOICE,
        options: ["Transaction fees", "A type of token", "Mining power", "Network speed"],
      },
      {
        text: "What is a 'rug pull'?",
        type: PollQuestionType.SINGLE_CHOICE,
        options: ["A scam where developers abandon a project", "A type of NFT", "A trading strategy", "A wallet feature"],
      },
    ],
  },
];

// Company templates for seeding
const COMPANY_TEMPLATES = [
  { name: "TechFlow AS", description: "Modern software solutions", orgType: CompanyOrgType.AS },
  { name: "Nordic Design Studio", description: "UI/UX design and branding", orgType: CompanyOrgType.ENK },
  { name: "Green Energy Solutions DA", description: "Sustainable tech products", orgType: CompanyOrgType.DA },
  { name: "CloudForge Tech", description: "Cloud infrastructure services", orgType: CompanyOrgType.AS },
  { name: "Fjord Electronics", description: "Consumer electronics", orgType: CompanyOrgType.AS },
  { name: "Arctic Threads", description: "Sustainable clothing", orgType: CompanyOrgType.ENK },
  { name: "Digital Nomad Tools", description: "Remote work accessories", orgType: CompanyOrgType.AS },
  { name: "Northern Crafts", description: "Handmade artisan goods", orgType: CompanyOrgType.ENK },
];

// Product templates - CHEAP prices for testnet testing (ETH/SOL friendly)
// Prices in NOK for fiat, ~0.001-0.01 ETH equivalent for crypto
const PRODUCT_TEMPLATES = [
  // Digital products (cheap for testing)
  { title: "Test Digital Download", description: "Sample PDF for testing checkout flow", category: "digitale-tjenester", price: 1.0, productType: ProductType.DIGITAL },
  { title: "Dev Icon Pack", description: "50 developer-themed icons", category: "digitale-tjenester", price: 5.0, productType: ProductType.DIGITAL },
  { title: "Test Template Bundle", description: "React component templates", category: "digitale-tjenester", price: 10.0, productType: ProductType.DIGITAL },
  { title: "E-Book: Testing Guide", description: "How to test crypto payments", category: "digitale-tjenester", price: 2.5, productType: ProductType.DIGITAL },
  { title: "Audio Sample Pack", description: "Royalty-free sounds", category: "digitale-tjenester", price: 8.0, productType: ProductType.DIGITAL },
  
  // Physical products (cheap for testnet - like sticker prices)
  { title: "Dev Sticker Pack", description: "10 coding-themed stickers", category: "elektronikk", price: 15.0, productType: ProductType.PHYSICAL },
  { title: "Test USB Cable", description: "USB-C cable for testing", category: "elektronikk", price: 25.0, productType: ProductType.PHYSICAL },
  { title: "Mini Notebook", description: "Pocket notebook for devs", category: "annet", price: 20.0, productType: ProductType.PHYSICAL },
  { title: "Test Mousepad", description: "Small mousepad", category: "elektronikk", price: 35.0, productType: ProductType.PHYSICAL },
  { title: "Code Coffee Coaster", description: "Wooden coaster with code", category: "annet", price: 12.0, productType: ProductType.PHYSICAL },
  { title: "Pin Badge Set", description: "5 enamel pins - tech themes", category: "annet", price: 30.0, productType: ProductType.PHYSICAL },
  { title: "Keychain - Crypto", description: "Metal keychain with BTC logo", category: "annet", price: 18.0, productType: ProductType.PHYSICAL },
  { title: "Test Phone Stand", description: "Simple phone stand", category: "elektronikk", price: 40.0, productType: ProductType.PHYSICAL },
  
  // Hybrid products
  { title: "Course + Materials Kit", description: "Online course with physical workbook", category: "digitale-tjenester", price: 50.0, productType: ProductType.HYBRID },
  { title: "NFT + Print Bundle", description: "Digital art + physical print", category: "digitale-tjenester", price: 45.0, productType: ProductType.HYBRID },
];

// Placeholder images for products
const PRODUCT_IMAGES = [
  "https://picsum.photos/seed/prod1/400/400",
  "https://picsum.photos/seed/prod2/400/400",
  "https://picsum.photos/seed/prod3/400/400",
  "https://picsum.photos/seed/prod4/400/400",
  "https://picsum.photos/seed/prod5/400/400",
];

function generateUsername(firstName: string, lastName: string): string {
  const styles = [
    () => `${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    () => `${firstName.toLowerCase()}_${lastName.toLowerCase()}`,
    () => `${firstName.toLowerCase()}${randomInt(1, 999)}`,
    () => `the_${firstName.toLowerCase()}`,
    () => `${firstName.toLowerCase()}.${lastName.slice(0, 3).toLowerCase()}`,
  ];
  return randomItem(styles)();
}

function generateEmail(username: string): string {
  const domains = ['gmail.com', 'outlook.com', 'protonmail.com', 'hey.com', 'icloud.com'];
  return `${username}@${randomItem(domains)}`;
}

function randomDate(daysBack: number): Date {
  const now = new Date();
  const past = new Date(now.getTime() - randomInt(0, daysBack) * 24 * 60 * 60 * 1000);
  past.setHours(randomInt(0, 23), randomInt(0, 59), randomInt(0, 59));
  return past;
}

async function main() {
  console.log("🌱 Starting activity seed...\n");

  // ─── CREATE USERS ─────────────────────────────────────────────────────────
  console.log(`📝 Creating ${NUM_USERS} users...`);
  const createdUsers: { id: string; name: string }[] = [];

  for (let i = 0; i < NUM_USERS; i++) {
    const firstName = randomItem(FIRST_NAMES);
    const lastName = randomItem(LAST_NAMES);
    const name = `${firstName} ${lastName}`;
    const username = generateUsername(firstName, lastName);
    const email = generateEmail(username);
    const createdAt = randomDate(365);

    try {
      const user = await prisma.user.create({
        data: {
          name,
          email,
          bio: randomItem(BIOS),
          emailVerified: Math.random() > 0.3 ? createdAt : null,
          image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
          banner: Math.random() > 0.5 ? `https://picsum.photos/seed/${username}/1200/400` : null,
          createdAt,
          verificationTier: randomItem([UserVerificationTier.ANONYMOUS, UserVerificationTier.WEB2_BASIC, UserVerificationTier.SOCIAL_BASIC]),
        },
      });
      createdUsers.push({ id: user.id, name: user.name ?? email });
      process.stdout.write('.');
    } catch (e: any) {
      // Duplicate email, skip
      console.log(`\\n  Error creating user ${email}: ${e.message?.slice(0, 100)}`);
      process.stdout.write('x');
    }
  }
  console.log(`\n✅ Created ${createdUsers.length} users\n`);

  if (createdUsers.length < 2) {
    console.log("❌ Not enough users created. Exiting.");
    await prisma.$disconnect();
    return;
  }

  // ─── CREATE COMPANIES ─────────────────────────────────────────────────────
  console.log(`📝 Creating ${NUM_COMPANIES} companies...`);
  const createdCompanies: { id: string; ownerId: string; name: string }[] = [];

  for (let i = 0; i < Math.min(NUM_COMPANIES, COMPANY_TEMPLATES.length); i++) {
    const template = COMPANY_TEMPLATES[i];
    const owner = createdUsers[i % createdUsers.length]; // Distribute among first users
    const createdAt = randomDate(180);

    try {
      const company = await prisma.company.create({
        data: {
          name: template.name,
          description: template.description,
          orgNumber: `${900000000 + randomInt(10000, 99999)}`, // Fake org number
          orgType: template.orgType,
          creatorId: owner.id,
          ownerId: owner.id,
          usesShipping: Math.random() > 0.3, // 70% use shipping
          logo: [`https://api.dicebear.com/7.x/identicon/svg?seed=${template.name}`],
          colorScheme: randomItem(['blue', 'green', 'purple', 'orange', 'slate']),
          createdAt,
        },
      });
      createdCompanies.push({ id: company.id, ownerId: owner.id, name: company.name });

      // Create employee record for owner
      await prisma.employee.create({
        data: {
          companyId: company.id,
          userId: owner.id,
          role: EmployeeRole.OWNER,
          permissions: { all: true, manage: true, products: true, orders: true, employees: true },
          createdAt,
        },
      });

      process.stdout.write('.');
    } catch (e: any) {
      console.log(`\n  Company error: ${e.message?.slice(0, 80)}`);
      process.stdout.write('x');
    }
  }
  console.log(`\n✅ Created ${createdCompanies.length} companies\n`);

  // ─── CREATE PRODUCTS ──────────────────────────────────────────────────────
  console.log(`📝 Creating ${NUM_PRODUCTS} products (testnet-friendly prices)...`);
  const createdProducts: { id: string; companyId: string | null; title: string }[] = [];

  for (let i = 0; i < NUM_PRODUCTS; i++) {
    const template = PRODUCT_TEMPLATES[i % PRODUCT_TEMPLATES.length];
    // Assign to company or individual user
    const useCompany = Math.random() > 0.3 && createdCompanies.length > 0;
    const company = useCompany ? randomItem(createdCompanies) : null;
    const seller = company ? createdUsers.find(u => u.id === company.ownerId)! : randomItem(createdUsers);
    
    // Variation in price (±30%)
    const basePrice = template.price;
    const variation = basePrice * (0.7 + Math.random() * 0.6);
    const finalPrice = Math.round(variation * 100) / 100;

    try {
      const product = await prisma.product.create({
        data: {
          title: i < PRODUCT_TEMPLATES.length ? template.title : `${template.title} v${Math.floor(i / PRODUCT_TEMPLATES.length) + 1}`,
          description: template.description,
          category: template.category,
          price: finalPrice,
          priceCurrency: FiatCurrency.NOK,
          acceptedFiatCurrencies: [FiatCurrency.NOK, FiatCurrency.USD, FiatCurrency.EUR],
          stock: randomInt(5, 100),
          shipFromPostalId: randomItem(['0001', '5003', '7010', '4006', '6002']), // Norwegian postal codes
          image: [randomItem(PRODUCT_IMAGES), randomItem(PRODUCT_IMAGES)],
          condition: randomItem([ProductCondition.NEW, ProductCondition.NEW, ProductCondition.AS_NEW]),
          productType: template.productType,
          userId: seller.id,
          companyId: company?.id ?? null,
          freeShippingEnabled: template.productType === ProductType.DIGITAL,
          createdAt: randomDate(90),
          specifications: {
            testProduct: true,
            testnetFriendly: true,
            priceInETH: finalPrice / 35000, // Rough NOK/ETH conversion
          },
          features: [
            { text: "Testnet-friendly pricing" },
            { text: "Supports crypto payments" },
            template.productType === ProductType.DIGITAL ? { text: "Instant delivery" } : { text: "Ships in 3-5 days" },
          ],
        },
      });
      createdProducts.push({ id: product.id, companyId: company?.id ?? null, title: product.title });
      process.stdout.write('.');
    } catch (e: any) {
      console.log(`\n  Product error: ${e.message?.slice(0, 80)}`);
      process.stdout.write('x');
    }
  }
  console.log(`\n✅ Created ${createdProducts.length} products\n`);

  // ─── CREATE CONVERSATIONS/PULSES ─────────────────────────────────────────
  console.log(`📝 Creating ${NUM_CONVERSATIONS} conversations/pulses...`);
  const createdConversations: { id: string; userId: string }[] = [];

  for (let i = 0; i < NUM_CONVERSATIONS; i++) {
    const author = randomItem(createdUsers);
    const createdAt = randomDate(90);

    try {
      const convo = await prisma.conversation.create({
        data: {
          userId: author.id,
          type: ConversationType.PUBLIC_THREAD,
          visibility: ConversationVisibility.PUBLIC,
          title: randomItem(PULSE_CONTENT),
          createdAt,
          lastActivityAt: createdAt,
          viewCount: randomInt(0, 500),
          uniqueViewCount: randomInt(0, 200),
        },
      });
      createdConversations.push({ id: convo.id, userId: convo.userId });
      process.stdout.write('.');
    } catch (e: any) {
      // Only log the first error in full detail
      if (createdConversations.length === 0 && i === 0) {
        console.log(`\\n  FULL Convo error: ${e.message}`);
      }
      process.stdout.write('x');
    }
  }
  console.log(`\n✅ Created ${createdConversations.length} conversations\n`);

  // ─── CREATE MESSAGES (REPLIES) WITH DEEP NESTING ──────────────────────────
  console.log(`📝 Creating messages/replies with deep nesting...`);
  let messageCount = 0;
  const createdMessages: { id: string; conversationId: string; senderId: string; depth: number }[] = [];

  // Thread-style conversation content for deeper nesting
  const THREAD_STARTERS = [
    "This is exactly what I've been thinking about!",
    "Controversial opinion: I disagree completely",
    "Has anyone else experienced this?",
    "Building on this idea...",
    "Wait, can we talk about this more?",
  ];
  const REPLY_RESPONSES = [
    "100% agree with this take",
    "I see your point, but consider...",
    "This is the real answer right here",
    "Replying to add some context",
    "Great point! Adding to this...",
    "Not sure I follow - can you explain?",
    "This changes everything",
  ];

  for (const convo of createdConversations.slice(0, 30)) {
    const numMessages = randomInt(4, NUM_MESSAGES_PER_CONVO + 4);
    const repliers = new Set<string>();
    const convoMessages: typeof createdMessages = [];

    for (let i = 0; i < numMessages; i++) {
      const author = randomItem(createdUsers);
      repliers.add(author.id);
      
      // Smart nesting: first few are root, then progressively more nested
      let parentId: string | null = null;
      let depth = 0;
      
      if (i === 0) {
        // First message is always root
        parentId = null;
        depth = 0;
      } else if (i < 3) {
        // Messages 1-2 are usually root or direct replies
        const shouldNest = Math.random() > 0.4;
        if (shouldNest && convoMessages.length > 0) {
          const rootMsgs = convoMessages.filter(m => m.depth === 0);
          if (rootMsgs.length > 0) {
            const parent = randomItem(rootMsgs);
            parentId = parent.id;
            depth = 1;
          }
        }
      } else {
        // Later messages create deeper threads (up to depth 4)
        const maxExistingDepth = Math.max(...convoMessages.map(m => m.depth));
        const targetDepth = Math.min(maxExistingDepth + 1, 4);
        
        // 70% chance to reply to something, 30% new root
        if (Math.random() > 0.3) {
          // Prefer replying to recent or deep messages
          const potentialParents = convoMessages.filter(m => m.depth < 4);
          if (potentialParents.length > 0) {
            // Bias towards more recent messages (last 5) or deepest threads
            const recentOrDeep = potentialParents.filter(
              m => convoMessages.indexOf(m) > convoMessages.length - 5 || m.depth >= 2
            );
            const parent = recentOrDeep.length > 0 ? randomItem(recentOrDeep) : randomItem(potentialParents);
            parentId = parent.id;
            depth = parent.depth + 1;
          }
        }
      }

      // Pick content based on depth
      const content = depth === 0 
        ? randomItem(THREAD_STARTERS)
        : depth === 1 
          ? randomItem(REPLY_RESPONSES) 
          : randomItem(MESSAGE_CONTENT);

      try {
        const msg = await prisma.message.create({
          data: {
            conversationId: convo.id,
            senderId: author.id,
            content,
            parentId,
            createdAt: randomDate(30),
            updatedAt: new Date(),
          },
        });
        const msgData = { id: msg.id, conversationId: convo.id, senderId: author.id, depth };
        createdMessages.push(msgData);
        convoMessages.push(msgData);
        messageCount++;
        process.stdout.write('.');
      } catch (e) {
        process.stdout.write('x');
      }
    }

    // Update reply counts
    await prisma.conversation.update({
      where: { id: convo.id },
      data: {
        replyCount: numMessages,
        uniqueRepliers: repliers.size,
        lastActivityAt: new Date(),
      },
    });
  }
  console.log(`\n✅ Created ${messageCount} messages (with deep nesting up to 4 levels)\n`);

  // ─── CREATE REPULSES (QUOTE POSTS) ────────────────────────────────────────
  console.log(`📝 Creating ${NUM_REPULSES} repulses (quote posts)...`);
  let repulseCount = 0;

  for (let i = 0; i < NUM_REPULSES; i++) {
    const author = randomItem(createdUsers);
    const originalPulse = randomItem(createdConversations);
    
    // Don't quote your own pulse
    if (originalPulse.userId === author.id) continue;

    try {
      const repulse = await prisma.conversation.create({
        data: {
          userId: author.id,
          type: ConversationType.PUBLIC_THREAD,
          visibility: ConversationVisibility.PUBLIC,
          title: randomItem(REPULSE_QUOTES),
          repostOfConversationId: originalPulse.id,
          createdAt: randomDate(30),
          lastActivityAt: randomDate(7),
          viewCount: randomInt(5, 100),
        },
      });
      
      // Update the original's repulse count
      await prisma.conversation.update({
        where: { id: originalPulse.id },
        data: { repulseCount: { increment: 1 } },
      });
      
      repulseCount++;
      createdConversations.push({ id: repulse.id, userId: author.id });
      process.stdout.write('.');
    } catch (e) {
      process.stdout.write('x');
    }
  }
  console.log(`\n✅ Created ${repulseCount} repulses\n`);

  // ─── CREATE ADVANCED POLLS ────────────────────────────────────────────────
  console.log(`📝 Creating ${NUM_ADVANCED_POLLS} advanced polls...`);
  let pollCount = 0;

  for (let i = 0; i < Math.min(NUM_ADVANCED_POLLS, POLL_TEMPLATES.length * 2); i++) {
    const template = POLL_TEMPLATES[i % POLL_TEMPLATES.length];
    const author = randomItem(createdUsers);
    
    // Create a conversation for the poll
    try {
      const convo = await prisma.conversation.create({
        data: {
          userId: author.id,
          type: ConversationType.PUBLIC_THREAD,
          visibility: ConversationVisibility.PUBLIC,
          title: `📊 ${template.title}`,
          description: template.description,
          createdAt: randomDate(60),
          lastActivityAt: randomDate(14),
        },
      });
      
      // Create the advanced poll
      const poll = await prisma.advancedPoll.create({
        data: {
          title: template.title,
          description: template.description,
          type: template.type,
          creatorId: author.id,
          conversationId: convo.id,
          isAnonymous: Math.random() > 0.7,
          publishedAt: randomDate(30),
        },
      });
      
      // Create questions
      for (let qIdx = 0; qIdx < template.questions.length; qIdx++) {
        const q = template.questions[qIdx] as any;
        const question = await prisma.pollQuestion.create({
          data: {
            advancedPollId: poll.id,
            text: q.text,
            type: q.type,
            order: qIdx,
            isRequired: true,
            sliderConfig: q.sliderConfig ? q.sliderConfig : undefined,
          },
        });
        
        // Create options for choice questions
        if (q.options && (q.type === PollQuestionType.SINGLE_CHOICE || q.type === PollQuestionType.MULTI_CHOICE)) {
          for (let oIdx = 0; oIdx < q.options.length; oIdx++) {
            await prisma.pollQuestionOption.create({
              data: {
                questionId: question.id,
                text: q.options[oIdx],
                order: oIdx,
              },
            });
          }
        }
      }
      
      createdConversations.push({ id: convo.id, userId: author.id });
      pollCount++;
      process.stdout.write('.');
    } catch (e: any) {
      console.log(`\n  Poll error: ${e.message?.slice(0, 100)}`);
      process.stdout.write('x');
    }
  }
  console.log(`\n✅ Created ${pollCount} advanced polls\n`);

  // ─── CREATE FOLLOWS ──────────────────────────────────────────────────────
  console.log(`📝 Creating ${NUM_FOLLOWS} follow relationships...`);
  let followCount = 0;

  for (let i = 0; i < NUM_FOLLOWS; i++) {
    const [follower, following] = randomSubset(createdUsers, 2);
    if (follower.id === following.id) continue;

    try {
      await prisma.follow.create({
        data: {
          followerId: follower.id,
          followingId: following.id,
          createdAt: randomDate(180),
          updatedAt: new Date(),
        },
      });
      followCount++;
      process.stdout.write('.');
    } catch (e) {
      // Duplicate follow, skip
      process.stdout.write('x');
    }
  }
  console.log(`\n✅ Created ${followCount} follows\n`);

  // ─── CREATE ENGAGEMENT EVENTS ────────────────────────────────────────────
  console.log(`📝 Creating ${NUM_ENGAGEMENT_EVENTS} engagement events...`);
  let eventCount = 0;

  const engagementTypes = [
    EngagementType.CLICK,
    EngagementType.HEARTBEAT,
    EngagementType.SHARE_EXTERNAL,
    EngagementType.COMMENT_SHORT,
    EngagementType.COMMENT_LONG,
    EngagementType.SAVE_BOOKMARK,
    EngagementType.REPULSE,
    EngagementType.PROFILE_FOLLOW,
  ];

  for (let i = 0; i < NUM_ENGAGEMENT_EVENTS; i++) {
    const actor = randomItem(createdUsers);
    const convo = randomItem(createdConversations);
    const eventType = randomItem(engagementTypes);

    try {
      await prisma.engagementEvent.create({
        data: {
          eventType: eventType,
          userId: actor.id,
          conversationId: convo.id,
          strength: randomFloat(0.1, 2.0),
          createdAt: randomDate(30),
        },
      });
      eventCount++;
      process.stdout.write('.');
    } catch (e) {
      process.stdout.write('x');
    }
  }
  console.log(`\n✅ Created ${eventCount} engagement events\n`);

  // ─── CREATE PULSES ───────────────────────────────────────────────────────
  console.log(`📝 Creating pulses (likes/vibes)...`);
  let pulseCount = 0;

  for (const convo of createdConversations.slice(0, 30)) {
    const numPulses = randomInt(0, 15);
    for (let i = 0; i < numPulses; i++) {
      const user = randomItem(createdUsers);

      try {
        await prisma.pulse.create({
          data: {
            conversationId: convo.id,
            userId: user.id,
            type: Math.random() > 0.1 ? PulseType.POSITIVE : PulseType.NEGATIVE,
            createdAt: randomDate(30),
          },
        });
        pulseCount++;
        process.stdout.write('.');
      } catch (e) {
        // Duplicate pulse, skip
        process.stdout.write('x');
      }
    }
  }
  console.log(`\n✅ Created ${pulseCount} pulses\n`);

  // ─── SUMMARY ─────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(50));
  console.log("🎉 SEED COMPLETE!");
  console.log("═".repeat(50));
  console.log(`👥 Users:         ${createdUsers.length}`);
  console.log(`🏢 Companies:     ${createdCompanies.length}`);
  console.log(`📦 Products:      ${createdProducts.length} (testnet prices)`);
  console.log(`💬 Conversations: ${createdConversations.length}`);
  console.log(`📩 Messages:      ${messageCount} (with deep nested threads)`);
  console.log(`🔁 Repulses:      ${repulseCount}`);
  console.log(`📊 Polls:         ${pollCount}`);
  console.log(`🔗 Follows:       ${followCount}`);
  console.log(`📈 Engagements:   ${eventCount}`);
  console.log(`❤️  Pulses:        ${pulseCount}`);
  console.log("═".repeat(50));
  console.log("💡 Test mode: Products priced for Sepolia/testnet");
  console.log("   Use Sepolia ETH or SOL devnet for payments");
  console.log("═".repeat(50) + "\n");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("❌ Seed failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
