// Citation verification — the mechanism that makes "citation-backed" mean
// something. Two failures matter and both are tested:
//
//   fabricated source  — citing a paper that was never retrieved
//   unsupported claim  — citing a REAL paper for something it does not say
//
// The second is the dangerous one. A real title and a real link look credible,
// so a claim attached to a paper that never made it is far more convincing than
// an obviously invented reference.
import { describe, expect, it } from "vitest";
import { quoteSupportedBy, stripRejectedMarkers, verifyCitations } from "@/lib/ai/verify";
import { gradeFor, parseArticles, signalsFor } from "@/lib/evidence/pubmed";

const ABSTRACT_A =
  "In this prospective cohort of 42,000 adults followed for twelve years, participants reporting " +
  "seven to nine hours of sleep per night had a 21% lower rate of major cardiovascular events than " +
  "those reporting fewer than six hours. The association persisted after adjustment for body mass " +
  "index, smoking status and physical activity.";

const ABSTRACT_B =
  "A meta-analysis of 33 randomized trials found that supervised resistance training improved " +
  "lower-limb strength and gait speed in adults over 65, with the largest effects in previously " +
  "sedentary participants.";

function sources() {
  return new Map([
    ["E1", { id: "ev-a", title: "Sleep duration and cardiovascular events", abstract: ABSTRACT_A, url: "https://pubmed.ncbi.nlm.nih.gov/1/", journal: "Circulation", grade: "B" }],
    ["E2", { id: "ev-b", title: "Resistance training in older adults", abstract: ABSTRACT_B, url: "https://pubmed.ncbi.nlm.nih.gov/2/", journal: "JAMA", grade: "A" }],
  ]);
}

describe("quote support", () => {
  it("accepts a verbatim span", () => {
    expect(quoteSupportedBy("had a 21% lower rate of major cardiovascular events", ABSTRACT_A)).toBe(true);
  });

  it("tolerates whitespace and smart-quote differences", () => {
    expect(quoteSupportedBy("  seven to nine   hours of sleep per night  ", ABSTRACT_A)).toBe(true);
  });

  it("rejects a paraphrase — the whole point of verbatim", () => {
    expect(quoteSupportedBy("sleeping well reduces heart problems by about a fifth", ABSTRACT_A)).toBe(false);
  });

  it("rejects a quote from a DIFFERENT paper", () => {
    expect(quoteSupportedBy("improved lower-limb strength and gait speed", ABSTRACT_A)).toBe(false);
  });

  it("rejects a quote too short to prove anything", () => {
    // "the association" appears in thousands of abstracts.
    expect(quoteSupportedBy("the association", ABSTRACT_A)).toBe(false);
  });
});

describe("verification", () => {
  it("keeps a citation that is real and supported", () => {
    const r = verifyCitations(
      [{ marker: "E1", quote: "participants reporting seven to nine hours of sleep per night" }],
      sources(),
    );
    expect(r.verified).toHaveLength(1);
    expect(r.verified[0]!.evidenceId).toBe("ev-a");
    expect(r.rejected).toHaveLength(0);
  });

  it("DROPS a citation to a source that was never retrieved", () => {
    // E9 was never shown to the model, so it cannot have read it.
    const r = verifyCitations([{ marker: "E9", quote: "some plausible sounding sentence here" }], sources());
    expect(r.verified).toHaveLength(0);
    expect(r.rejected[0]!.reason).toBe("unknown-source");
  });

  it("DROPS a real paper cited for something it does not say", () => {
    const r = verifyCitations(
      [{ marker: "E1", quote: "sleep supplements reduced mortality by forty percent in this trial" }],
      sources(),
    );
    expect(r.verified).toHaveLength(0);
    expect(r.rejected[0]!.reason).toBe("quote-not-found");
  });

  it("keeps the good and drops the bad in one response", () => {
    const r = verifyCitations(
      [
        { marker: "E1", quote: "had a 21% lower rate of major cardiovascular events" },
        { marker: "E2", quote: "this paper proves sleep cures everything" },
      ],
      sources(),
    );
    expect(r.verified).toHaveLength(1);
    expect(r.verified[0]!.evidenceId).toBe("ev-a");
    expect(r.rejected).toHaveLength(1);
  });

  it("does not list the same paper twice", () => {
    const r = verifyCitations(
      [
        { marker: "E1", quote: "had a 21% lower rate of major cardiovascular events" },
        { marker: "E1", quote: "The association persisted after adjustment for body mass index" },
      ],
      sources(),
    );
    expect(r.verified).toHaveLength(1);
  });

  it("carries the quote through so the reader can check it", () => {
    const r = verifyCitations(
      [{ marker: "E2", quote: "improved lower-limb strength and gait speed in adults over 65" }],
      sources(),
    );
    expect(r.verified[0]!.quote).toContain("gait speed");
    expect(r.verified[0]!.grade).toBe("A");
  });
});

