-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "depositAmount" INTEGER;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT';

-- AlterTable
ALTER TABLE "Community" ADD COLUMN     "institution" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'COMMUNITY',
ADD COLUMN     "meetingPoint" TEXT,
ADD COLUMN     "meetingVerified" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'IN_PERSON',
ADD COLUMN     "official" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "schedule" TEXT,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "topic" TEXT;

-- AlterTable
ALTER TABLE "CommunityMember" ADD COLUMN     "mutedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PaymentReceipt" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "methodName" TEXT NOT NULL,
    "payerPhone" TEXT,
    "transactionRef" TEXT,
    "fileAssetId" TEXT,
    "fileFormat" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "reply" TEXT NOT NULL DEFAULT '',
    "actions" TEXT NOT NULL DEFAULT '[]',
    "pending" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistantEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReceipt_reference_key" ON "PaymentReceipt"("reference");

-- CreateIndex
CREATE INDEX "PaymentReceipt_status_idx" ON "PaymentReceipt"("status");

-- CreateIndex
CREATE INDEX "PaymentReceipt_bookingId_idx" ON "PaymentReceipt"("bookingId");

-- CreateIndex
CREATE INDEX "AssistantEntry_userId_createdAt_idx" ON "AssistantEntry"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentReceipt" ADD CONSTRAINT "PaymentReceipt_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
