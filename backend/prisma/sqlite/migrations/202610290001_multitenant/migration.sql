-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Preserve existing owners and all resource IDs. Each owner receives a personal tenant.
INSERT INTO "Tenant" ("id", "name", "createdAt") SELECT 'tenant_' || "id", 'Finanças de ' || "name", "createdAt" FROM "User";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "initialBalance" INTEGER NOT NULL,
    "referenceDate" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#0e8063',
    "icon" TEXT NOT NULL DEFAULT 'wallet',
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Account_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Account" ("active", "color", "demo", "icon", "id", "initialBalance", "institution", "name", "referenceDate", "type", "userId", "tenantId") SELECT "active", "color", "demo", "icon", "id", "initialBalance", "institution", "name", "referenceDate", "type", "userId", 'tenant_' || "userId" FROM "Account";
DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE INDEX "Account_tenantId_idx" ON "Account"("tenantId");
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'tag',
    "parentId" TEXT,
    CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Category" ("color", "icon", "id", "name", "parentId", "type", "userId", "tenantId") SELECT "color", "icon", "id", "name", "parentId", "type", "userId", 'tenant_' || "userId" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE INDEX "Category_userId_idx" ON "Category"("userId");
CREATE INDEX "Category_tenantId_idx" ON "Category"("tenantId");
CREATE TABLE "new_CreditCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "lastFour" TEXT NOT NULL DEFAULT '',
    "limit" INTEGER NOT NULL,
    "closingDay" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CreditCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CreditCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CreditCard" ("active", "brand", "closingDay", "color", "demo", "dueDay", "id", "institution", "lastFour", "limit", "name", "userId", "tenantId") SELECT "active", "brand", "closingDay", "color", "demo", "dueDay", "id", "institution", "lastFour", "limit", "name", "userId", 'tenant_' || "userId" FROM "CreditCard";
