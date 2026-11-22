"use client";
// Every control, split by who defines it (the A2A protocol, BNY's policy layer, or infrastructure)
// and how far the prototype takes it. The point: what comes with A2A, and what BNY has to build.
import { useState } from "react";
import { BUILD_LABEL, type Build, CONTROLS, type Layer, LAYER_LABEL } from "@/lib/journey";
import { BUILD_DOT, BuildTag, Card, LAYER_DOT, LayerTag } from "./parts";

const BUILDS: Build[] = ["enforced", "partly", "simulated", "missing"];
const LAYERS: Layer[] = ["protocol", "policy", "infra"];

export function Controls() {
  const [layer, setLayer] = useState<Layer | "all">("all");
  const rows = CONTROLS.filter((c) => layer === "all" || c.layer === layer);
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm transition ${on ? "border-white bg-white text-[#0b0d12] font-semibold" : "border-white/20 text-white/70 hover:border-white/50"}`;
  return (
    <div className="mt-8">
      <div className="grid gap-3 md:grid-cols-3">
        {LAYERS.map((l) => {
          const all = CONTROLS.filter((c) => c.layer === l);
          return (
            <Card key={l} className="p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: LAYER_DOT[l] }} />
                {LAYER_LABEL[l]}
              </p>
              <p className="mt-1 text-3xl font-semibold text-white tabular-nums">{all.length}</p>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
                {BUILDS.map((b) => (
                  <div key={b} style={{ width: `${(all.filter((c) => c.build === b).length / all.length) * 100}%`, background: BUILD_DOT[b] }} />
                ))}
              </div>
              <p className="mt-2 text-xs text-white/55">{BUILDS.map((b) => `${all.filter((c) => c.build === b).length} ${BUILD_LABEL[b].toLowerCase()}`).filter((t) => !t.startsWith("0")).join(" · ")}</p>
            </Card>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter by layer">
        <button className={chip(layer === "all")} onClick={() => setLayer("all")}>
          All {CONTROLS.length}
        </button>
        {LAYERS.map((l) => (
          <button key={l} className={chip(layer === l)} onClick={() => setLayer(l)}>
            {LAYER_LABEL[l]}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((c) => (
          <Card key={c.id} className="grid gap-x-6 gap-y-3 p-4 md:grid-cols-[210px_1fr_1fr]">
            <div>
              <p className="font-semibold text-white">{c.name}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <LayerTag layer={c.layer} />
                <BuildTag build={c.build} />
              </div>
              <p className="mt-2 text-xs text-white/45">Owner: {c.owner}</p>
            </div>
            <div>
              <p className="text-[11px] tracking-wider text-white/40 uppercase">In the prototype</p>
              <p className="mt-1 text-sm leading-relaxed text-white/75">{c.prototype}</p>
            </div>
            <div>
              <p className="text-[11px] tracking-wider text-white/40 uppercase">In production</p>
              <p className="mt-1 text-sm leading-relaxed text-white/75">{c.production}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
