-- AlterTable
ALTER TABLE "User" ADD COLUMN     "coverImage" TEXT,
ADD COLUMN     "nearbyMode" TEXT NOT NULL DEFAULT 'OFF',
ADD COLUMN     "notificationPrefs" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "profileFields" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "username" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "subjectId" TEXT,
ADD COLUMN     "subjectType" TEXT,
ALTER COLUMN "tripDateId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "chatEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verification" TEXT NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "chatEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verification" TEXT NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Community" ADD COLUMN     "accessType" TEXT NOT NULL DEFAULT 'FREE',
ADD COLUMN     "chatEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "membershipBenefits" TEXT,
ADD COLUMN     "membershipCurrency" TEXT,
ADD COLUMN     "membershipPeriod" TEXT,
ADD COLUMN     "membershipPrice" INTEGER,
ADD COLUMN     "membershipTerms" TEXT;

-- AlterTable
ALTER TABLE "CommunityMember" ADD COLUMN     "message" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "OrganiserApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "country" TEXT,
    "city" TEXT,
    "categories" TEXT NOT NULL DEFAULT '[]',
    "approvedCategories" TEXT NOT NULL DEFAULT '[]',
    "hasExperience" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "links" TEXT,
    "agreedRules" BOOLEAN NOT NULL DEFAULT false,
    "identityCheck" TEXT,
    "identityCheckedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "reviewNotes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganiserApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pass" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "listingType" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "location" TEXT,
    "qr" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "checkedInAt" TIMESTAMP(3),
    "checkedInById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassScan" (
    "id" TEXT NOT NULL,
    "passId" TEXT,
    "attempted" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "scannedById" TEXT NOT NULL,
    "offline" BOOLEAN NOT NULL DEFAULT false,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganiserApplication_userId_idx" ON "OrganiserApplication"("userId");

-- CreateIndex
CREATE INDEX "OrganiserApplication_status_idx" ON "OrganiserApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Pass_reference_key" ON "Pass"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Pass_token_key" ON "Pass"("token");

-- CreateIndex
CREATE INDEX "Pass_userId_idx" ON "Pass"("userId");

-- CreateIndex
CREATE INDEX "Pass_listingType_listingId_idx" ON "Pass"("listingType", "listingId");

-- CreateIndex
CREATE UNIQUE INDEX "Pass_subjectType_subjectId_key" ON "Pass"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "PassScan_passId_idx" ON "PassScan"("passId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_subjectType_subjectId_key" ON "Conversation"("subjectType", "subjectId");

-- AddForeignKey
ALTER TABLE "PassScan" ADD CONSTRAINT "PassScan_passId_fkey" FOREIGN KEY ("passId") REFERENCES "Pass"("id") ON DELETE SET NULL ON UPDATE CASCADE;