describe("marker cleanup", () => {
  it("removes markers whose citation was rejected", () => {
    const out = stripRejectedMarkers("Sleep matters [E1]. Supplements help [E9].", new Set(["E1"]));
    expect(out).toContain("[E1]");
    expect(out).not.toContain("[E9]");
  });

  it("does not leave dangling spaces before punctuation", () => {
    expect(stripRejectedMarkers("Claim [E9]. Next.", new Set())).toBe("Claim. Next.");
  });
});

// ── PubMed parsing and grading ──────────────────────────────────────────────

const SAMPLE_XML = `<PubmedArticleSet><PubmedArticle>
<PMID Version="1">12345678</PMID>
<ArticleTitle>Sleep duration and <i>cardiovascular</i> outcomes</ArticleTitle>
<Abstract><AbstractText Label="BACKGROUND">Short sleep is common.</AbstractText>
<AbstractText Label="RESULTS">Participants sleeping 7-9 hours had fewer events.</AbstractText></Abstract>
<Title>Circulation</Title>
<PubDate><Year>2023</Year><Month>Mar</Month></PubDate>
<AuthorList><Author><LastName>Chen</LastName></Author><Author><LastName>Okafor</LastName></Author></AuthorList>
<PublicationType>Meta-Analysis</PublicationType>
</PubmedArticle></PubmedArticleSet>`;

describe("pubmed parsing", () => {
  const [rec] = parseArticles(SAMPLE_XML);

  it("extracts the record", () => {
    expect(rec?.pmid).toBe("12345678");
    expect(rec?.journal).toBe("Circulation");
    expect(rec?.authors).toBe("Chen, Okafor");
  });

  it("strips inline markup from the title", () => {
    expect(rec?.title).toBe("Sleep duration and cardiovascular outcomes");
  });

  it("joins a structured abstract into one text", () => {
    // Only the conclusion would lose the context the embedding needs.
    expect(rec?.abstract).toContain("Short sleep is common.");
    expect(rec?.abstract).toContain("7-9 hours");
  });

  it("parses the publication date", () => {
    expect(rec?.publishedAt?.getUTCFullYear()).toBe(2023);
    expect(rec?.publishedAt?.getUTCMonth()).toBe(2); // March
  });

  it("builds a real, resolvable URL", () => {
    expect(rec?.url).toBe("https://pubmed.ncbi.nlm.nih.gov/12345678/");
  });

  it("decodes numeric HTML entities, which medical titles are full of", () => {
    // Real regression: "APOE &#x3b5;4" was stored verbatim, which then poisons
    // the title, the embedding, and any verification quote drawn from it.
    const [r] = parseArticles(`<PubmedArticleSet><PubmedArticle><PMID>9</PMID>
      <ArticleTitle>APOE &#x3b5;4 and risk &#8805; baseline</ArticleTitle>
      <Abstract><AbstractText>Carriers of &#956;-opioid variants were followed.</AbstractText></Abstract>
      </PubmedArticle></PubmedArticleSet>`);
    expect(r?.title).toBe("APOE ε4 and risk ≥ baseline");
    expect(r?.abstract).toContain("μ-opioid");
    expect(r?.title).not.toContain("&#");
  });

  it("does not double-decode ampersands into new entities", () => {
    const [r] = parseArticles(`<PubmedArticleSet><PubmedArticle><PMID>10</PMID>
      <ArticleTitle>Diet &amp;#x3b5; nutrition</ArticleTitle>
      <Abstract><AbstractText>Some abstract text here for the record.</AbstractText></Abstract>
      </PubmedArticle></PubmedArticleSet>`);
    // &amp;#x3b5; must render as the literal text "&#x3b5;", not as epsilon.
    expect(r?.title).toBe("Diet &#x3b5; nutrition");
  });

  it("skips records with no abstract — nothing to ground on", () => {
    expect(parseArticles(`<PubmedArticleSet><PubmedArticle><PMID>1</PMID>
      <ArticleTitle>No abstract here</ArticleTitle></PubmedArticle></PubmedArticleSet>`)).toHaveLength(0);
  });
});

describe("grading by study design", () => {
  it("ranks synthesis and trials highest", () => {
    expect(gradeFor(["Meta-Analysis"])).toBe("A");
    expect(gradeFor(["Systematic Review"])).toBe("A");
    expect(gradeFor(["Randomized Controlled Trial"])).toBe("A");
  });

  it("ranks cohorts below trials and opinion lowest", () => {
    expect(gradeFor(["Observational Study"])).toBe("B");
    expect(gradeFor(["Case Reports"])).toBe("C");
    expect(gradeFor(["Editorial"])).toBe("D");
  });

  it("does not guess when the type is unknown", () => {
    expect(gradeFor([])).toBe("UNGRADED");
    expect(gradeFor(["Journal Article"])).toBe("UNGRADED");
  });
});

describe("retraction signals", () => {
  it("flags retracted and corrected work", () => {
    expect(signalsFor(["Retracted Publication"], "Some paper")?.retracted).toBe(true);
    expect(signalsFor([], "Erratum: earlier findings")?.corrected).toBe(true);
  });

  it("returns null for ordinary papers", () => {
    expect(signalsFor(["Journal Article"], "A normal title")).toBeNull();
  });
});
