/**
 * Recompute enterprise aggregates for every eligible tenant.
 *
 *   npx tsx scripts/recompute-analytics.ts
 *
 * Same work the nightly cron does, for running by hand after a data change.
 */
import { computeAllTenants, currentPeriod } from "../src/lib/analytics/aggregate";

(async () => {
  const period = currentPeriod();
  console.log(`Recomputing aggregates for ${period}…`);
  const results = await computeAllTenants(period);
  for (const r of results) {
    console.log(
      `  ${r.tenantId}  eligible ${r.eligibleMembers}/${r.totalMembers}  metrics ${r.metricsWritten}` +
        (r.suppressedEntirely ? "  (below k-anonymity — all suppressed to the employer)" : ""),
    );
  }
  console.log(`\n${results.length} tenant(s) processed.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
