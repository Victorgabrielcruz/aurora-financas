ALTER TABLE "Transaction" ADD COLUMN "items" JSONB NOT NULL DEFAULT '[]' CHECK (json_valid("items") AND json_type("items") = 'array');
ALTER TABLE "CardPurchase" ADD COLUMN "items" JSONB NOT NULL DEFAULT '[]' CHECK (json_valid("items") AND json_type("items") = 'array');
