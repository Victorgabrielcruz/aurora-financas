BEGIN;
ALTER TABLE "CreditCard" ADD COLUMN "accountId" TEXT;
CREATE INDEX "CreditCard_accountId_idx" ON "CreditCard"("accountId");
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
CREATE FUNCTION "CreditCard_account_tenant_fn"() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
 IF NEW."accountId" IS NOT NULL AND (SELECT "tenantId" FROM "Account" WHERE "id"=NEW."accountId") IS DISTINCT FROM NEW."tenantId" THEN
  RAISE EXCEPTION 'Tenant isolation violation' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER "CreditCard_account_tenant" BEFORE INSERT OR UPDATE ON "CreditCard"
FOR EACH ROW EXECUTE FUNCTION "CreditCard_account_tenant_fn"();
COMMIT;
