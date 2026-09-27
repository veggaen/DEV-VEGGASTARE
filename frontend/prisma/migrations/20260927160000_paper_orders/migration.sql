-- Paper terminal: resting limit / stop orders for the virtual portfolio.
CREATE TYPE "PaperOrderSide" AS ENUM ('BUY', 'SELL');
CREATE TYPE "PaperOrderType" AS ENUM ('LIMIT', 'STOP');
CREATE TYPE "PaperOrderStatus" AS ENUM ('OPEN', 'FILLED', 'CANCELLED', 'FAILED');

CREATE TABLE "PaperOrder" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "side" "PaperOrderSide" NOT NULL,
    "type" "PaperOrderType" NOT NULL,
    "status" "PaperOrderStatus" NOT NULL DEFAULT 'OPEN',
    "tokenSymbol" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL DEFAULT '0x0',
    "chainId" INTEGER NOT NULL DEFAULT 1,
    "decimals" INTEGER NOT NULL DEFAULT 18,
    "amount" DOUBLE PRECISION NOT NULL,
    "triggerPrice" DOUBLE PRECISION NOT NULL,
    "leverage" INTEGER NOT NULL DEFAULT 1,
    "filledPriceUsd" DOUBLE PRECISION,
    "filledAt" TIMESTAMP(3),
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaperOrder_portfolioId_status_idx" ON "PaperOrder"("portfolioId", "status");

ALTER TABLE "PaperOrder" ADD CONSTRAINT "PaperOrder_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "PaperPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
