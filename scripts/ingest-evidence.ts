/**
 * Build the evidence corpus from PubMed, then embed it.
 *
 *   npx tsx scripts/ingest-evidence.ts            # fetch + embed
 *   npx tsx scripts/ingest-evidence.ts --fetch    # fetch only
 *   npx tsx scripts/ingest-evidence.ts --embed    # embed pending only
 *   npx tsx scripts/ingest-evidence.ts --stats    # report and exit
 *
 * Safe to re-run: ingestion is idempotent on the PMID, so this is the shape a
 * scheduled refresh takes. Fetching needs no key; embedding needs OPENAI_API_KEY.
 */
import { corpusStats, embedPending, ingestCorpus } from "../src/lib/evidence/ingest";

async function main() {
  const args = process.argv.slice(2);
  const only = (f: string) => args.includes(f);
  const doFetch = only("--fetch") || (!only("--embed") && !only("--stats"));
  const doEmbed = only("--embed") || (!only("--fetch") && !only("--stats"));

  if (only("--stats")) {
    console.log(await corpusStats());
    return;
  }

  if (doFetch) {
    console.log("Fetching from PubMed…");
    const r = await ingestCorpus();
    console.log(
      `  queries ${r.queries} · fetched ${r.fetched} · created ${r.created} · updated ${r.updated} · skipped ${r.skipped}`,
    );
    for (const e of r.errors) console.warn(`  ! ${e}`);
  }

  if (doEmbed) {
    if (!process.env.OPENAI_API_KEY) {
      console.error(
        "\n  OPENAI_API_KEY is not set, so nothing can be embedded.\n" +
        "  The literature is stored but not retrievable until it is.\n",
      );
      process.exitCode = 1;
    } else {
      console.log("Embedding…");
      const e = await embedPending();
      console.log(`  embedded ${e.embedded} · remaining ${e.remaining}`);
    }
  }

  console.log("\nCorpus:", await corpusStats());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
