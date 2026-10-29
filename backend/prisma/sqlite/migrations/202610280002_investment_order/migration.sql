-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InvestmentOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "investmentId" TEXT NOT NULL,
    "transactionId" TEXT,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "costBasis" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestmentOperation_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InvestmentOperation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InvestmentOperation" ("amount", "costBasis", "createdAt", "date", "id", "investmentId", "transactionId", "type", "position") SELECT "amount", "costBasis", "createdAt", "date", "id", "investmentId", "transactionId", "type", ROW_NUMBER() OVER (PARTITION BY "investmentId" ORDER BY "date", "createdAt", "id") FROM "InvestmentOperation";
DROP TABLE "InvestmentOperation";
ALTER TABLE "new_InvestmentOperation" RENAME TO "InvestmentOperation";
CREATE UNIQUE INDEX "InvestmentOperation_transactionId_key" ON "InvestmentOperation"("transactionId");
CREATE INDEX "InvestmentOperation_investmentId_date_idx" ON "InvestmentOperation"("investmentId", "date");
CREATE UNIQUE INDEX "InvestmentOperation_investmentId_position_key" ON "InvestmentOperation"("investmentId", "position");
CREATE TABLE "new_InvestmentValuation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "investmentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "operationCount" INTEGER NOT NULL DEFAULT 0,
    "date" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestmentValuation_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InvestmentValuation" ("amount", "createdAt", "date", "id", "investmentId") SELECT "amount", "createdAt", "date", "id", "investmentId" FROM "InvestmentValuation";
DROP TABLE "InvestmentValuation";
ALTER TABLE "new_InvestmentValuation" RENAME TO "InvestmentValuation";
CREATE INDEX "InvestmentValuation_investmentId_date_idx" ON "InvestmentValuation"("investmentId", "date");
UPDATE "InvestmentValuation" SET "operationCount" = (SELECT COUNT(*) FROM "InvestmentOperation" o WHERE o."investmentId"="InvestmentValuation"."investmentId" AND (o."date" < "InvestmentValuation"."date" OR (o."date"="InvestmentValuation"."date" AND o."createdAt" <= "InvestmentValuation"."createdAt")));
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

