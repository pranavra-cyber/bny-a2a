// Markdown procedures and correspondence per firm. Pass only the calling agent's own firm.
import "server-only";
import { type Firm, readDocs, requireFiles } from "./core";

export type FirmDoc = { name: string; markdown: string };

// DTC ships no docs.
const FIRMS_WITH_DOCS: Firm[] = ["bny", "goldman", "allianzgi"];
const cache = new Map<Firm, FirmDoc[]>();

export function loadDocs(firm: Firm): FirmDoc[] {
  let docs = cache.get(firm);
  if (!docs) {
    if (FIRMS_WITH_DOCS.includes(firm)) requireFiles([`${firm}/docs`]);
    docs = readDocs(firm);
    cache.set(firm, docs);
  }
  return docs;
}
