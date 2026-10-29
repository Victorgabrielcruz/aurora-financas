BEGIN;
-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'tag',
    "parentId" TEXT,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryBudget" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "CategoryBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "categoryId" TEXT,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "note" TEXT NOT NULL DEFAULT '',
    "fixed" BOOLEAN NOT NULL DEFAULT false,
    "recurrence" TEXT,
    "recurrenceKey" TEXT,
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCard" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "CreditCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPurchase" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "fixed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CardPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardInstallment" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "CardInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCardInvoice" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "closingDate" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,

    CONSTRAINT "CreditCardInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoicePayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TEXT NOT NULL,

    CONSTRAINT "InvoicePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "note" TEXT NOT NULL DEFAULT '',
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentOperation" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "transactionId" TEXT,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "costBasis" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentValuation" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "operationCount" INTEGER NOT NULL DEFAULT 0,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentValuation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Account_tenantId_idx" ON "Account"("tenantId");

-- CreateIndex
CREATE INDEX "Category_userId_idx" ON "Category"("userId");

-- CreateIndex
CREATE INDEX "Category_tenantId_idx" ON "Category"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryBudget_categoryId_month_key" ON "CategoryBudget"("categoryId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_recurrenceKey_key" ON "Transaction"("recurrenceKey");

-- CreateIndex
CREATE INDEX "Transaction_accountId_date_idx" ON "Transaction"("accountId", "date");

-- CreateIndex
CREATE INDEX "Transaction_categoryId_date_idx" ON "Transaction"("categoryId", "date");

-- CreateIndex
CREATE INDEX "CreditCard_userId_idx" ON "CreditCard"("userId");

-- CreateIndex
CREATE INDEX "CreditCard_tenantId_idx" ON "CreditCard"("tenantId");

