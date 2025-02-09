-- AlterTable
ALTER TABLE "LoraModel" ADD COLUMN "isSelected" BOOLEAN NOT NULL DEFAULT false;
-- CreateIndex
CREATE INDEX "LoraModel_isSelected_idx" ON "LoraModel"("isSelected");