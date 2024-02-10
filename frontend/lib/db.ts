/** 
 * PRISMA database client
 * @description Prisma Database Client
*/

import { PrismaClient } from '@prisma/client'

declare global {
    var prisma: PrismaClient | undefined // define prisma in global namespace to avoid circular dependency issues with nextjs hotreload in dev environments.
}

export const dbPrisma = globalThis.prisma || new PrismaClient(); // prevents a downwards spiral of client spawning/SPAMMING on NEXTJS HOT-Reload 

if (process.env.NODE_ENV !== 'production') globalThis.prisma = dbPrisma;


/**
 * MONGODB Database Client
 * @description MONGODB Database
*/ 
import { MongoClient } from "mongodb/mongodb";


const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

declare global {
    var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
        client = new MongoClient(uri, options);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
} else {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
}

export const dbMongo = clientPromise;