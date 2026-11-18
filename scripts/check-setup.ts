// Runs before `npm run dev`: fails fast with a clear message if .env.local or
// any /data file is missing, or if DEMO_MODE=live is set without key and prices.
import { loadEnvConfig } from "@next/env";
import { liveProblems, getConfig, setupProblems } from "../lib/config";
import { dataSetupProblems } from "../lib/consoles";

loadEnvConfig(process.cwd());

const problems = [...setupProblems(), ...dataSetupProblems()];
const cfg = getConfig();
if (cfg.mode === "live") problems.push(...liveProblems(cfg).map((p) => `DEMO_MODE=live: ${p}`));

if (problems.length) {
  console.error(`\n✗ Setup problem${problems.length > 1 ? "s" : ""}:\n\n  ${problems.join("\n  ").replace(/\n/g, "\n  ")}\n`);
  process.exit(1);
}
console.log(`✓ setup ok · DEMO_MODE=${cfg.mode} · model ${cfg.model} · cap $${cfg.costLimitUsd.toFixed(2)}/request`);