DROP TABLE "CreditCard";
ALTER TABLE "new_CreditCard" RENAME TO "CreditCard";
CREATE INDEX "CreditCard_userId_idx" ON "CreditCard"("userId");
CREATE INDEX "CreditCard_tenantId_idx" ON "CreditCard"("tenantId");
CREATE TABLE "new_Investment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "quantity" REAL,
    "note" TEXT NOT NULL DEFAULT '',
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Investment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Investment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Investment" ("active", "class", "demo", "id", "institution", "name", "note", "quantity", "userId", "tenantId") SELECT "active", "class", "demo", "id", "institution", "name", "note", "quantity", "userId", 'tenant_' || "userId" FROM "Investment";
DROP TABLE "Investment";
ALTER TABLE "new_Investment" RENAME TO "Investment";
CREATE INDEX "Investment_userId_idx" ON "Investment"("userId");
CREATE INDEX "Investment_tenantId_idx" ON "Investment"("tenantId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "passwordHash", "theme", "tenantId") SELECT "createdAt", "email", "id", "name", "passwordHash", "theme", 'tenant_' || "id" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE TRIGGER "CreditCard_validate_insert" BEFORE INSERT ON "CreditCard" WHEN NOT (NEW."limit">0 AND NEW."closingDay" BETWEEN 1 AND 31 AND NEW."dueDay" BETWEEN 1 AND 31) BEGIN SELECT RAISE(ABORT, 'Invalid financial record'); END;
CREATE TRIGGER "CreditCard_validate_update" BEFORE UPDATE ON "CreditCard" WHEN NOT (NEW."limit">0 AND NEW."closingDay" BETWEEN 1 AND 31 AND NEW."dueDay" BETWEEN 1 AND 31) BEGIN SELECT RAISE(ABORT, 'Invalid financial record'); END;
CREATE TRIGGER "Category_validate_insert" BEFORE INSERT ON "Category" WHEN NOT (NEW."type" IN ('INCOME','EXPENSE') AND (NEW."parentId" IS NULL OR NEW."parentId" != NEW."id")) BEGIN SELECT RAISE(ABORT, 'Invalid financial record'); END;
CREATE TRIGGER "Category_validate_update" BEFORE UPDATE ON "Category" WHEN NOT (NEW."type" IN ('INCOME','EXPENSE') AND (NEW."parentId" IS NULL OR NEW."parentId" != NEW."id")) BEGIN SELECT RAISE(ABORT, 'Invalid financial record'); END;
CREATE TRIGGER "Account_validate_insert" BEFORE INSERT ON "Account" WHEN NOT (typeof(NEW."initialBalance")='integer' AND NEW."type" IN ('CHECKING','SAVINGS','CASH','OTHER')) BEGIN SELECT RAISE(ABORT, 'Invalid financial record'); END;
CREATE TRIGGER "Account_validate_update" BEFORE UPDATE ON "Account" WHEN NOT (typeof(NEW."initialBalance")='integer' AND NEW."type" IN ('CHECKING','SAVINGS','CASH','OTHER')) BEGIN SELECT RAISE(ABORT, 'Invalid financial record'); END;

-- Enforce tenant ownership and prevent moving financial history between tenants.
CREATE TRIGGER "Account_tenant_insert" BEFORE INSERT ON "Account" WHEN (SELECT "tenantId" FROM "User" WHERE "id"=NEW."userId") IS NOT NEW."tenantId" BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "Account_tenant_update" BEFORE UPDATE ON "Account" WHEN (SELECT "tenantId" FROM "User" WHERE "id"=NEW."userId") IS NOT NEW."tenantId" OR NEW."tenantId" IS NOT OLD."tenantId" BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "Category_tenant_insert" BEFORE INSERT ON "Category" WHEN (SELECT "tenantId" FROM "User" WHERE "id"=NEW."userId") IS NOT NEW."tenantId" BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "Category_tenant_update" BEFORE UPDATE ON "Category" WHEN (SELECT "tenantId" FROM "User" WHERE "id"=NEW."userId") IS NOT NEW."tenantId" OR NEW."tenantId" IS NOT OLD."tenantId" BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "CreditCard_tenant_insert" BEFORE INSERT ON "CreditCard" WHEN (SELECT "tenantId" FROM "User" WHERE "id"=NEW."userId") IS NOT NEW."tenantId" BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "CreditCard_tenant_update" BEFORE UPDATE ON "CreditCard" WHEN (SELECT "tenantId" FROM "User" WHERE "id"=NEW."userId") IS NOT NEW."tenantId" OR NEW."tenantId" IS NOT OLD."tenantId" BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "Investment_tenant_insert" BEFORE INSERT ON "Investment" WHEN (SELECT "tenantId" FROM "User" WHERE "id"=NEW."userId") IS NOT NEW."tenantId" BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "Investment_tenant_update" BEFORE UPDATE ON "Investment" WHEN (SELECT "tenantId" FROM "User" WHERE "id"=NEW."userId") IS NOT NEW."tenantId" OR NEW."tenantId" IS NOT OLD."tenantId" BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "User_tenant_immutable" BEFORE UPDATE OF "tenantId" ON "User" WHEN NEW."tenantId" IS NOT OLD."tenantId" BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "Category_relations_tenant_insert" BEFORE INSERT ON "Category" WHEN NEW."parentId" IS NOT NULL AND (SELECT "tenantId" FROM "Category" WHERE "id"=NEW."parentId") IS NOT NEW."tenantId" BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "Category_relations_tenant_update" BEFORE UPDATE ON "Category" WHEN NEW."parentId" IS NOT NULL AND (SELECT "tenantId" FROM "Category" WHERE "id"=NEW."parentId") IS NOT NEW."tenantId" BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "Transaction_relations_tenant_insert" BEFORE INSERT ON "Transaction" WHEN NEW."categoryId" IS NOT NULL AND (SELECT "tenantId" FROM "Category" WHERE "id"=NEW."categoryId") IS NOT (SELECT "tenantId" FROM "Account" WHERE "id"=NEW."accountId") BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "Transaction_relations_tenant_update" BEFORE UPDATE ON "Transaction" WHEN NEW."categoryId" IS NOT NULL AND (SELECT "tenantId" FROM "Category" WHERE "id"=NEW."categoryId") IS NOT (SELECT "tenantId" FROM "Account" WHERE "id"=NEW."accountId") BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "CardPurchase_relations_tenant_insert" BEFORE INSERT ON "CardPurchase" WHEN (SELECT "tenantId" FROM "Category" WHERE "id"=NEW."categoryId") IS NOT (SELECT "tenantId" FROM "CreditCard" WHERE "id"=NEW."cardId") BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "CardPurchase_relations_tenant_update" BEFORE UPDATE ON "CardPurchase" WHEN (SELECT "tenantId" FROM "Category" WHERE "id"=NEW."categoryId") IS NOT (SELECT "tenantId" FROM "CreditCard" WHERE "id"=NEW."cardId") BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "CardInstallment_relations_tenant_insert" BEFORE INSERT ON "CardInstallment" WHEN (SELECT "cardId" FROM "CardPurchase" WHERE "id"=NEW."purchaseId") IS NOT (SELECT "cardId" FROM "CreditCardInvoice" WHERE "id"=NEW."invoiceId") BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "CardInstallment_relations_tenant_update" BEFORE UPDATE ON "CardInstallment" WHEN (SELECT "cardId" FROM "CardPurchase" WHERE "id"=NEW."purchaseId") IS NOT (SELECT "cardId" FROM "CreditCardInvoice" WHERE "id"=NEW."invoiceId") BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "InvoicePayment_relations_tenant_insert" BEFORE INSERT ON "InvoicePayment" WHEN (SELECT a."tenantId" FROM "Account" a JOIN "Transaction" t ON t."accountId"=a."id" WHERE t."id"=NEW."transactionId") IS NOT (SELECT c."tenantId" FROM "CreditCard" c JOIN "CreditCardInvoice" i ON i."cardId"=c."id" WHERE i."id"=NEW."invoiceId") BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "InvoicePayment_relations_tenant_update" BEFORE UPDATE ON "InvoicePayment" WHEN (SELECT a."tenantId" FROM "Account" a JOIN "Transaction" t ON t."accountId"=a."id" WHERE t."id"=NEW."transactionId") IS NOT (SELECT c."tenantId" FROM "CreditCard" c JOIN "CreditCardInvoice" i ON i."cardId"=c."id" WHERE i."id"=NEW."invoiceId") BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "InvestmentOperation_relations_tenant_insert" BEFORE INSERT ON "InvestmentOperation" WHEN NEW."transactionId" IS NOT NULL AND (SELECT a."tenantId" FROM "Account" a JOIN "Transaction" t ON t."accountId"=a."id" WHERE t."id"=NEW."transactionId") IS NOT (SELECT "tenantId" FROM "Investment" WHERE "id"=NEW."investmentId") BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "InvestmentOperation_relations_tenant_update" BEFORE UPDATE ON "InvestmentOperation" WHEN NEW."transactionId" IS NOT NULL AND (SELECT a."tenantId" FROM "Account" a JOIN "Transaction" t ON t."accountId"=a."id" WHERE t."id"=NEW."transactionId") IS NOT (SELECT "tenantId" FROM "Investment" WHERE "id"=NEW."investmentId") BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "Transaction_parent_tenant_immutable" BEFORE UPDATE OF "accountId" ON "Transaction" WHEN (SELECT "tenantId" FROM "Account" WHERE "id"=NEW."accountId") IS NOT (SELECT "tenantId" FROM "Account" WHERE "id"=OLD."accountId") BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "CardPurchase_parent_tenant_immutable" BEFORE UPDATE OF "cardId" ON "CardPurchase" WHEN (SELECT "tenantId" FROM "CreditCard" WHERE "id"=NEW."cardId") IS NOT (SELECT "tenantId" FROM "CreditCard" WHERE "id"=OLD."cardId") BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "CreditCardInvoice_parent_tenant_immutable" BEFORE UPDATE OF "cardId" ON "CreditCardInvoice" WHEN (SELECT "tenantId" FROM "CreditCard" WHERE "id"=NEW."cardId") IS NOT (SELECT "tenantId" FROM "CreditCard" WHERE "id"=OLD."cardId") BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "CategoryBudget_parent_tenant_immutable" BEFORE UPDATE OF "categoryId" ON "CategoryBudget" WHEN (SELECT "tenantId" FROM "Category" WHERE "id"=NEW."categoryId") IS NOT (SELECT "tenantId" FROM "Category" WHERE "id"=OLD."categoryId") BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "InvestmentOperation_parent_tenant_immutable" BEFORE UPDATE OF "investmentId" ON "InvestmentOperation" WHEN (SELECT "tenantId" FROM "Investment" WHERE "id"=NEW."investmentId") IS NOT (SELECT "tenantId" FROM "Investment" WHERE "id"=OLD."investmentId") BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "InvestmentValuation_parent_tenant_immutable" BEFORE UPDATE OF "investmentId" ON "InvestmentValuation" WHEN (SELECT "tenantId" FROM "Investment" WHERE "id"=NEW."investmentId") IS NOT (SELECT "tenantId" FROM "Investment" WHERE "id"=OLD."investmentId") BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
