"use client";
// A read-only chat from the sidebar: other cases and digital employees, to show
// what else the assistants handle. Only the NVDA case is interactive.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BNY_EMPLOYEES, findSideChat } from "@/lib/sideChats";
import { useProto } from "../proto/Proto";
import { Pill } from "../ui";
import { AssistantMsg } from "./ChatThread";
import { Shell } from "./Shell";

export function SideChatView() {
  const id = useSearchParams().get("chat") ?? "";
  const { persona } = useProto();
  const seat = persona.firm === "Goldman Sachs" ? "goldman" : "bny";
  const chat = findSideChat(id);
  const employee = BNY_EMPLOYEES.find((e) => e.id === id);
  return (
    <Shell title={chat?.title ?? employee?.name ?? "Chat"} subtitle={chat ? chat.meta : employee?.line}>
      <div className="mx-auto max-w-3xl space-y-5 px-5 py-6">
        <p className="flex items-center gap-2 text-xs text-muted">
          <Pill tone={chat?.status === "open" ? "warn" : "neutral"}>{chat?.status === "open" ? "Open" : chat ? "Closed" : "Example"}</Pill>
          Read-only in this prototype.{" "}
          <Link href="/eliza/case" className="font-medium text-teal hover:underline">
            Go to the live NVDA case →
          </Link>
        </p>
        {chat ? (
          chat.messages.map((m, i) =>
            m.from === "agent" ? (
              <div key={i} className="ml-11 rounded-lg border border-line bg-white px-4 py-3">
                <p className="text-xs font-medium text-muted">{m.who} · via the network</p>
                <p className="mt-1 text-sm text-ink">{m.text}</p>
              </div>
            ) : (
              <AssistantMsg key={i} seat={seat}>
                {m.text}
              </AssistantMsg>
            ),
          )
        ) : (
          <AssistantMsg seat={seat}>{`Hi ${persona.name.split(" ")[0]}. ${employee ? `I handle ${employee.line.toLowerCase()}.` : ""} Nothing needs you here today.`}</AssistantMsg>
        )}
      </div>
    </Shell>
  );
}
