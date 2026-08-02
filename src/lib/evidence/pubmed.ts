// PubMed E-utilities client.
//
// Two calls per query: esearch returns PMIDs, efetch returns the records. NCBI
// asks for tool + email identification and rate-limits to 3 requests/second
// without an API key, 10 with one — `NCBI_API_KEY` is optional and only raises
// the ceiling.
//
// Parsing is XML because efetch's JSON mode omits abstracts, and the abstract is
// the whole point: it is what gets embedded and what citation verification
// quotes against.
import { log } from "@/lib/logger";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const TOOL = "numik-healthspanos";
const CONTACT = process.env.NCBI_CONTACT_EMAIL || "";

export type PubMedRecord = {
  pmid: string;
  title: string;
  abstract: string;
  journal: string;
  authors: string;
  publishedAt: Date | null;
  url: string;
  /** Publication types, e.g. "Randomized Controlled Trial" — drives grading. */
  publicationTypes: string[];
};

function params(extra: Record<string, string>): string {
  const p = new URLSearchParams({ tool: TOOL, ...extra });
  if (CONTACT) p.set("email", CONTACT);
  if (process.env.NCBI_API_KEY) p.set("api_key", process.env.NCBI_API_KEY);
  return p.toString();
}

// NCBI's published limit. Respected with a simple spacing delay rather than a
// token bucket — ingestion is a background job, not a hot path, so the
// simplicity is worth more than the throughput.
const MIN_INTERVAL_MS = process.env.NCBI_API_KEY ? 110 : 350;
let lastCall = 0;

async function throttled(url: string): Promise<string> {
  const wait = Math.max(0, lastCall + MIN_INTERVAL_MS - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const res = await fetch(url, { headers: { "user-agent": `${TOOL} (${CONTACT || "no-contact"})` } });
  if (!res.ok) throw new Error(`PubMed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.text();
}

/** PMIDs matching a query, newest first. */
export async function search(query: string, limit = 20): Promise<string[]> {
  const xml = await throttled(
    `${BASE}/esearch.fcgi?${params({
      db: "pubmed",
      term: query,
      retmax: String(limit),
      sort: "date",
      retmode: "xml",
    })}`,
  );
  return [...xml.matchAll(/<Id>(\d+)<\/Id>/g)].map((m) => m[1]!);
}

/** Full records for a set of PMIDs. */
export async function fetchRecords(pmids: string[]): Promise<PubMedRecord[]> {
  if (pmids.length === 0) return [];
  const xml = await throttled(
    `${BASE}/efetch.fcgi?${params({ db: "pubmed", id: pmids.join(","), retmode: "xml" })}`,
  );
  return parseArticles(xml);
}

// ── XML parsing ─────────────────────────────────────────────────────────────
// Deliberately regex-based rather than pulling in an XML parser: we read six
// fields from a stable, well-known schema. If the shape of what we extract
// grows, swap this for a real parser rather than growing the regexes.

export function parseArticles(xml: string): PubMedRecord[] {
  const out: PubMedRecord[] = [];
  for (const m of xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g)) {
    const a = m[1]!;
    const pmid = first(a, /<PMID[^>]*>(\d+)<\/PMID>/);
    if (!pmid) continue;

    const title = clean(first(a, /<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/) ?? "");
    // Structured abstracts split across labelled sections; join them so the
    // embedded text is the whole abstract, not just the conclusion.
    const abstract = [...a.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)]
      .map((x) => clean(x[1]!))
      .filter(Boolean)
      .join(" ");
    if (!title || !abstract) continue; // no abstract = nothing to ground on

    const authors = [...a.matchAll(/<LastName>([\s\S]*?)<\/LastName>/g)]
      .map((x) => clean(x[1]!))
      .slice(0, 6)
      .join(", ");

    out.push({
      pmid,
      title,
      abstract,
      journal: clean(first(a, /<Title>([\s\S]*?)<\/Title>/) ?? ""),
      authors,
      publishedAt: parseDate(a),
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      publicationTypes: [...a.matchAll(/<PublicationType[^>]*>([\s\S]*?)<\/PublicationType>/g)].map((x) =>
        clean(x[1]!),
      ),
    });
  }
  log.debug("pubmed.parsed", { articles: out.length });
  return out;
}

function first(s: string, re: RegExp): string | null {
  return s.match(re)?.[1] ?? null;
}

function clean(s: string): string {
  return (
    s
      .replace(/<[^>]+>/g, "") // inline markup (<i>, <sup>, …)
      // Numeric entities BEFORE named ones, and before &amp; in particular:
      // medical abstracts are full of them (&#x3b5;4 for APOE ε4, &#956; for
      // micro, &#8805; for ≥) and leaving them raw puts literal "&#x3b5;" in a
      // title, an embedding, and a verification quote.
      .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeChar(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec: string) => safeChar(parseInt(dec, 10)))
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&") // last: decoding it earlier would re-create entities
      .replace(/\s+/g, " ")
      .trim()
  );
}

/** Guard against malformed code points rather than throwing mid-ingest. */
function safeChar(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function parseDate(a: string): Date | null {
  const y = first(a, /<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/);
  if (!y) return null;
  const mRaw = first(a, /<PubDate>[\s\S]*?<Month>(\w+)<\/Month>/) ?? "1";
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const month = months[mRaw.slice(0, 3).toLowerCase()] ?? (Number(mRaw) || 1);
  return new Date(Date.UTC(Number(y), month - 1, 1));
}

// ── Grading ─────────────────────────────────────────────────────────────────

/**
 * Map publication types onto the existing EvidenceGrade scale.
 *
 * Study DESIGN only. This is a transparent, mechanical proxy for evidence
 * strength — it says nothing about whether a specific paper is any good, and it
 * is not a quality appraisal. A human reviewer regrades in the reviewer portal;
 * this is the starting position, not the verdict.
 */
export function gradeFor(types: string[]): "A" | "B" | "C" | "D" | "UNGRADED" {
  const t = types.map((x) => x.toLowerCase());
  const has = (s: string) => t.some((x) => x.includes(s));

  if (has("meta-analysis") || has("systematic review")) return "A";
  if (has("randomized controlled trial")) return "A";
  if (has("clinical trial") || has("cohort")) return "B";
  if (has("observational study") || has("comparative study")) return "B";
  if (has("case reports") || has("case series")) return "C";
  if (has("review")) return "C";
  if (has("editorial") || has("comment") || has("letter")) return "D";
  return "UNGRADED";
}

/** Retraction and correction signals — the "evidence that expires" promise. */
export function signalsFor(types: string[], title: string): Record<string, boolean> | null {
  const t = types.map((x) => x.toLowerCase()).join(" ");
  const s: Record<string, boolean> = {};
  if (t.includes("retract") || /\bretract/i.test(title)) s.retracted = true;
  if (t.includes("corrected") || /\b(correction|erratum)\b/i.test(title)) s.corrected = true;
  if (t.includes("expression of concern")) s.concern = true;
  return Object.keys(s).length ? s : null;
}
