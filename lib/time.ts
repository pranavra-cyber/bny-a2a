// Display helpers. The synthetic data uses fixed offsets (ET = UTC-5, CET = UTC+1),
// so the UI does the same rather than applying daylight-saving rules.
const shift = (iso: string | Date, hours: number) => new Date(new Date(iso).getTime() + hours * 3600_000).toISOString();

export const fmtEt = (iso: string | Date, withDate = false) =>
  `${withDate ? shift(iso, -5).slice(5, 10) + " " : ""}${shift(iso, -5).slice(11, 19)} ET`;
export const fmtUtc = (iso: string | Date, withDate = false) =>
  `${withDate ? new Date(iso).toISOString().slice(5, 10) + " " : ""}${new Date(iso).toISOString().slice(11, 19)} UTC`;

/** ISO instant for an ET wall-clock time on a given date. */
export const etToIso = (date: string, hhmmss: string) => new Date(`${date}T${hhmmss}-05:00`).toISOString();

export function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export const fmtUsd = (n: number, digits = 4) => `$${n.toFixed(digits)}`;
