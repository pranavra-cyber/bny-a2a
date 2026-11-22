// The front page's two diagrams, in the prototype's navy and teal. Arrows always flow (dashes travel
// along each line); nothing to press. One: how trust is established with an outside firm. Two: what
// happens inside BNY once it is, with the databases, tools and the steps that wait for a person.
import { IN_CAPTIONS, IN_ZONES, INSIDE_HEIGHT, layoutInside, ONBOARDING, ONBOARDING_BAND, ONBOARDING_CHIPS, OUT_HOPS, OUT_NODES, OUT_ZONES, type Box, type Hop } from "@/lib/frontDiagrams";

const TEAL = "#2b9cae";
const TEAL_SOFT = "#bfe6ee";
const GS = "#7cc49c";
const AMBER = "#f2b34b";
const NODE = "#0b3a5c";

/** SVG wants width and height, the layout data says w and h. */
const R = (b: Box) => ({ x: b.x, y: b.y, width: b.w, height: b.h });
const d = (p: [number, number][]) => p.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");

function Defs({ id }: { id: string }) {
  return (
    <defs>
      {[
        ["t", TEAL],
        ["g", GS],
        ["a", AMBER],
      ].map(([k, c]) => (
        <marker key={k} id={`${id}-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={c} />
        </marker>
      ))}
    </defs>
  );
}

function Arrow({ path, id, tone = "t", width = 2 }: { path: [number, number][]; id: string; tone?: "t" | "g" | "a"; width?: number }) {
  const c = tone === "t" ? TEAL : tone === "g" ? GS : AMBER;
  return <path d={d(path)} fill="none" stroke={c} strokeWidth={width} className="flow" markerEnd={`url(#${id}-${tone})`} strokeLinejoin="round" />;
}

function Node({ b, title, sub, stroke = TEAL, dashed, fill = NODE, size = 13 }: { b: Box; title: string[] | string; sub?: string; stroke?: string; dashed?: boolean; fill?: string; size?: number }) {
  const lines = Array.isArray(title) ? title : [title];
  const total = lines.length + (sub ? 0.85 : 0);
  const y0 = b.y + b.h / 2 - (total * (size + 3)) / 2 + size;
  return (
    <g>
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={9} fill={fill} fillOpacity={0.85} stroke={stroke} strokeWidth={1.6} strokeDasharray={dashed ? "5 4" : undefined} />
      {lines.map((t, i) => (
        <text key={t} x={b.x + b.w / 2} y={y0 + i * (size + 3)} textAnchor="middle" fontSize={size} fontWeight={600} fill="white">
          {t}
        </text>
      ))}
      {sub && (
        <text x={b.x + b.w / 2} y={y0 + lines.length * (size + 3) - 1} textAnchor="middle" fontSize={size - 2.5} fill={TEAL_SOFT} fillOpacity={0.7}>
          {sub}
        </text>
      )}
    </g>
  );
}

export function OutsideDiagram() {
  const id = "out";
  const tone = { goldman: GS, net: "#8aa0b3", bny: TEAL };
  return (
    <figure>
      <svg viewBox="0 0 1000 520" className="w-full" role="img" aria-label="How trust is established between Goldman's agent and BNY before a request is answered">
        <Defs id={id} />
        {OUT_ZONES.map((z) => (
          <g key={z.id}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={14} fill={tone[z.tone]} fillOpacity={z.tone === "net" ? 0.04 : 0.07} stroke={tone[z.tone]} strokeOpacity={0.45} strokeDasharray={z.tone === "net" ? "3 6" : undefined} />
            <text x={z.x + z.w / 2} y={z.y + 22} textAnchor="middle" fontSize={12} fontWeight={600} fill={tone[z.tone]}>
              {z.label}
            </text>
          </g>
        ))}

        <rect {...R(ONBOARDING_BAND)} rx={12} fill={TEAL} fillOpacity={0.06} stroke={TEAL} strokeOpacity={0.35} strokeDasharray="3 5" />
        <text x={ONBOARDING_BAND.x + 12} y={ONBOARDING_BAND.y + 22} fontSize={11.5} fontWeight={600} fill={TEAL_SOFT} fillOpacity={0.85}>
          Done once per firm, before the first message
        </text>
        {ONBOARDING_CHIPS.map((c, i) => (
          <g key={ONBOARDING[i]}>
            <rect {...R(c)} rx={8} fill={NODE} fillOpacity={0.85} stroke={TEAL} strokeOpacity={0.7} />
            <text x={c.x + c.w / 2} y={c.y + c.h / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="white">
              {ONBOARDING[i]}
            </text>
            {i < ONBOARDING.length - 1 && <Arrow id={id} path={[[c.x + c.w, c.y + c.h / 2], [c.x + c.w + 10, c.y + c.h / 2]]} width={1.6} />}
          </g>
        ))}

        {OUT_HOPS.map((h: Hop, i) => (
          <Arrow key={i} id={id} path={h.path} tone={h.n && h.n <= 3 ? "g" : "t"} width={2.2} />
        ))}
        {OUT_HOPS.filter((h) => h.n).map((h) => {
          const p = h.path;
          const k = Math.floor((p.length - 1) / 2);
          const x = (p[k][0] + p[k + 1][0]) / 2;
          const y = (p[k][1] + p[k + 1][1]) / 2;
          return (
            <g key={h.n} transform={`translate(${x},${y})`}>
              <circle r={10} fill="#00243e" stroke={h.n! <= 3 ? GS : TEAL} strokeWidth={1.6} />
              <text textAnchor="middle" y={4} fontSize={11} fontWeight={700} fill="white">
                {h.n}
              </text>
            </g>
          );
        })}
        {OUT_NODES.map((n) => (
          <Node key={n.id} b={n} title={n.title} sub={n.sub} stroke={n.side === "goldman" ? GS : TEAL} dashed={n.dashed} />
        ))}
      </svg>
      <figcaption className="mt-3 grid gap-x-6 gap-y-1.5 text-sm text-white/75 sm:grid-cols-2 lg:grid-cols-3">
        {OUT_HOPS.filter((h) => h.n).map((h) => (
          <p key={h.n} className="flex gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold text-white" style={{ borderColor: h.n! <= 3 ? GS : TEAL }}>
              {h.n}
            </span>
            {h.caption}
          </p>
        ))}
      </figcaption>
      <p className="mt-2 text-xs text-white/50">Dashed outline: simulated in the prototype. The checks at the gateway run for real.</p>
    </figure>
  );
}

function Badge({ x, y, n, tone = TEAL }: { x: number; y: number; n: number; tone?: string }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle r={10} fill="#00243e" stroke={tone} strokeWidth={1.6} />
      <text textAnchor="middle" y={4} fontSize={11} fontWeight={700} fill="white">
        {n}
      </text>
    </g>
  );
}

/** A curve from a box's right edge to the left edge of another, so a fan of them reads as one hand-off. */
const link = (from: [number, number], to: [number, number]) => `M${from[0]},${from[1]} C${from[0] + 22},${from[1]} ${to[0] - 22},${to[1]} ${to[0]},${to[1]}`;

function PersonNode({ b, title, sub }: { b: Box; title: string; sub: string }) {
  return (
    <g>
      <rect {...R(b)} rx={8} fill="#3a2d10" fillOpacity={0.9} stroke={AMBER} strokeWidth={1.6} />
      <g transform={`translate(${b.x + 17},${b.y + b.h / 2 + 1})`} fill="none" stroke={AMBER} strokeWidth={1.5}>
        <circle cy={-4} r={3.4} />
        <path d="M-5.6,6 a5.6,5.6 0 0 1 11.2,0" />
      </g>
      <text x={b.x + 34} y={b.y + 15} fontSize={12} fontWeight={600} fill="white">
        {title}
      </text>
      <text x={b.x + 34} y={b.y + 28} fontSize={9.5} fill="#ffd58a" fillOpacity={0.85}>
        {sub}
      </text>
    </g>
  );
}

function DataNode({ b, title, sub, addable }: { b: Box; title: string; sub: string; addable?: boolean }) {
  return (
    <g>
      <rect {...R(b)} rx={8} fill="#06314f" fillOpacity={0.9} stroke={addable ? "#8aa0b3" : TEAL} strokeWidth={1.5} strokeDasharray={addable ? "5 4" : undefined} />
      <text x={b.x + 12} y={b.y + 15} fontSize={12} fontWeight={600} fill="white">
        {title}
      </text>
      <text x={b.x + 12} y={b.y + 28} fontSize={9.5} fill={TEAL_SOFT} fillOpacity={0.65}>
        {sub}
      </text>
    </g>
  );
}

export function InsideDiagram() {
  const id = "in";
  const l = layoutInside();
  const tone = { goldman: GS, bny: TEAL };
  const right = (b: Box): [number, number] => [b.x + b.w, b.y + b.h / 2];
  const left = (b: Box): [number, number] => [b.x, b.y + b.h / 2];
  const ops = l.groups[0];
  const client = l.groups[1];
  return (
    <figure>
      <svg viewBox={`0 0 1000 ${INSIDE_HEIGHT}`} className="w-full" role="img" aria-label="What happens inside BNY after trust is established: agents, databases and the steps that need a person">
        <Defs id={id} />
        {IN_ZONES.map((z) => (
          <g key={z.id}>
            <rect {...R(z)} rx={14} fill={tone[z.tone]} fillOpacity={0.07} stroke={tone[z.tone]} strokeOpacity={0.45} />
            <text x={z.x + z.w / 2} y={z.y + 22} textAnchor="middle" fontSize={12} fontWeight={600} fill={tone[z.tone]}>
              {z.label}
            </text>
          </g>
        ))}

        {/* The way in, as in the first diagram */}
        <Arrow id={id} tone="g" path={[[142, 195], [180, 195]]} />
        <Arrow id={id} path={[[270, 230], [270, l.gate.y]]} />
        <Arrow id={id} path={[[360, l.cy], [405, l.cy]]} />
        {/* The way back out */}
        <Arrow id={id} path={[[l.orch.x + 40, l.orch.y + l.orch.h], [l.orch.x + 40, 505], [360, 505]]} />
        <Arrow id={id} tone="g" path={[[180, 505], [85, 505], [85, 240]]} />

        {/* The orchestrator hands the case to each agent */}
        {l.groups.map((g) => (
          <path key={g.group.id} d={link(right(l.orch), left(g.agent))} fill="none" stroke={g.group.state === "addable" ? "#8aa0b3" : TEAL} strokeWidth={2} className="flow" markerEnd={`url(#${id}-t)`} />
        ))}
        {/* Each agent reaches its databases, or waits for a person */}
        {l.groups.map((g) =>
          g.items.map((it) => (
            <path key={it.title} d={link(right(g.agent), left(it.box))} fill="none" stroke={it.kind === "person" ? AMBER : it.kind === "addable" ? "#8aa0b3" : TEAL} strokeWidth={1.8} className="flow" markerEnd={`url(#${id}-${it.kind === "person" ? "a" : "t"})`} />
          )),
        )}

        <Node b={l.gs} title="Goldman's agent" sub="outside BNY" stroke={GS} size={12.5} />
        <Node b={l.edge} title="mTLS edge" sub="encrypted, identified" dashed />
        <Node b={l.gate} title="Intake Gateway" sub="six checks, no model" />
        <Node b={l.outbound} title="Outbound filter" sub="approved fields only" />
        <Node b={l.orch} title={["Settlement", "Fails", "Orchestrator"]} sub="routes the case" size={12.5} fill="#0a4a6e" />
        {l.groups.map((g) => (
          <Node key={g.group.id} b={g.agent} title={g.group.title} sub={g.group.sub} dashed={g.group.state === "addable"} stroke={g.group.state === "addable" ? "#8aa0b3" : TEAL} size={12} />
        ))}
        {l.groups.flatMap((g) => g.items).map((it) => (it.kind === "person" ? <PersonNode key={it.title} b={it.box} title={it.title} sub={it.sub} /> : <DataNode key={it.title} b={it.box} title={it.title} sub={it.sub} addable={it.kind === "addable"} />))}

        <Badge x={161} y={195} n={1} tone={GS} />
        <Badge x={270} y={(230 + l.gate.y) / 2} n={2} />
        <Badge x={382} y={l.cy} n={3} />
        <Badge x={545} y={l.cy} n={4} />
        <Badge x={722} y={(right(ops.agent)[1] + left(ops.items[1].box)[1]) / 2 + 2} n={5} />
        <Badge x={722} y={(right(client.agent)[1] + left(client.items[1].box)[1]) / 2 + 2} n={6} tone={AMBER} />
        <Badge x={l.orch.x + 40} y={(l.orch.y + l.orch.h + 505) / 2} n={7} />
        <Badge x={85} y={380} n={8} tone={GS} />
      </svg>
      <figcaption className="mt-3 grid gap-x-6 gap-y-1.5 text-sm text-white/75 sm:grid-cols-2 lg:grid-cols-3">
        {IN_CAPTIONS.map((c, i) => (
          <p key={c} className="flex gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold text-white" style={{ borderColor: i === 5 ? AMBER : i === 0 || i === 7 ? GS : TEAL }}>
              {i + 1}
            </span>
            {c}
          </p>
        ))}
      </figcaption>
      <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-white/60">
        <span className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-sm border" style={{ borderColor: TEAL }} /> Reads on its own
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-sm border" style={{ borderColor: AMBER, background: `${AMBER}30` }} /> A named person approves first
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-sm border border-dashed border-white/50" /> Could be connected next
        </span>
        <span>Every step is written to the audit log.</span>
      </p>
    </figure>
  );
}
