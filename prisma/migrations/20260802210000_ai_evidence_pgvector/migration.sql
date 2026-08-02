-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "EvidenceSource" AS ENUM ('PUBMED', 'MANUAL', 'REGULATOR');

-- CreateEnum
CREATE TYPE "AssistantOutcome" AS ENUM ('ANSWERED', 'NO_EVIDENCE', 'ESCALATED', 'BLOCKED');

-- AlterTable
ALTER TABLE "EvidenceItem" ADD COLUMN     "abstract" TEXT,
ADD COLUMN     "authors" TEXT,
ADD COLUMN     "embeddedAt" TIMESTAMP(3),
ADD COLUMN     "embedding" vector(1536),
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "journal" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "sourceType" "EvidenceSource" NOT NULL DEFAULT 'PUBMED';

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantQuery" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "outcome" "AssistantOutcome" NOT NULL,
    "answer" TEXT,
    "citedIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rejectedCitations" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsage_tenantId_createdAt_idx" ON "AiUsage"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_createdAt_idx" ON "AiUsage"("createdAt");

-- CreateIndex
CREATE INDEX "AssistantQuery_tenantId_createdAt_idx" ON "AssistantQuery"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistantQuery_outcome_idx" ON "AssistantQuery"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceItem_externalId_key" ON "EvidenceItem"("externalId");

-- CreateIndex
CREATE INDEX "EvidenceItem_publishedAt_idx" ON "EvidenceItem"("publishedAt");


-- Approximate-nearest-neighbour index for retrieval.
--
-- Hand-added: Prisma cannot type a pgvector column (it is Unsupported), so it
-- will never generate an index for one. Without this, every assistant question
-- sequentially scans the whole corpus and recall latency grows with the
-- literature.
--
-- HNSW over cosine distance, matching the `<=>` operator used in
-- src/lib/evidence/retrieval.ts. The operator class and the query operator MUST
-- agree or Postgres silently ignores the index and falls back to a seq scan.
CREATE INDEX IF NOT EXISTS "EvidenceItem_embedding_hnsw_idx"
  ON "EvidenceItem" USING hnsw ("embedding" vector_cosine_ops);
