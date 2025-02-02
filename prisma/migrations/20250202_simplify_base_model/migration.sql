-- Drop old enums and columns
DROP TYPE IF EXISTS "BaseModelType";

-- Recreate BaseModel table
ALTER TABLE "BaseModel" 
  DROP COLUMN IF EXISTS "type",
  DROP COLUMN IF EXISTS "name",
  DROP COLUMN IF EXISTS "version",
  DROP COLUMN IF EXISTS "isDefault",
  ADD COLUMN "modelPath" TEXT NOT NULL,
  ADD COLUMN "costPerGeneration" INTEGER NOT NULL DEFAULT 1;

-- Add unique constraint to modelPath
ALTER TABLE "BaseModel" ADD CONSTRAINT "BaseModel_modelPath_key" UNIQUE ("modelPath");