/**
 * Database Export Script
 * 
 * Exports all data from your Neon database to JSON files.
 * Run with: npx ts-node scripts/export-database.ts
 * 
 * Or via npm script: npm run db:export
 */

import 'dotenv/config'
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg'
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL_MAINLIVE!, ssl: { rejectUnauthorized: false } })
const prisma = new PrismaClient({ adapter });

const EXPORT_DIR = path.join(__dirname, '..', 'database-backups');

async function exportDatabase() {
  console.log('🚀 Starting database export...\n');

  // Create backup directory
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const backupDir = path.join(EXPORT_DIR, `backup-${timestamp}`);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const exportData: Record<string, any[]> = {};

  try {
    // Export each table - order matters for foreign keys!
    console.log('📦 Exporting tables...\n');

    // Users first (most things depend on User)
    const users = await prisma.user.findMany();
    exportData.User = users;
    console.log(`  ✓ User: ${users.length} records`);

    const accounts = await prisma.account.findMany();
    exportData.Account = accounts;
    console.log(`  ✓ Account: ${accounts.length} records`);

    const companies = await prisma.company.findMany();
    exportData.Company = companies;
    console.log(`  ✓ Company: ${companies.length} records`);

    const employees = await prisma.employee.findMany();
    exportData.Employee = employees;
    console.log(`  ✓ Employee: ${employees.length} records`);

    const products = await prisma.product.findMany();
    exportData.Product = products;
    console.log(`  ✓ Product: ${products.length} records`);

    const carts = await prisma.cart.findMany();
    exportData.Cart = carts;
    console.log(`  ✓ Cart: ${carts.length} records`);

    const cartItems = await prisma.cartItem.findMany();
    exportData.CartItem = cartItems;
    console.log(`  ✓ CartItem: ${cartItems.length} records`);

    const conversations = await prisma.conversation.findMany();
    exportData.Conversation = conversations;
    console.log(`  ✓ Conversation: ${conversations.length} records`);

    const messages = await prisma.message.findMany();
    exportData.Message = messages;
    console.log(`  ✓ Message: ${messages.length} records`);

    const orders = await prisma.order.findMany();
    exportData.Order = orders;
    console.log(`  ✓ Order: ${orders.length} records`);

    const wallets = await prisma.wallet.findMany();
    exportData.Wallet = wallets;
    console.log(`  ✓ Wallet: ${wallets.length} records`);

    const warehouseLocations = await prisma.warehouseLocation.findMany();
    exportData.WarehouseLocation = warehouseLocations;
    console.log(`  ✓ WarehouseLocation: ${warehouseLocations.length} records`);

    const inventory = await prisma.inventory.findMany();
    exportData.Inventory = inventory;
    console.log(`  ✓ Inventory: ${inventory.length} records`);

    const sales = await prisma.sale.findMany();
    exportData.Sale = sales;
    console.log(`  ✓ Sale: ${sales.length} records`);

    const follows = await prisma.follow.findMany();
    exportData.Follow = follows;
    console.log(`  ✓ Follow: ${follows.length} records`);

    const friendships = await prisma.friendship.findMany();
    exportData.Friendship = friendships;
    console.log(`  ✓ Friendship: ${friendships.length} records`);

    const friendRequests = await prisma.friendRequest.findMany();
    exportData.FriendRequest = friendRequests;
    console.log(`  ✓ FriendRequest: ${friendRequests.length} records`);

    const pulses = await prisma.pulse.findMany();
    exportData.Pulse = pulses;
    console.log(`  ✓ Pulse: ${pulses.length} records`);

    const polls = await prisma.poll.findMany();
    exportData.Poll = polls;
    console.log(`  ✓ Poll: ${polls.length} records`);

    const pollOptions = await prisma.pollOption.findMany();
    exportData.PollOption = pollOptions;
    console.log(`  ✓ PollOption: ${pollOptions.length} records`);

    const pollVotes = await prisma.pollVote.findMany();
    exportData.PollVote = pollVotes;
    console.log(`  ✓ PollVote: ${pollVotes.length} records`);

    const reviews = await prisma.review.findMany();
    exportData.Review = reviews;
    console.log(`  ✓ Review: ${reviews.length} records`);

    const jobRequests = await prisma.jobRequest.findMany();
    exportData.JobRequest = jobRequests;
    console.log(`  ✓ JobRequest: ${jobRequests.length} records`);

    const packages = await prisma.package.findMany();
    exportData.Package = packages;
    console.log(`  ✓ Package: ${packages.length} records`);

    const payments = await prisma.payment.findMany();
    exportData.Payment = payments;
    console.log(`  ✓ Payment: ${payments.length} records`);

    const shippingDetails = await prisma.shippingDetails.findMany();
    exportData.ShippingDetails = shippingDetails;
    console.log(`  ✓ ShippingDetails: ${shippingDetails.length} records`);

    const specificationsDetails = await prisma.specificationsDetails.findMany();
    exportData.SpecificationsDetails = specificationsDetails;
    console.log(`  ✓ SpecificationsDetails: ${specificationsDetails.length} records`);

    const userPrivacySettings = await prisma.userPrivacySettings.findMany();
    exportData.UserPrivacySettings = userPrivacySettings;
    console.log(`  ✓ UserPrivacySettings: ${userPrivacySettings.length} records`);

    const conversationViews = await prisma.conversationView.findMany();
    exportData.ConversationView = conversationViews;
    console.log(`  ✓ ConversationView: ${conversationViews.length} records`);

    const conversationReposts = await prisma.conversationRepost.findMany();
    exportData.ConversationRepost = conversationReposts;
    console.log(`  ✓ ConversationRepost: ${conversationReposts.length} records`);

    const viewEvents = await prisma.viewEvent.findMany();
    exportData.ViewEvent = viewEvents;
    console.log(`  ✓ ViewEvent: ${viewEvents.length} records`);

    const monthlyReports = await prisma.monthlyReport.findMany();
    exportData.MonthlyReport = monthlyReports;
    console.log(`  ✓ MonthlyReport: ${monthlyReports.length} records`);

    const employeeTerminations = await prisma.employeeTermination.findMany();
    exportData.EmployeeTermination = employeeTerminations;
    console.log(`  ✓ EmployeeTermination: ${employeeTerminations.length} records`);

    // Write full backup to single file
    const fullBackupPath = path.join(backupDir, 'full-backup.json');
    fs.writeFileSync(fullBackupPath, JSON.stringify(exportData, null, 2));
    
    // Also write individual table files for easier inspection
    for (const [tableName, data] of Object.entries(exportData)) {
      const tablePath = path.join(backupDir, `${tableName}.json`);
      fs.writeFileSync(tablePath, JSON.stringify(data, null, 2));
    }

    console.log(`\n✅ Export complete!`);
    console.log(`📁 Backup saved to: ${backupDir}`);
    console.log(`📄 Full backup: ${fullBackupPath}`);
    
    // Summary
    const totalRecords = Object.values(exportData).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`\n📊 Summary: ${Object.keys(exportData).length} tables, ${totalRecords} total records`);

  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

exportDatabase();
