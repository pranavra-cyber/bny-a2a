// A Microsoft Teams (or email) message shown in the workspace: the trigger that
// sends each person to their task.
import { ChannelIcon, type Notice } from "./Shell";

export function TeamsCard({ n, compact = false }: { n: Notice; compact?: boolean }) {
  const teams = n.channel === "teams";
  return (
    <article className={`rounded-lg border bg-white shadow-sm ${teams ? "border-[#5b5fc7]/30" : "border-line"}`}>
      <header className={`flex items-center gap-2 rounded-t-lg px-4 py-2 text-xs ${teams ? "bg-[#5b5fc7]/10" : "bg-canvas"}`}>
        <ChannelIcon channel={n.channel} />
        <span className="font-semibold text-ink">{teams ? "Microsoft Teams" : n.channel === "email" ? "Email" : "Notification"}</span>
        <span className="text-muted">· {n.from}</span>
        {n.at && <span className="ml-auto tabular text-muted">{n.at}</span>}
      </header>
      <div className={compact ? "px-4 py-2.5" : "px-4 py-3"}>
        <p className="text-sm font-semibold text-navy">{n.title}</p>
        {n.detail && <p className={`mt-1 text-sm whitespace-pre-wrap text-ink ${compact ? "line-clamp-2" : ""}`}>{n.detail}</p>}
      </div>
    </article>
  );
}
