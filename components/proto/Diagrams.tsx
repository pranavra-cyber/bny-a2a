// The front page's two diagrams, in the prototype's navy and teal. Arrows always flow (dashes travel
// along each line); nothing to press. One: how trust is established with an outside firm. Two: what
// happens inside BNY once it is, with the databases, tools and the steps that wait for a person.
import { INSIDE_HEIGHT, layoutInside, ONBOARDING, ONBOARDING_BAND, ONBOARDING_CHIPS, OUT_HOPS, OUT_NODES, OUT_ZONES, type Box, type Hop, type Placed } from "@/lib/frontDiagrams";

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

function Pill({ b, person }: { b: Box; person: boolean }) {
  const c = person ? AMBER : TEAL;
  return (
    <g>
      <rect {...R(b)} rx={10} fill="#00243e" />
      <rect {...R(b)} rx={10} fill={c} fillOpacity={0.2} stroke={c} strokeWidth={1.2} />
      {person && (
        <g transform={`translate(${b.x + 11},${b.y + 11})`} fill="none" stroke={AMBER} strokeWidth={1.4}>
          <circle cy={-2} r={2.6} />
          <path d="M-4.2,5 a4.2,4.2 0 0 1 8.4,0" />
        </g>
      )}
      <text x={b.x + (person ? 63 : b.w / 2)} y={b.y + 14} textAnchor="middle" fontSize={10} fontWeight={700} fill={person ? "#ffd58a" : TEAL_SOFT}>
        {person ? "Person approves" : "Automatic"}
      </text>
    </g>
  );
}

/** Breaks a long title over two lines at the word nearest its middle. */
function wrap(t: string): string[] {
  if (t.length <= 14) return [t];
  const words = t.split(" ");
  let best = 1;
  for (let i = 1; i < words.length; i++) if (Math.abs(words.slice(0, i).join(" ").length - t.length / 2) < Math.abs(words.slice(0, best).join(" ").length - t.length / 2)) best = i;
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

function Group({ g, id }: { g: Placed; id: string }) {
  const addable = g.group.state === "addable";
  return (
    <g>
      <rect {...R(g.band)} rx={12} fill="white" fillOpacity={0.03} stroke="white" strokeOpacity={0.12} strokeDasharray={addable ? "4 5" : undefined} />
      <Node b={g.agent} title={wrap(g.group.title)} sub={g.group.sub} dashed={addable} stroke={addable ? "#8aa0b3" : TEAL} size={12.5} />
      {g.rows.map((r) => {
        const ay = g.agent.y + g.agent.h / 2;
        const person = r.human.by === "person";
        const stroke = r.state === "addable" ? "#8aa0b3" : TEAL;
        return (
          <g key={r.tool}>
            <path d={`M${g.agent.x + g.agent.w},${ay} C${g.agent.x + g.agent.w + 16},${ay} ${r.tool_.x - 16},${r.y} ${r.tool_.x},${r.y}`} fill="none" stroke={person ? AMBER : TEAL} strokeWidth={1.8} className="flow" markerEnd={`url(#${id}-${person ? "a" : "t"})`} />
            <Node b={r.tool_} title={r.tool} stroke={stroke} dashed={r.state === "addable"} size={11.5} fill="#0a4a6e" />
            <Arrow id={id} path={[[r.tool_.x + r.tool_.w, r.y], [r.data_.x, r.y]]} tone={person ? "a" : "t"} width={1.8} />
            <Pill b={r.pill} person={person} />
            <g>
              <rect {...R(r.data_)} rx={7} fill="#06314f" fillOpacity={0.9} stroke={person ? AMBER : stroke} strokeOpacity={0.9} strokeWidth={1.4} strokeDasharray={r.state === "addable" ? "5 4" : undefined} />
              <text x={r.data_.x + 12} y={r.y - 1.5} fontSize={11.5} fontWeight={600} fill="white">
                {r.data.title}
              </text>
              <text x={r.data_.x + 12} y={r.y + 11} fontSize={9.5} fill={TEAL_SOFT} fillOpacity={0.65}>
                {r.data.sub}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

export function InsideDiagram() {
  const id = "in";
  const l = layoutInside();
  const ops = l.groups[0];
  const oy = l.orch.y + l.orch.h / 2;
  return (
    <figure>
      <svg viewBox={`0 0 1000 ${INSIDE_HEIGHT}`} className="w-full" role="img" aria-label="What happens inside BNY after trust is established: agents, tools, databases and the steps that need a person">
        <Defs id={id} />
        <text x={130} y={19} fontSize={10.5} fill={TEAL_SOFT} fillOpacity={0.6} textAnchor="start">
          The reply goes back out through the gateway; only approved fields leave
        </text>

        {l.groups.map((g) => (
          <Group key={g.group.id} g={g} id={id} />
        ))}

        <Node b={l.gateway} title="BNY gateway" sub="request in, reply out" size={12.5} />
        <Node b={l.orch} title={["Settlement", "Fails", "Orchestrator"]} sub="routes the case" size={12.5} fill="#0a4a6e" />
        <Node b={l.outbound} title="Outbound filter" sub="automatic, rules only" size={12.5} />

        <Arrow id={id} path={[[l.gateway.x + l.gateway.w, oy], [l.orch.x, oy]]} />
        {l.groups.map((g) => (
          <path key={g.group.id} d={`M${l.orch.x + l.orch.w},${oy} C${l.orch.x + l.orch.w + 15},${oy} ${g.agent.x - 15},${g.agent.y + g.agent.h / 2} ${g.agent.x},${g.agent.y + g.agent.h / 2}`} fill="none" stroke={TEAL} strokeWidth={2} className="flow" markerEnd={`url(#${id}-t)`} />
        ))}
        <Arrow id={id} path={[[ops.agent.x + 70, ops.agent.y], [ops.agent.x + 70, l.outbound.y + l.outbound.h]]} />
        <Arrow id={id} path={[[l.outbound.x, l.outbound.y + 25], [l.gateway.x + l.gateway.w / 2, l.outbound.y + 25], [l.gateway.x + l.gateway.w / 2, l.gateway.y]]} />

        <rect {...R(l.audit)} rx={9} fill="white" fillOpacity={0.04} stroke="white" strokeOpacity={0.25} strokeDasharray="4 5" />
        <text x={l.audit.x + l.audit.w / 2} y={l.audit.y + l.audit.h / 2 + 4} textAnchor="middle" fontSize={12} fontWeight={600} fill={TEAL_SOFT}>
          Audit log: every tool call, approval and message is recorded
        </text>
      </svg>
      <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-white/60">
        <span className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-sm border" style={{ borderColor: TEAL, background: `${TEAL}30` }} /> Automatic: the agent acts alone
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-sm border" style={{ borderColor: AMBER, background: `${AMBER}30` }} /> A named person approves first
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-sm border border-dashed border-white/50" /> Could be connected next
        </span>
        <span>Solid boxes work in the prototype today.</span>
      </p>
    </figure>
  );
}
