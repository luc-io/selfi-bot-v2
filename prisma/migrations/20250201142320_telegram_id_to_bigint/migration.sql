-- Drop UserParameters table first
DROP TABLE IF EXISTS "UserParameters";

-- Safe conversion of telegramId to BIGINT
-- First, create a temporary column
ALTER TABLE "User" ADD COLUMN "telegramId_new" BIGINT;

-- Copy data from the old column to the new one, converting the string to bigint
UPDATE "User" SET "telegramId_new" = CAST("telegramId" AS BIGINT);

-- Drop the old column and recreate with new type
ALTER TABLE "User" DROP CONSTRAINT "User_telegramId_key";
ALTER TABLE "User" DROP COLUMN "telegramId";
ALTER TABLE "User" RENAME COLUMN "telegramId_new" TO "telegramId";

-- Add back the unique constraint
ALTER TABLE "User" ADD CONSTRAINT "User_telegramId_key" UNIQUE ("telegramId");

-- Set the NOT NULL constraint
ALTER TABLE "User" ALTER COLUMN "telegramId" SET NOT NULL;