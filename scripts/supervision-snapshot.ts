// npm run supervision:snapshot: rewrites lib/engine/supervision-snapshot.json from the recordings in runs/.
// Run with --conditions=react-server so the `server-only` guard allows it.
import fs from "node:fs";
import path from "node:path";
import { buildSnapshot } from "../lib/engine/supervisionSnapshot";

const file = path.join(process.cwd(), "lib/engine/supervision-snapshot.json");
fs.writeFileSync(file, JSON.stringify(buildSnapshot(), null, 1) + "\n");
console.log(`wrote ${file}`);
