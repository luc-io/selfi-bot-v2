-- Create BaseModel table if it doesn't exist
CREATE TABLE IF NOT EXISTS "BaseModel" (
    "databaseId" TEXT NOT NULL,
    "modelPath" TEXT NOT NULL,
    "costPerGeneration" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "BaseModel_pkey" PRIMARY KEY ("databaseId"),
    CONSTRAINT "BaseModel_modelPath_key" UNIQUE ("modelPath")
);

-- Create UserParameters table
CREATE TABLE "UserParameters" (
    "databaseId" TEXT NOT NULL,
    "userDatabaseId" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserParameters_pkey" PRIMARY KEY ("databaseId"),
    CONSTRAINT "UserParameters_userDatabaseId_key" UNIQUE ("userDatabaseId"),
    CONSTRAINT "UserParameters_userDatabaseId_fkey" FOREIGN KEY ("userDatabaseId") REFERENCES "User"("databaseId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "BaseModel_modelPath_idx" ON "BaseModel"("modelPath");