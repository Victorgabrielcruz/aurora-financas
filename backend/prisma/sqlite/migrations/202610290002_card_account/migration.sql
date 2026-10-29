ALTER TABLE "CreditCard" ADD COLUMN "accountId" TEXT REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "CreditCard_accountId_idx" ON "CreditCard"("accountId");
CREATE TRIGGER "CreditCard_account_tenant_insert" BEFORE INSERT ON "CreditCard"
WHEN NEW."accountId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Account" WHERE "id"=NEW."accountId" AND "tenantId"=NEW."tenantId")
BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
CREATE TRIGGER "CreditCard_account_tenant_update" BEFORE UPDATE ON "CreditCard"
WHEN NEW."accountId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Account" WHERE "id"=NEW."accountId" AND "tenantId"=NEW."tenantId")
BEGIN SELECT RAISE(ABORT, 'Tenant isolation violation'); END;
