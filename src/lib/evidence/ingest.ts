// Build the evidence corpus from PubMed and embed it for retrieval.
//
// Ingestion is idempotent on `externalId` (the PMID): re-running updates a
// record rather than duplicating the literature, so this is safe to run on a
// schedule.
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { EMBEDDING_DIMS, embed, embeddingsConfigured } from "@/lib/ai/providers";
import { fetchRecords, gradeFor, search, signalsFor, type PubMedRecord } from "./pubmed";

// The searches that define what this product knows about. Narrow on purpose:
// a focused corpus retrieves better than a broad one, and every term here is
// squarely inside the longevity / preventive-health remit.
export const CORPUS_QUERIES = [
  "(sleep duration) AND (cardiovascular OR metabolic) AND (cohort OR randomized)",
  "(physical activity OR exercise) AND (all-cause mortality) AND (meta-analysis OR cohort)",
  "(mediterranean diet OR dietary pattern) AND (longevity OR healthspan OR mortality)",
  "(resistance training OR strength training) AND (older adults) AND (function OR sarcopenia)",
  "(chronic stress OR psychological stress) AND (inflammation OR cardiovascular risk)",
  "(smoking cessation) AND (cardiovascular OR mortality) AND (benefit OR risk reduction)",
  "(alcohol consumption) AND (mortality OR cardiovascular) AND (cohort OR meta-analysis)",
  "(sleep quality OR insomnia) AND (cognitive function OR cognition)",
  "(VO2max OR cardiorespiratory fitness) AND (mortality OR longevity)",
  "(intermittent fasting OR time restricted eating) AND (metabolic health)",
] as const;

export type IngestResult = {
  queries: number;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  embedded: number;
  errors: string[];
};

/** Text that gets embedded. Title carries a lot of signal, so it leads. */
function embeddingText(r: { title: string; abstract: string | null }): string {
  return `${r.title}\n\n${r.abstract ?? ""}`.slice(0, 8000);
}

/**
 * Pull records for the configured queries and upsert them.
 *
 * Does NOT embed — that is a separate step so an embedding outage or a missing
 * OpenAI key cannot cost the fetched literature. Un-embedded rows simply wait.
 */
export async function ingestCorpus(opts: { perQuery?: number; queries?: readonly string[] } = {}): Promise<IngestResult> {
  const queries = opts.queries ?? CORPUS_QUERIES;
  const perQuery = opts.perQuery ?? 15;
  const result: IngestResult = {
    queries: queries.length, fetched: 0, created: 0, updated: 0, skipped: 0, embedded: 0, errors: [],
  };

  for (const q of queries) {
    try {
      const pmids = await search(q, perQuery);
      const records = await fetchRecords(pmids);
      result.fetched += records.length;

      for (const r of records) {
        const written = await upsertRecord(r);
        result[written]++;
      }
    } catch (err) {
      // One failing query must not abandon the whole corpus.
      const msg = `query failed: ${q.slice(0, 60)} — ${String(err).slice(0, 200)}`;
      result.errors.push(msg);
      log.error("evidence.query_failed", err, { query: q.slice(0, 60) });
    }
  }

  log.info("evidence.ingested", {
    queries: result.queries, fetched: result.fetched,
    created: result.created, updated: result.updated, errors: result.errors.length,
  });
  return result;
}

async function upsertRecord(r: PubMedRecord): Promise<"created" | "updated" | "skipped"> {
  const grade = gradeFor(r.publicationTypes);
  const signals = signalsFor(r.publicationTypes, r.title);

  const existing = await prisma.evidenceItem.findUnique({
    where: { externalId: r.pmid },
    select: { id: true, abstract: true },
  });

  const data = {
    externalId: r.pmid,
    sourceType: "PUBMED" as const,
    title: r.title,
    source: r.journal || "PubMed",
    url: r.url,
    // Short human-readable summary; the abstract is the grounding text.
    summary: r.abstract.slice(0, 600),
    abstract: r.abstract,
    authors: r.authors || null,
    journal: r.journal || null,
    publishedAt: r.publishedAt,
    grade,
    // Retracted or corrected papers land as FLAGGED so they are visibly
    // quarantined rather than quietly serving stale science.
    status: signals?.retracted || signals?.corrected ? ("FLAGGED" as const) : ("INGESTED" as const),
    signals: signals ?? undefined,
  };

  if (!existing) {
    await prisma.evidenceItem.create({ data });
    return "created";
  }
  // Re-embedding is expensive; only clear the embedding when the text changed.
  const abstractChanged = existing.abstract !== r.abstract;
  await prisma.evidenceItem.update({
    where: { id: existing.id },
    data: abstractChanged ? { ...data, embeddedAt: null } : data,
  });
  return abstractChanged ? "updated" : "skipped";
}

/**
 * Embed everything that has no current embedding.
 *
 * Batched, and each batch is written before the next is requested — a failure
 * halfway through keeps the work already done instead of restarting from zero.
 */
export async function embedPending(batchSize = 32, maxBatches = 50): Promise<{ embedded: number; remaining: number }> {
  if (!embeddingsConfigured()) {
    throw new Error("OPENAI_API_KEY is required to embed the evidence corpus.");
  }
  let embedded = 0;

  for (let batch = 0; batch < maxBatches; batch++) {
    const pending = await prisma.evidenceItem.findMany({
      where: { embeddedAt: null, abstract: { not: null } },
      select: { id: true, title: true, abstract: true },
      take: batchSize,
    });
    if (pending.length === 0) break;

    const { vectors } = await embed(pending.map(embeddingText));

    // Raw SQL: Prisma cannot write an Unsupported("vector") column.
    for (let i = 0; i < pending.length; i++) {
      const literal = `[${vectors[i]!.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE "EvidenceItem" SET "embedding" = $1::vector, "embeddedAt" = NOW() WHERE "id" = $2`,
        literal,
        pending[i]!.id,
      );
    }
    embedded += pending.length;
  }

  const remaining = await prisma.evidenceItem.count({ where: { embeddedAt: null, abstract: { not: null } } });
  log.info("evidence.embedded", { embedded, remaining, dims: EMBEDDING_DIMS });
  return { embedded, remaining };
}

/** Corpus health, for the admin surface and the ingest script's output. */
export async function corpusStats() {
  const [total, embeddedCount, flagged, byGrade] = await Promise.all([
    prisma.evidenceItem.count(),
    prisma.evidenceItem.count({ where: { embeddedAt: { not: null } } }),
    prisma.evidenceItem.count({ where: { status: "FLAGGED" } }),
    prisma.evidenceItem.groupBy({ by: ["grade"], _count: true }),
  ]);
  return {
    total,
    embedded: embeddedCount,
    unembedded: total - embeddedCount,
    flagged,
    byGrade: Object.fromEntries(byGrade.map((g) => [g.grade, g._count])),
  };
}
