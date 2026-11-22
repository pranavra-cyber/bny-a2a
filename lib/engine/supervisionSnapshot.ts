// Captures, from the recording that replay mode plays, the real gateway results the Supervision
// chat shows: the inquiry as sent, the gateway's checks, and each outbound reply with the checks and
// fields the real outbound filter returned. The result is saved as supervision-snapshot.json so the
// chat replays accurately without a run. Regenerate with `npm run supervision:snapshot`; a test fails
// if the file no longer matches the recordings.
import "server-only";
import type { GatewayCheck } from "../a2a/types";
import { findRecording, type Recording } from "./persist";
import type { RunEvent } from "./types";

export type SnapshotMessage = { text: string; fields: string[] };
export type SnapshotGateway = { title: string; checks: GatewayCheck[] };
export type SnapshotReply = { text: string; shared: string[]; gateway: SnapshotGateway };

export type ScenarioSnapshot = {
  recording: string;
  inquiry: SnapshotMessage;
  accepted: SnapshotGateway;
  /** BNY's replies through the outbound filter, by what they say. */
  hold?: SnapshotReply;
  fix?: SnapshotReply;
  reference?: SnapshotReply;
  /** Goldman's second message (fp3: the reference it gives), and the gateway's result on it. */
  followup?: SnapshotMessage & { gateway: SnapshotGateway };
};

export const SNAPSHOT_SCENARIOS = ["golden", "fp3", "fp4", "fp5"] as const;
export type SnapshotScenario = (typeof SNAPSHOT_SCENARIOS)[number];

const fieldsOf = (e?: RunEvent): string[] => {
  const parts = (e?.envelope as { params?: { message?: { parts?: { kind: string; data?: Record<string, unknown> }[] } } } | undefined)?.params?.message?.parts ?? [];
  return parts.filter((p) => p.kind === "data").flatMap((p) => Object.keys(p.data ?? {}));
};

export function extractSnapshot(rec: Recording): ScenarioSnapshot {
  const ev = rec.events;
  const gatewayAfter = (e: RunEvent) => ev.slice(ev.indexOf(e) + 1).find((x) => x.kind === "gateway")!;
  const gw = (e: RunEvent): SnapshotGateway => ({ title: e.title, checks: e.checks ?? [] });
  const sent = ev.filter((e) => e.kind === "message" && e.lane === "goldman" && e.flags?.includes("outbound"));
  const reply = (re: RegExp): SnapshotReply | undefined => {
    const m = ev.find((e) => e.kind === "message" && e.lane === "bny" && e.flags?.includes("outbound") && re.test(e.title));
    if (!m) return undefined;
    const g = gatewayAfter(m);
    return { text: m.detail ?? "", shared: fieldsOf(g), gateway: gw(g) };
  };
  const snap: ScenarioSnapshot = {
    recording: rec.runId,
    inquiry: { text: sent[0].detail ?? "", fields: fieldsOf(sent[0]) },
    accepted: gw(gatewayAfter(sent[0])),
    hold: reply(/client asked to confirm, please hold/),
    fix: reply(/fix expected/),
    reference: reply(/record reference requested/),
  };
  if (rec.scenario === "fp3" && sent[1]) snap.followup = { text: sent[1].detail ?? "", fields: fieldsOf(sent[1]), gateway: gw(gatewayAfter(sent[1])) };
  return JSON.parse(JSON.stringify(snap)); // drop undefined keys, as the saved file does
}

/** The recording replay mode plays for a scenario (the guided one, as the case page uses). */
export const replayRecording = (s: SnapshotScenario) => findRecording(s, (r) => r.events.some((e) => e.kind === "checkpoint")) ?? findRecording(s);

export function buildSnapshot(): Record<SnapshotScenario, ScenarioSnapshot> {
  return Object.fromEntries(
    SNAPSHOT_SCENARIOS.map((s) => {
      const rec = replayRecording(s);
      if (!rec) throw new Error(`no recording for ${s}`);
      return [s, extractSnapshot(rec)];
    }),
  ) as Record<SnapshotScenario, ScenarioSnapshot>;
}
