-- Rename ID fields to be more explicit
ALTER TABLE "User" RENAME COLUMN "id" TO "databaseId";

-- Update foreign key references
ALTER TABLE "UserParameters" RENAME COLUMN "userId" TO "userDatabaseId";
ALTER TABLE "LoraModel" RENAME COLUMN "userId" TO "userDatabaseId";
ALTER TABLE "Training" RENAME COLUMN "userId" TO "userDatabaseId";
ALTER TABLE "Generation" RENAME COLUMN "userId" TO "userDatabaseId";
ALTER TABLE "StarTransaction" RENAME COLUMN "userId" TO "userDatabaseId";

-- Update the references to maintain relationships
ALTER TABLE "UserParameters" 
DROP CONSTRAINT IF EXISTS "UserParameters_userId_fkey",
ADD CONSTRAINT "UserParameters_userDatabaseId_fkey" 
FOREIGN KEY ("userDatabaseId") REFERENCES "User"("databaseId");

ALTER TABLE "LoraModel" 
DROP CONSTRAINT IF EXISTS "LoraModel_userId_fkey",
ADD CONSTRAINT "LoraModel_userDatabaseId_fkey" 
FOREIGN KEY ("userDatabaseId") REFERENCES "User"("databaseId");

ALTER TABLE "Training" 
DROP CONSTRAINT IF EXISTS "Training_userId_fkey",
ADD CONSTRAINT "Training_userDatabaseId_fkey" 
FOREIGN KEY ("userDatabaseId") REFERENCES "User"("databaseId");

ALTER TABLE "Generation" 
DROP CONSTRAINT IF EXISTS "Generation_userId_fkey",
ADD CONSTRAINT "Generation_userDatabaseId_fkey" 
FOREIGN KEY ("userDatabaseId") REFERENCES "User"("databaseId");

ALTER TABLE "StarTransaction" 
DROP CONSTRAINT IF EXISTS "StarTransaction_userId_fkey",
ADD CONSTRAINT "StarTransaction_userDatabaseId_fkey" 
FOREIGN KEY ("userDatabaseId") REFERENCES "User"("databaseId");

-- Update indexes to use new column names
DROP INDEX IF EXISTS "Generation_userId_idx";
CREATE INDEX "Generation_userDatabaseId_idx" ON "Generation"("userDatabaseId");

DROP INDEX IF EXISTS "Training_userId_idx";
CREATE INDEX "Training_userDatabaseId_idx" ON "Training"("userDatabaseId");

DROP INDEX IF EXISTS "StarTransaction_userId_idx";
CREATE INDEX "StarTransaction_userDatabaseId_idx" ON "StarTransaction"("userDatabaseId");

DROP INDEX IF EXISTS "LoraModel_userId_idx";
CREATE INDEX "LoraModel_userDatabaseId_idx" ON "LoraModel"("userDatabaseId");