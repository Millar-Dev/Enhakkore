-- AlterTable
ALTER TABLE "User" ADD COLUMN     "approxLat" DOUBLE PRECISION,
ADD COLUMN     "approxLng" DOUBLE PRECISION,
ADD COLUMN     "approxLocatedAt" TIMESTAMP(3),
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "friendLocation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gamingProfile" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "nearbyGaming" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "niaHistory" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "readReceipts" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "directKey" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'GROUP',
ADD COLUMN     "lastMessageAt" TIMESTAMP(3),
ADD COLUMN     "requestStatus" TEXT,
ADD COLUMN     "requestedById" TEXT;

-- AlterTable
ALTER TABLE "ConversationMember" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "clearedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "encrypted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "replyToId" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'UPDATES',
ADD COLUMN     "dedupeKey" TEXT;

-- AlterTable
ALTER TABLE "Community" ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "course" TEXT,
ADD COLUMN     "moderationReason" TEXT,
ADD COLUMN     "objectives" TEXT,
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "tags" TEXT NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "bracketFormat" TEXT NOT NULL DEFAULT 'SINGLE_ELIMINATION',
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'FRIENDLY',
ADD COLUMN     "checkedAt" TIMESTAMP(3),
ADD COLUMN     "checkedById" TEXT,
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "esportsOrganiserId" TEXT,
ADD COLUMN     "moderationReason" TEXT,
ADD COLUMN     "organiserType" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
ADD COLUMN     "platform" TEXT,
ADD COLUMN     "prizeDetails" TEXT,
ADD COLUMN     "registrationRestricted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TournamentEntry" ADD COLUMN     "seed" INTEGER;

