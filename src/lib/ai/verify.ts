// Citation verification — the difference between "cites sources" and
// "cites sources that actually say that".
//
// The model is asked to return, for every citation, a VERBATIM quote from the
// abstract it is citing. Two mechanical checks then run, neither of which needs
// a second model call:
//
//   1. IDENTITY. The cited marker must correspond to a paper that was actually
//      retrieved and put in front of the model. A citation to anything else is
//      fabricated by construction — it could not have been read.
//
//   2. SUPPORT. The quote must genuinely occur in that paper's abstract. This
//      is what catches the subtler and more dangerous failure: a real paper
//      cited for a claim it does not make. A model that invents a supporting
//      sentence fails here even though the paper is real.
//
// Anything failing either check is DROPPED, not softened. The count of drops is
// persisted on AssistantQuery: a rising number is the early warning that the
// model has started fabricating.
export type ModelCitation = { marker: string; quote: string };

export type VerifiedCitation = {
  evidenceId: string;
  title: string;
  url: string | null;
  journal: string | null;
  grade: string;
  quote: string;
};

export type VerificationOutcome = {
  verified: VerifiedCitation[];
  rejected: { marker: string; reason: "unknown-source" | "quote-not-found"; quote: string }[];
};

/** Normalise for comparison: whitespace and quote-style differences are noise. */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’“”]/g, "'") // smart quotes
    .replace(/[^a-z0-9' ]+/g, " ") // punctuation the model may re-render
    .replace(/\s+/g, " ")
    .trim();
}

// A quote shorter than this proves nothing — "the study found" occurs in
// thousands of abstracts and would let a fabricated citation pass.
const MIN_QUOTE_WORDS = 6;

export function quoteSupportedBy(quote: string, abstract: string): boolean {
  const q = normalise(quote);
  if (q.split(" ").length < MIN_QUOTE_WORDS) return false;
  return normalise(abstract).includes(q);
}

/**
 * Check every citation the model produced against what it was actually shown.
 *
 * `sources` is the retrieved set, keyed by the marker the prompt assigned
 * (E1, E2, …). A marker outside that map cannot have been read by the model.
 */
export function verifyCitations(
  claimed: ModelCitation[],
  sources: Map<string, { id: string; title: string; abstract: string; url: string | null; journal: string | null; grade: string }>,
): VerificationOutcome {
  const verified: VerifiedCitation[] = [];
  const rejected: VerificationOutcome["rejected"] = [];
  const seen = new Set<string>();

  for (const c of claimed) {
    const marker = c.marker.trim().toUpperCase();
    const src = sources.get(marker);

    if (!src) {
      rejected.push({ marker, reason: "unknown-source", quote: c.quote });
      continue;
    }
    if (!quoteSupportedBy(c.quote, src.abstract)) {
      rejected.push({ marker, reason: "quote-not-found", quote: c.quote });
      continue;
    }
    if (seen.has(src.id)) continue; // same paper cited twice — keep one
    seen.add(src.id);

    verified.push({
      evidenceId: src.id,
      title: src.title,
      url: src.url,
      journal: src.journal,
      grade: src.grade,
      quote: c.quote.trim(),
    });
  }

  return { verified, rejected };
}

/**
 * Strip citation markers whose citation was rejected.
 *
 * Without this the prose still reads "…reduces mortality [E3]" while [E3] has
 * been removed from the list — which looks like a rendering bug and, worse,
 * still signals to the reader that the claim was sourced.
 */
export function stripRejectedMarkers(answer: string, keep: Set<string>): string {
  return answer
    .replace(/\[(E\d+)\]/gi, (full, marker: string) =>
      keep.has(marker.toUpperCase()) ? full : "",
    )
    .replace(/ +([.,;:])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();
}
