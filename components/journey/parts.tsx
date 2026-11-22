// Shared pieces of the journey page: tags that say how real a thing is and who defines it, and the
// heading every section opens with. Dark prototype look, like the Secured stage.
import type { ReactNode } from "react";
import { BUILD_LABEL, type Build, type Layer, LAYER_LABEL } from "@/lib/journey";

export const BUILD_STYLE: Record<Build, string> = {
  enforced: "bg-[#3fbf7f]/15 text-[#3fbf7f]",
  partly: "bg-[#3fbf7f]/10 text-[#9bd9b8]",
  simulated: "bg-[#f0c674]/15 text-[#f0c674]",
  missing: "bg-white/10 text-white/55",
};
export const BUILD_DOT: Record<Build, string> = { enforced: "#3fbf7f", partly: "#9bd9b8", simulated: "#f0c674", missing: "#7b8494" };
export const LAYER_STYLE: Record<Layer, string> = {
  protocol: "bg-[#7fb2ff]/15 text-[#7fb2ff]",
  policy: "bg-[#8fd3c7]/12 text-[#8fd3c7]",
  infra: "bg-[#c9a7ff]/15 text-[#c9a7ff]",
};
export const LAYER_DOT: Record<Layer, string> = { protocol: "#7fb2ff", policy: "#8fd3c7", infra: "#c9a7ff" };

const tag = "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium leading-none";
export const BuildTag = ({ build }: { build: Build }) => <span className={`${tag} ${BUILD_STYLE[build]}`}>{BUILD_LABEL[build]}</span>;
export const LayerTag = ({ layer }: { layer: Layer }) => <span className={`${tag} ${LAYER_STYLE[layer]}`}>{LAYER_LABEL[layer]}</span>;

export function SectionHead({ n, id, label, title, children }: { n: number; id: string; label: string; title: string; children?: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-24 pt-16">
      <p className="flex items-center gap-3 font-mono text-xs tracking-widest text-[#3fbf7f] uppercase">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#3fbf7f]/50 text-[11px]">{n}</span>
        {label}
      </p>
      <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white">{title}</h2>
      {children && <div className="mt-3 max-w-3xl text-base leading-relaxed text-white/65">{children}</div>}
    </div>
  );
}

export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-white/10 bg-white/[0.035] ${className}`}>{children}</div>
);

export const btn = "rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 disabled:opacity-40";