-- CreateTable
CREATE TABLE "UserAdminRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserAdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageHidden" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "MessageHidden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityInvite" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSession" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'ONLINE',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT,
    "link" TEXT,
    "createdById" TEXT NOT NULL,
    "reminderSentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSessionRsvp" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GOING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupSessionRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupResource" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'NOTE',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "url" TEXT,
    "createdById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentMatch" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'WINNERS',
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "homeEntryId" TEXT,
    "awayEntryId" TEXT,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "winnerEntryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "nextMatchId" TEXT,
    "nextSlot" TEXT,
    "loserNextMatchId" TEXT,
    "loserNextSlot" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "disputed" BOOLEAN NOT NULL DEFAULT false,
    "reportedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentNote" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'NOTE',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EsportsOrganiser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organisationName" TEXT NOT NULL,
    "representativeName" TEXT NOT NULL,
    "representativeRole" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "location" TEXT,
    "website" TEXT,
    "socials" TEXT NOT NULL DEFAULT '[]',
    "history" TEXT NOT NULL,
    "games" TEXT NOT NULL DEFAULT '[]',
    "authorityEvidence" TEXT NOT NULL,
    "documents" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "verifiedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EsportsOrganiser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamingSession" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "organiserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'ONLINE',
    "sessionType" TEXT NOT NULL DEFAULT 'CASUAL',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "capacity" INTEGER NOT NULL,
    "location" TEXT,
    "onlinePlatform" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamingSessionPlayer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamingSessionPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamingGroup" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "game" TEXT,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "privacy" TEXT NOT NULL DEFAULT 'PUBLIC',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamingGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamingGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameInvite" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "slotsNeeded" INTEGER NOT NULL,
    "slotsRemaining" INTEGER NOT NULL,
    "playStyle" TEXT,
    "message" TEXT,
    "meetingArea" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "tokenHash" TEXT,
    "gridLat" DOUBLE PRECISION,
    "gridLng" DOUBLE PRECISION,
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameInviteRecipient" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameInviteRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameInviteResponse" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameInviteResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "lastSuccessAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "title" TEXT NOT NULL,
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NiaConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NiaConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NiaMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "results" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NiaMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NiaUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NiaUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAdminRole_userId_roleId_key" ON "UserAdminRole"("userId", "roleId");

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "MessageHidden_messageId_userId_key" ON "MessageHidden"("messageId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityInvite_tokenHash_key" ON "CommunityInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "CommunityInvite_communityId_idx" ON "CommunityInvite"("communityId");

-- CreateIndex
CREATE INDEX "GroupSession_communityId_startsAt_idx" ON "GroupSession"("communityId", "startsAt");

-- CreateIndex
CREATE INDEX "GroupSession_startsAt_reminderSentAt_idx" ON "GroupSession"("startsAt", "reminderSentAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSessionRsvp_sessionId_userId_key" ON "GroupSessionRsvp"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "GroupResource_communityId_idx" ON "GroupResource"("communityId");

-- CreateIndex
CREATE INDEX "TournamentMatch_tournamentId_stage_round_idx" ON "TournamentMatch"("tournamentId", "stage", "round");

-- CreateIndex
CREATE INDEX "TournamentNote_tournamentId_idx" ON "TournamentNote"("tournamentId");

-- CreateIndex
CREATE INDEX "EsportsOrganiser_status_idx" ON "EsportsOrganiser"("status");

-- CreateIndex
CREATE INDEX "EsportsOrganiser_userId_idx" ON "EsportsOrganiser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GamingSession_slug_key" ON "GamingSession"("slug");

-- CreateIndex
CREATE INDEX "GamingSession_status_startsAt_idx" ON "GamingSession"("status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "GamingSessionPlayer_sessionId_userId_key" ON "GamingSessionPlayer"("sessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GamingGroup_slug_key" ON "GamingGroup"("slug");

-- CreateIndex
CREATE INDEX "GamingGroup_kind_status_idx" ON "GamingGroup"("kind", "status");

-- CreateIndex
CREATE INDEX "GamingGroupMember_userId_idx" ON "GamingGroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GamingGroupMember_groupId_userId_key" ON "GamingGroupMember"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GameInvite_tokenHash_key" ON "GameInvite"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "GameInvite_conversationId_key" ON "GameInvite"("conversationId");

-- CreateIndex
CREATE INDEX "GameInvite_status_expiresAt_idx" ON "GameInvite"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "GameInvite_requesterId_idx" ON "GameInvite"("requesterId");

-- CreateIndex
CREATE INDEX "GameInviteRecipient_userId_idx" ON "GameInviteRecipient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GameInviteRecipient_inviteId_userId_key" ON "GameInviteRecipient"("inviteId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GameInviteResponse_inviteId_userId_key" ON "GameInviteResponse"("inviteId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "MemberActivity_userId_createdAt_idx" ON "MemberActivity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "NiaConversation_userId_updatedAt_idx" ON "NiaConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "NiaMessage_conversationId_createdAt_idx" ON "NiaMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NiaUsage_userId_day_key" ON "NiaUsage"("userId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_directKey_key" ON "Conversation"("directKey");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "UserAdminRole" ADD CONSTRAINT "UserAdminRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAdminRole" ADD CONSTRAINT "UserAdminRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageHidden" ADD CONSTRAINT "MessageHidden_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityInvite" ADD CONSTRAINT "CommunityInvite_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSession" ADD CONSTRAINT "GroupSession_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSessionRsvp" ADD CONSTRAINT "GroupSessionRsvp_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GroupSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupResource" ADD CONSTRAINT "GroupResource_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentNote" ADD CONSTRAINT "TournamentNote_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamingSessionPlayer" ADD CONSTRAINT "GamingSessionPlayer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GamingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamingGroup" ADD CONSTRAINT "GamingGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GamingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamingGroupMember" ADD CONSTRAINT "GamingGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "GamingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameInviteRecipient" ADD CONSTRAINT "GameInviteRecipient_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "GameInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameInviteResponse" ADD CONSTRAINT "GameInviteResponse_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "GameInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NiaMessage" ADD CONSTRAINT "NiaMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "NiaConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
