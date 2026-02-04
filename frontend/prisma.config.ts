import { defineConfig } from "prisma/config";
import path from "node:path";
import dotenv from "dotenv";

// Load .env file
dotenv.config({ path: path.resolve(__dirname, ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});
