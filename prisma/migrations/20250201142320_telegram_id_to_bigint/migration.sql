-- Create BaseModelType enum if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'baseModelType') THEN
        CREATE TYPE "BaseModelType" AS ENUM ('FLUX', 'FLUX_FAST', 'FLUX_PORTRAIT');
    END IF;
END $$;

-- Create BaseModel table if it doesn't exist
CREATE TABLE IF NOT EXISTS "BaseModel" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "type" "BaseModelType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BaseModel_pkey" PRIMARY KEY ("id")
);

-- Create User table if it doesn't exist
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "totalSpentStars" INTEGER NOT NULL DEFAULT 0,
    "totalBoughtStars" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Create unique index on User.telegramId
CREATE UNIQUE INDEX IF NOT EXISTS "User_telegramId_key" ON "User"("telegramId");

-- Clean up any existing UserParameters table
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'UserParameters_userId_fkey'
    ) THEN
        ALTER TABLE "UserParameters" DROP CONSTRAINT "UserParameters_userId_fkey";
    END IF;

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