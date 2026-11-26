-- AlterTable
ALTER TABLE "Place" ADD COLUMN     "availabilityNote" TEXT,
ADD COLUMN     "menu" TEXT,
ADD COLUMN     "menuUrl" TEXT,
ADD COLUMN     "roomTypes" TEXT NOT NULL DEFAULT '[]';
