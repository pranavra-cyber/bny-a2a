// Goldman Sachs deterministic tools. Each takes a Goldman DataScope; the scope
// itself refuses any table outside Goldman's folder or rows of other participants.
import "server-only";
import type { GsAllocationConfirm, GsDelivery, GsFail, GsInventory, GsTrade } from "../data/goldman";
import type { DtcEvent } from "../data/dtc";
import type { ResolvedRecord } from "../engine/types";
import { accessed, type ToolCtx } from "./common";

export type GsCase = {
  fail: GsFail;
  delivery: GsDelivery;
  trade: GsTrade;
  allocation: GsAllocationConfirm;
  dtcEvents: DtcEvent[];
  inventory: GsInventory | undefined;
  records: ResolvedRecord[];
};

/** GS Fails Monitor: open DK fails whose delivery is in DK status, highest exposure first. */
export function findOpenDkFails(ctx: ToolCtx): { fail: GsFail; delivery: GsDelivery }[] {
  const deliveries = ctx.scope.read("goldman/deliveries");
  const out = ctx.scope
    .read("goldman/fails")
    .filter((f) => f.fail_reason === "DK_BY_RECEIVER" && f.status === "OPEN")
    .map((fail) => ({ fail, delivery: deliveries.find((d) => d.delivery_id === fail.delivery_id && d.status === "DK") }))
    .filter((x): x is { fail: GsFail; delivery: GsDelivery } => Boolean(x.delivery))
    .sort((a, b) => b.fail.exposure_usd - a.fail.exposure_usd);
  accessed(ctx, "findOpenDkFails", "goldman/fails", out.map((x) => x.fail));
  return out;
}

export function loadGsCase(ctx: ToolCtx, fail: GsFail, delivery: GsDelivery): GsCase {
  const s = ctx.scope;
  const trade = s.read("goldman/trade_blotter").find((t) => t.gs_trade_ref === delivery.gs_trade_ref);
  const allocation = s
    .read("goldman/allocations_confirms")
    .filter((a) => a.gs_trade_ref === delivery.gs_trade_ref && a.status !== "SUPERSEDED")
    .sort((a, b) => b.version - a.version)[0];
  if (!trade || !allocation) throw new Error(`Goldman records incomplete for ${delivery.delivery_id}`);
  const dtcEvents = s.read("dtc/settlement_activity").filter((e) => e.dtc_reference === delivery.dtc_reference);
  const inventory = s.read("goldman/inventory").find((i) => i.isin === delivery.isin);
  const records = [
    ...accessed(ctx, "getFail", "goldman/fails", [fail]),
    ...accessed(ctx, "getDelivery", "goldman/deliveries", [delivery]),
    ...accessed(ctx, "getTrade", "goldman/trade_blotter", [trade]),
    ...accessed(ctx, "getAllocationConfirm", "goldman/allocations_confirms", [allocation]),
    ...accessed(ctx, "getDtcEvents", "dtc/settlement_activity", dtcEvents),
    ...(inventory ? accessed(ctx, "getInventory", "goldman/inventory", [inventory]) : []),
  ];
  return { fail, delivery, trade, allocation, dtcEvents, inventory, records };
}
