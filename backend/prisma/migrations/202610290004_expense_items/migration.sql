ALTER TABLE "Transaction" ADD COLUMN "items" JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof("items") = 'array');
ALTER TABLE "CardPurchase" ADD COLUMN "items" JSONB NOT NULL DEFAULT '[]' CHECK (jsonb_typeof("items") = 'array');
