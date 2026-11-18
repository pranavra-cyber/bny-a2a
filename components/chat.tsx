"use client";
// Chat building blocks shared by the guided desks (case desk, onboarding desk).
import { useState } from "react";
import { useConfirm } from "./ui";

export function AssistantBubble({ name, avatar, tone, children }: { name: string; avatar: string; tone: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${tone}`}>{avatar}</div>
      <div className="max-w-[85%]">
        <div className="text-[11px] font-medium text-muted">{name}</div>
        <div className="mt-0.5 rounded-lg rounded-tl-none border border-line bg-canvas px-3 py-2 text-sm whitespace-pre-wrap">{children}</div>
      </div>
    </div>
  );
}

export function UserBubble({ label, tone, text }: { label: string; tone: string; text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] text-right">
        <div className="text-[11px] font-medium text-muted">{label}</div>
        <p className={`mt-0.5 rounded-lg rounded-tr-none px-3 py-2 text-left text-sm whitespace-pre-wrap text-white ${tone}`}>{text}</p>
      </div>
    </div>
  );
}

export function Chip({
  children,
  onClick,
  disabled,
  tone = "neutral",
  confirm,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "primary" | "primary-gs" | "cancel" | "question";
  /** Ask for a second click before acting (for actions that can't be undone). */
  confirm?: boolean;
}) {
  const { armed, trigger } = useConfirm();
  const cls = {
    neutral: "border-line bg-white text-ink hover:border-teal hover:bg-teal-soft",
    primary: "border-teal bg-teal text-white hover:bg-navy",
    "primary-gs": "border-gs bg-gs text-white hover:bg-gs-dark",
    cancel: "border-bad/50 bg-white text-bad hover:bg-bad-soft",
    question: "border-dashed border-line bg-white text-muted hover:border-teal hover:text-ink",
  }[tone];
  return (
    <button
      onClick={() => (confirm ? trigger(onClick) : onClick())}
      disabled={disabled}
      className={`rounded-full border px-3 py-1 text-left text-sm disabled:opacity-50 ${armed ? "border-bad bg-bad text-white" : cls}`}
    >
      {armed ? <>Click again to confirm: {children}</> : children}
    </button>
  );
}

export function Composer({ tone, disabled, onSend, placeholder }: { tone: string; disabled: boolean; onSend: (t: string) => void; placeholder: string }) {
  const [text, setText] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText("");
  };
  return (
    <form onSubmit={submit} className="mt-3 flex gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 rounded-md border border-line px-3 py-2 text-sm text-ink disabled:bg-canvas"
      />
      <button type="submit" disabled={disabled || !text.trim()} className={`rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 ${tone}`}>
        Send
      </button>
    </form>
  );
}