-- CreateIndex
CREATE INDEX "CardPurchase_cardId_date_idx" ON "CardPurchase"("cardId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CardInstallment_purchaseId_number_key" ON "CardInstallment"("purchaseId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "CreditCardInvoice_cardId_month_key" ON "CreditCardInvoice"("cardId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "InvoicePayment_transactionId_key" ON "InvoicePayment"("transactionId");

-- CreateIndex
CREATE INDEX "Investment_userId_idx" ON "Investment"("userId");

-- CreateIndex
CREATE INDEX "Investment_tenantId_idx" ON "Investment"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentOperation_transactionId_key" ON "InvestmentOperation"("transactionId");

-- CreateIndex
CREATE INDEX "InvestmentOperation_investmentId_date_idx" ON "InvestmentOperation"("investmentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentOperation_investmentId_position_key" ON "InvestmentOperation"("investmentId", "position");

-- CreateIndex
CREATE INDEX "InvestmentValuation_investmentId_date_idx" ON "InvestmentValuation"("investmentId", "date");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryBudget" ADD CONSTRAINT "CategoryBudget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPurchase" ADD CONSTRAINT "CardPurchase_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPurchase" ADD CONSTRAINT "CardPurchase_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardInstallment" ADD CONSTRAINT "CardInstallment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "CardPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardInstallment" ADD CONSTRAINT "CardInstallment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CreditCardInvoice"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCardInvoice" ADD CONSTRAINT "CreditCardInvoice_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CreditCardInvoice"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentOperation" ADD CONSTRAINT "InvestmentOperation_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentOperation" ADD CONSTRAINT "InvestmentOperation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentValuation" ADD CONSTRAINT "InvestmentValuation_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Financial invariants, ported from SQLite validation triggers.
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_financial_check" CHECK ("amount" > 0 AND "amount" <= 2000000000 AND TRUE AND "type" IN ('INCOME','EXPENSE','TRANSFER_IN','TRANSFER_OUT','INVESTMENT_IN','INVESTMENT_OUT','INVOICE_PAYMENT','ADJUSTMENT_IN','ADJUSTMENT_OUT') AND "status" IN ('PLANNED','CONFIRMED'));
ALTER TABLE "CardPurchase" ADD CONSTRAINT "CardPurchase_financial_check" CHECK ("amount" > 0 AND TRUE );
ALTER TABLE "CardInstallment" ADD CONSTRAINT "CardInstallment_financial_check" CHECK ("amount" > 0 AND TRUE AND "number">0);
ALTER TABLE "InvoicePayment" ADD CONSTRAINT "InvoicePayment_financial_check" CHECK ("amount" > 0 AND TRUE );
ALTER TABLE "InvestmentOperation" ADD CONSTRAINT "InvestmentOperation_financial_check" CHECK ("amount" > 0 AND "costBasis">=0 AND "position">0 AND "type" IN ('DEPOSIT','WITHDRAW'));
ALTER TABLE "InvestmentValuation" ADD CONSTRAINT "InvestmentValuation_financial_check" CHECK ("amount" >= 0 AND TRUE AND "operationCount">=0);
ALTER TABLE "CategoryBudget" ADD CONSTRAINT "CategoryBudget_financial_check" CHECK ("amount">0 AND TRUE );
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_financial_check" CHECK ("limit">0 AND "closingDay" BETWEEN 1 AND 31 AND "dueDay" BETWEEN 1 AND 31);
ALTER TABLE "Category" ADD CONSTRAINT "Category_financial_check" CHECK ("type" IN ('INCOME','EXPENSE') AND ("parentId" IS NULL OR "parentId" != "id"));
ALTER TABLE "Account" ADD CONSTRAINT "Account_financial_check" CHECK (TRUE AND "type" IN ('CHECKING','SAVINGS','CASH','OTHER'));

-- Tenant ownership and immutable financial history.
CREATE FUNCTION "Account_tenant_insert_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "tenantId" FROM "User" WHERE "id"=NEW."userId") IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Account_tenant_insert" BEFORE INSERT ON "Account"
FOR EACH ROW EXECUTE FUNCTION "Account_tenant_insert_fn"();

CREATE FUNCTION "Account_tenant_update_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "tenantId" FROM "User" WHERE "id"=NEW."userId") IS DISTINCT FROM NEW."tenantId" OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Account_tenant_update" BEFORE UPDATE ON "Account"
FOR EACH ROW EXECUTE FUNCTION "Account_tenant_update_fn"();

CREATE FUNCTION "Category_tenant_insert_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "tenantId" FROM "User" WHERE "id"=NEW."userId") IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Category_tenant_insert" BEFORE INSERT ON "Category"
FOR EACH ROW EXECUTE FUNCTION "Category_tenant_insert_fn"();

CREATE FUNCTION "Category_tenant_update_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "tenantId" FROM "User" WHERE "id"=NEW."userId") IS DISTINCT FROM NEW."tenantId" OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Category_tenant_update" BEFORE UPDATE ON "Category"
FOR EACH ROW EXECUTE FUNCTION "Category_tenant_update_fn"();

CREATE FUNCTION "CreditCard_tenant_insert_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "tenantId" FROM "User" WHERE "id"=NEW."userId") IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CreditCard_tenant_insert" BEFORE INSERT ON "CreditCard"
FOR EACH ROW EXECUTE FUNCTION "CreditCard_tenant_insert_fn"();

CREATE FUNCTION "CreditCard_tenant_update_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "tenantId" FROM "User" WHERE "id"=NEW."userId") IS DISTINCT FROM NEW."tenantId" OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CreditCard_tenant_update" BEFORE UPDATE ON "CreditCard"
FOR EACH ROW EXECUTE FUNCTION "CreditCard_tenant_update_fn"();

CREATE FUNCTION "Investment_tenant_insert_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "tenantId" FROM "User" WHERE "id"=NEW."userId") IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Investment_tenant_insert" BEFORE INSERT ON "Investment"
FOR EACH ROW EXECUTE FUNCTION "Investment_tenant_insert_fn"();

CREATE FUNCTION "Investment_tenant_update_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "tenantId" FROM "User" WHERE "id"=NEW."userId") IS DISTINCT FROM NEW."tenantId" OR NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Investment_tenant_update" BEFORE UPDATE ON "Investment"
FOR EACH ROW EXECUTE FUNCTION "Investment_tenant_update_fn"();

CREATE FUNCTION "User_tenant_immutable_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NEW."tenantId" IS DISTINCT FROM OLD."tenantId" THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "User_tenant_immutable" BEFORE UPDATE ON "User"
FOR EACH ROW EXECUTE FUNCTION "User_tenant_immutable_fn"();

CREATE FUNCTION "Category_relations_tenant_insert_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NEW."parentId" IS DISTINCT FROM NULL AND (SELECT "tenantId" FROM "Category" WHERE "id"=NEW."parentId") IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Category_relations_tenant_insert" BEFORE INSERT ON "Category"
FOR EACH ROW EXECUTE FUNCTION "Category_relations_tenant_insert_fn"();

CREATE FUNCTION "Category_relations_tenant_update_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NEW."parentId" IS DISTINCT FROM NULL AND (SELECT "tenantId" FROM "Category" WHERE "id"=NEW."parentId") IS DISTINCT FROM NEW."tenantId" THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Category_relations_tenant_update" BEFORE UPDATE ON "Category"
FOR EACH ROW EXECUTE FUNCTION "Category_relations_tenant_update_fn"();

CREATE FUNCTION "Transaction_relations_tenant_insert_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NEW."categoryId" IS DISTINCT FROM NULL AND (SELECT "tenantId" FROM "Category" WHERE "id"=NEW."categoryId") IS DISTINCT FROM (SELECT "tenantId" FROM "Account" WHERE "id"=NEW."accountId") THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Transaction_relations_tenant_insert" BEFORE INSERT ON "Transaction"
FOR EACH ROW EXECUTE FUNCTION "Transaction_relations_tenant_insert_fn"();

CREATE FUNCTION "Transaction_relations_tenant_update_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NEW."categoryId" IS DISTINCT FROM NULL AND (SELECT "tenantId" FROM "Category" WHERE "id"=NEW."categoryId") IS DISTINCT FROM (SELECT "tenantId" FROM "Account" WHERE "id"=NEW."accountId") THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Transaction_relations_tenant_update" BEFORE UPDATE ON "Transaction"
FOR EACH ROW EXECUTE FUNCTION "Transaction_relations_tenant_update_fn"();

CREATE FUNCTION "CardPurchase_relations_tenant_insert_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "tenantId" FROM "Category" WHERE "id"=NEW."categoryId") IS DISTINCT FROM (SELECT "tenantId" FROM "CreditCard" WHERE "id"=NEW."cardId") THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CardPurchase_relations_tenant_insert" BEFORE INSERT ON "CardPurchase"
FOR EACH ROW EXECUTE FUNCTION "CardPurchase_relations_tenant_insert_fn"();

CREATE FUNCTION "CardPurchase_relations_tenant_update_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "tenantId" FROM "Category" WHERE "id"=NEW."categoryId") IS DISTINCT FROM (SELECT "tenantId" FROM "CreditCard" WHERE "id"=NEW."cardId") THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CardPurchase_relations_tenant_update" BEFORE UPDATE ON "CardPurchase"
FOR EACH ROW EXECUTE FUNCTION "CardPurchase_relations_tenant_update_fn"();

CREATE FUNCTION "CardInstallment_relations_tenant_insert_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "cardId" FROM "CardPurchase" WHERE "id"=NEW."purchaseId") IS DISTINCT FROM (SELECT "cardId" FROM "CreditCardInvoice" WHERE "id"=NEW."invoiceId") THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CardInstallment_relations_tenant_insert" BEFORE INSERT ON "CardInstallment"
FOR EACH ROW EXECUTE FUNCTION "CardInstallment_relations_tenant_insert_fn"();

CREATE FUNCTION "CardInstallment_relations_tenant_update_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "cardId" FROM "CardPurchase" WHERE "id"=NEW."purchaseId") IS DISTINCT FROM (SELECT "cardId" FROM "CreditCardInvoice" WHERE "id"=NEW."invoiceId") THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CardInstallment_relations_tenant_update" BEFORE UPDATE ON "CardInstallment"
FOR EACH ROW EXECUTE FUNCTION "CardInstallment_relations_tenant_update_fn"();

CREATE FUNCTION "InvoicePayment_relations_tenant_insert_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT a."tenantId" FROM "Account" a JOIN "Transaction" t ON t."accountId"=a."id" WHERE t."id"=NEW."transactionId") IS DISTINCT FROM (SELECT c."tenantId" FROM "CreditCard" c JOIN "CreditCardInvoice" i ON i."cardId"=c."id" WHERE i."id"=NEW."invoiceId") THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "InvoicePayment_relations_tenant_insert" BEFORE INSERT ON "InvoicePayment"
FOR EACH ROW EXECUTE FUNCTION "InvoicePayment_relations_tenant_insert_fn"();

CREATE FUNCTION "InvoicePayment_relations_tenant_update_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT a."tenantId" FROM "Account" a JOIN "Transaction" t ON t."accountId"=a."id" WHERE t."id"=NEW."transactionId") IS DISTINCT FROM (SELECT c."tenantId" FROM "CreditCard" c JOIN "CreditCardInvoice" i ON i."cardId"=c."id" WHERE i."id"=NEW."invoiceId") THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "InvoicePayment_relations_tenant_update" BEFORE UPDATE ON "InvoicePayment"
FOR EACH ROW EXECUTE FUNCTION "InvoicePayment_relations_tenant_update_fn"();

CREATE FUNCTION "InvestmentOperation_relations_tenant_insert_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NEW."transactionId" IS DISTINCT FROM NULL AND (SELECT a."tenantId" FROM "Account" a JOIN "Transaction" t ON t."accountId"=a."id" WHERE t."id"=NEW."transactionId") IS DISTINCT FROM (SELECT "tenantId" FROM "Investment" WHERE "id"=NEW."investmentId") THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "InvestmentOperation_relations_tenant_insert" BEFORE INSERT ON "InvestmentOperation"
FOR EACH ROW EXECUTE FUNCTION "InvestmentOperation_relations_tenant_insert_fn"();

CREATE FUNCTION "InvestmentOperation_relations_tenant_update_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NEW."transactionId" IS DISTINCT FROM NULL AND (SELECT a."tenantId" FROM "Account" a JOIN "Transaction" t ON t."accountId"=a."id" WHERE t."id"=NEW."transactionId") IS DISTINCT FROM (SELECT "tenantId" FROM "Investment" WHERE "id"=NEW."investmentId") THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "InvestmentOperation_relations_tenant_update" BEFORE UPDATE ON "InvestmentOperation"
FOR EACH ROW EXECUTE FUNCTION "InvestmentOperation_relations_tenant_update_fn"();

CREATE FUNCTION "Transaction_parent_tenant_immutable_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "tenantId" FROM "Account" WHERE "id"=NEW."accountId") IS DISTINCT FROM (SELECT "tenantId" FROM "Account" WHERE "id"=OLD."accountId") THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Transaction_parent_tenant_immutable" BEFORE UPDATE ON "Transaction"
FOR EACH ROW EXECUTE FUNCTION "Transaction_parent_tenant_immutable_fn"();

CREATE FUNCTION "CardPurchase_parent_tenant_immutable_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "tenantId" FROM "CreditCard" WHERE "id"=NEW."cardId") IS DISTINCT FROM (SELECT "tenantId" FROM "CreditCard" WHERE "id"=OLD."cardId") THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CardPurchase_parent_tenant_immutable" BEFORE UPDATE ON "CardPurchase"
FOR EACH ROW EXECUTE FUNCTION "CardPurchase_parent_tenant_immutable_fn"();

CREATE FUNCTION "CreditCardInvoice_parent_tenant_immutable_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "tenantId" FROM "CreditCard" WHERE "id"=NEW."cardId") IS DISTINCT FROM (SELECT "tenantId" FROM "CreditCard" WHERE "id"=OLD."cardId") THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CreditCardInvoice_parent_tenant_immutable" BEFORE UPDATE ON "CreditCardInvoice"
FOR EACH ROW EXECUTE FUNCTION "CreditCardInvoice_parent_tenant_immutable_fn"();

CREATE FUNCTION "CategoryBudget_parent_tenant_immutable_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "tenantId" FROM "Category" WHERE "id"=NEW."categoryId") IS DISTINCT FROM (SELECT "tenantId" FROM "Category" WHERE "id"=OLD."categoryId") THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "CategoryBudget_parent_tenant_immutable" BEFORE UPDATE ON "CategoryBudget"
FOR EACH ROW EXECUTE FUNCTION "CategoryBudget_parent_tenant_immutable_fn"();

CREATE FUNCTION "InvestmentOperation_parent_tenant_immutable_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "tenantId" FROM "Investment" WHERE "id"=NEW."investmentId") IS DISTINCT FROM (SELECT "tenantId" FROM "Investment" WHERE "id"=OLD."investmentId") THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "InvestmentOperation_parent_tenant_immutable" BEFORE UPDATE ON "InvestmentOperation"
FOR EACH ROW EXECUTE FUNCTION "InvestmentOperation_parent_tenant_immutable_fn"();

CREATE FUNCTION "InvestmentValuation_parent_tenant_immutable_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF (SELECT "tenantId" FROM "Investment" WHERE "id"=NEW."investmentId") IS DISTINCT FROM (SELECT "tenantId" FROM "Investment" WHERE "id"=OLD."investmentId") THEN
    RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "InvestmentValuation_parent_tenant_immutable" BEFORE UPDATE ON "InvestmentValuation"
FOR EACH ROW EXECUTE FUNCTION "InvestmentValuation_parent_tenant_immutable_fn"();

COMMIT;


