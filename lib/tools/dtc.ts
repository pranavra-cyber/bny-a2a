// DTC (mock depository): accepts a redelivery, matches it against the receiver's
// released instruction and emits INSTRUCTED then SETTLED (or DK) events.
import "server-only";
import { depositoryFeed } from "../data/scope";

export type DtcRedelivery = {
  dtc_reference: string;
  deliverer_participant: string;
  receiver_participant: string;
  isin: string;
  quantity: number;
  settlement_amount: number;
};

/** Next free delivery reference for a date, as DTC would issue it. */
export function nextDtcReference(date: string): string {
  const prefix = `DTC-DO-${date.replace(/-/g, "")}-`;
  const seqs = depositoryFeed()
    .filter((e) => e.dtc_reference.startsWith(prefix))
    .map((e) => Number(e.dtc_reference.slice(prefix.length)));
  return `${prefix}${String(Math.max(0, ...seqs) + 1).padStart(6, "0")}`;
}

export function eventRow(d: DtcRedelivery, event: "INSTRUCTED" | "SETTLED" | "DK", atIso: string, reason = "") {
  return {
    dtc_reference: d.dtc_reference,
    event_ts_et: new Date(new Date(atIso).getTime() - 5 * 3600_000).toISOString().slice(0, 19) + "-05:00",
    deliverer_participant: d.deliverer_participant,
    receiver_participant: d.receiver_participant,
    isin: d.isin,
    quantity: String(d.quantity),
    settlement_amount: String(d.settlement_amount),
    transaction_type: "DVP",
    event,
    reason_code: reason,
  };
}

/** Matches a delivery against the receiver's live receive quantity. */
export function matchDelivery(d: DtcRedelivery, receiverInstructedQty: number): "SETTLED" | "DK" {
  return d.quantity === receiverInstructedQty ? "SETTLED" : "DK";
}
