// Vector retrieval over the evidence corpus.
//
// Raw SQL because Prisma cannot express pgvector. The `<=>` operator is cosine
// DISTANCE (0 = identical, 2 = opposite), and it must match the
// `vector_cosine_ops` opclass on the HNSW index or Postgres quietly ignores the
// index and sequentially scans the corpus.
import { prisma } from "@/lib/db";
import { embed } from "@/lib/ai/providers";

export type RetrievedEvidence = {
  id: string;
  externalId: string | null;
  title: string;
  abstract: string;
  url: string | null;
  journal: string | null;
  grade: string;
  status: string;
  publishedAt: Date | null;
  /** 0-1, higher is closer. Derived from cosine distance. */
  similarity: number;
};

// Below this the "match" is noise. Retrieving weakly related papers is worse
// than retrieving none: it invites the model to stretch a citation to fit.
const MIN_SIMILARITY = 0.25;

/**
 * The most relevant evidence for a question.
 *
 * FLAGGED items — retracted, corrected, under expression of concern — are
 * excluded at the query level. That is the "evidence that expires" promise made
 * concrete: a paper that stops being true stops being retrievable, rather than
 * relying on the model to notice a caveat in the text.
 */
export async function retrieve(question: string, limit = 6): Promise<RetrievedEvidence[]> {
  const { vectors } = await embed([question]);
  const queryVec = `[${vectors[0]!.join(",")}]`;

  const rows = await prisma.$queryRawUnsafe<
    Array<Omit<RetrievedEvidence, "similarity"> & { distance: number }>
  >(
    `SELECT "id", "externalId", "title", "abstract", "url", "journal",
            "grade"::text AS grade, "status"::text AS status, "publishedAt",
            ("embedding" <=> $1::vector) AS distance
       FROM "EvidenceItem"
      WHERE "embedding" IS NOT NULL
        AND "abstract" IS NOT NULL
        AND "status" <> 'FLAGGED'
        AND "status" <> 'REJECTED'
      ORDER BY "embedding" <=> $1::vector
      LIMIT $2`,
    queryVec,
    limit,
  );

  return rows
    // Cosine distance 0..2 -> similarity 1..-1. Clamped for display sanity.
    .map((r) => ({ ...r, similarity: Math.max(0, 1 - r.distance / 2) }))
    .filter((r) => r.similarity >= MIN_SIMILARITY);
}

/** Is the corpus usable? Retrieval over an empty index answers nothing. */
export async function corpusReady(): Promise<{ ready: boolean; embedded: number }> {
  const embedded = await prisma.evidenceItem.count({
    where: { embeddedAt: { not: null }, status: { notIn: ["FLAGGED", "REJECTED"] } },
  });
  return { ready: embedded > 0, embedded };
}
