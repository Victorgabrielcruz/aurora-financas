-- Existing income continues to use its receipt date's month when no reference is set.
ALTER TABLE "Transaction" ADD COLUMN "referenceMonth" TEXT;
