-- Start with defensive cleanup
DO $$ BEGIN
    -- Check and drop foreign key if exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserParameters_userId_fkey'
    ) THEN
        ALTER TABLE "UserParameters" DROP CONSTRAINT "UserParameters_userId_fkey";
    END IF;

    -- Check and drop table if exists
    IF EXISTS (
        SELECT 1 FROM pg_tables WHERE tablename = 'UserParameters'
    ) THEN
        DROP TABLE "UserParameters";
    END IF;
END $$;

-- Create UserParameters table
CREATE TABLE "UserParameters" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserParameters_pkey" PRIMARY KEY ("id")
);

-- Create unique index on UserParameters.userId
CREATE UNIQUE INDEX "UserParameters_userId_key" ON "UserParameters"("userId");

-- Add foreign key constraint for UserParameters
ALTER TABLE "UserParameters"
ADD CONSTRAINT "UserParameters_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Safe conversion of telegramId to BIGINT
-- First, check and drop the old telegramId constraint if it exists
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'User_telegramId_key'
    ) THEN
        ALTER TABLE "User" DROP CONSTRAINT "User_telegramId_key";
    END IF;
END $$;

-- Create temporary column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_attribute 
        WHERE attrelid = 'User'::regclass 
        AND attname = 'telegramId_new'
        AND NOT attisdropped
    ) THEN
        ALTER TABLE "User" ADD COLUMN "telegramId_new" BIGINT;
    END IF;
END $$;

-- Copy data from the old column to the new one, converting the string to bigint
UPDATE "User" SET "telegramId_new" = CAST("telegramId" AS BIGINT)
WHERE "telegramId_new" IS NULL;

-- Drop the old column and rename the new one
ALTER TABLE "User" DROP COLUMN "telegramId";
ALTER TABLE "User" RENAME COLUMN "telegramId_new" TO "telegramId";

-- Add back the constraints
ALTER TABLE "User" ALTER COLUMN "telegramId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramId_key" ON "User"("telegramId");