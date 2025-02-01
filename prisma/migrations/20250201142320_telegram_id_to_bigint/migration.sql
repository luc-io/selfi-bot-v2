-- Create UserParameters table
CREATE TABLE IF NOT EXISTS "UserParameters" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserParameters_pkey" PRIMARY KEY ("id")
);

-- Create unique index on UserParameters.userId
CREATE UNIQUE INDEX IF NOT EXISTS "UserParameters_userId_key" ON "UserParameters"("userId");

-- Add foreign key constraint for UserParameters
ALTER TABLE "UserParameters"
ADD CONSTRAINT "UserParameters_userId_fkey"
FOREIGN KEY ("userId")
REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Safe conversion of telegramId to BIGINT
-- First, create a temporary column
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "telegramId_new" BIGINT;

-- Copy data from the old column to the new one, converting the string to bigint
UPDATE "User" SET "telegramId_new" = CAST("telegramId" AS BIGINT);

-- Drop the old constraints if they exist
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'User_telegramId_key'
    ) THEN
        ALTER TABLE "User" DROP CONSTRAINT "User_telegramId_key";
    END IF;
END $$;

-- Drop the old column and rename the new one
ALTER TABLE "User" DROP COLUMN "telegramId";
ALTER TABLE "User" RENAME COLUMN "telegramId_new" TO "telegramId";

-- Add back the constraints
ALTER TABLE "User" ALTER COLUMN "telegramId" SET NOT NULL;
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");