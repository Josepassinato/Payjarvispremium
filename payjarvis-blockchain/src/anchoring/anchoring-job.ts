import cron from "node-cron";
import { config } from "../config";
import { AnchoringService } from "./anchoring-service";

const anchoringService = new AnchoringService();

async function runAnchoringCycle() {
  const now = new Date();
  const periodEnd = now;
  const periodStart = new Date(now.getTime() - config.ANCHOR_PERIOD_HOURS * 60 * 60 * 1000);

  console.log(`[anchoring-job] Starting cycle at ${now.toISOString()}`);
  console.log(`[anchoring-job] Period: ${periodStart.toISOString()} → ${periodEnd.toISOString()}`);

  await anchoringService.anchorPeriod(periodStart, periodEnd);

  console.log("[anchoring-job] Cycle complete.");
}

// Run as cron job or one-shot
if (process.argv.includes("--once")) {
  runAnchoringCycle()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[anchoring-job] Error:", err);
      process.exit(1);
    });
} else {
  console.log(`[anchoring-job] Scheduling cron: ${config.ANCHOR_CRON}`);
  cron.schedule(config.ANCHOR_CRON, () => {
    runAnchoringCycle().catch((err) => {
      console.error("[anchoring-job] Cycle error:", err);
    });
  });
}
