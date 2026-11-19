// Runs before `npm run dev`: fails fast with a clear message if .env.local or
// any /data file is missing, or if DEMO_MODE=live is set without key and prices.
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { liveProblems, getConfig, setupProblems } from "../lib/config";
import { dataSetupProblems } from "../lib/consoles";

loadEnvConfig(process.cwd());

// Locally, a missing .env.local is worth a hint, not a stop: replay runs without one.
if (!fs.existsSync(path.join(process.cwd(), ".env.local")))
  console.warn("! No .env.local: running with defaults (DEMO_MODE=replay, no API key). Copy .env.example to .env.local to set a key or prices.");

const problems = [...setupProblems(), ...dataSetupProblems()];
const cfg = getConfig();
if (cfg.mode === "live") problems.push(...liveProblems(cfg).map((p) => `DEMO_MODE=live: ${p}`));

if (problems.length) {
  console.error(`\n✗ Setup problem${problems.length > 1 ? "s" : ""}:\n\n  ${problems.join("\n  ").replace(/\n/g, "\n  ")}\n`);
  process.exit(1);
}
console.log(`✓ setup ok · DEMO_MODE=${cfg.mode} · model ${cfg.model} · cap $${cfg.costLimitUsd.toFixed(2)}/request`);
