// Synthetic chats that fill out each workspace's sidebar. Read-only transcripts:
// they show what else the assistants work on; only the live case is interactive.
// Safe for client components.

export type SideChat = {
  id: string;
  title: string;
  /** Short status shown under the title. */
  meta: string;
  status: "live" | "closed" | "open";
  messages: { from: "assistant" | "user" | "agent"; who: string; text: string }[];
};

export type Connection = { id: string; label: string; counterparty: string; chats: SideChat[] };

const closed = (id: string, title: string, meta: string, who: string, lines: string[]): SideChat => ({
  id,
  title,
  meta,
  status: "closed",
  messages: lines.map((text, i) => ({ from: i % 2 ? "agent" : "assistant", who: i % 2 ? who : "Settlement Fails Orchestrator", text })),
});

export const LIVE_CHAT_ID = "nvda-gs-0091";

export const BNY_CONNECTIONS: Connection[] = [
  {
    id: "gs",
    label: "BNY ⇄ Goldman Sachs",
    counterparty: "Goldman Sachs",
    chats: [
      { id: LIVE_CHAT_ID, title: "NVDA 10,000 · rejected delivery", meta: "Live · cutoff 11:30 ET", status: "live", messages: [] },
    ],
  },
  {
    id: "ms",
    label: "BNY ⇄ Morgan Stanley",
    counterparty: "Morgan Stanley",
    chats: [
      {
        id: "avgo-ms-0407",
        title: "AVGO 5,000 · SSI pending",
        meta: "Open · RQ-20261118-0407",
        status: "open",
        messages: [
          { from: "assistant", who: "Settlement Fails Orchestrator", text: "Morgan Stanley's new US equity SSI (SSI-MS-US-EQ-7101-B) is pending verification, so instruction BNYI-20261118-5528610 is held in repair." },
          { from: "agent", who: "MS Settlement Agent", text: "We confirm participant 7101 for US equities from 18 Nov. Our SSI change notice reference is MS-SSI-2026-1182." },
          { from: "assistant", who: "Settlement Fails Orchestrator", text: "Reference Data is verifying the new SSI. I'll update you when the instruction is released; repair cutoff 14:30 ET." },
        ],
      },
      closed("msft-ms-0365", "MSFT 2,000 · status check", "Closed 12 Nov", "MS Settlement Agent", [
        "Morgan Stanley's agent asked for the status of a pending receipt.",
        "Instruction status MATCHED; expected settlement today.",
        "Settled at 09:58 ET. No action needed.",
      ]),
      closed("tsla-ms-0391", "TSLA 1,200 · short delivery", "Resolved 14 Nov", "MS Settlement Agent", [
        "Morgan Stanley could deliver 800 of 1,200 TSLA.",
        "Our client accepted a partial: 800 today, 400 the next day.",
        "Both legs settled; case closed 15 Nov.",
      ]),
    ],
  },
  {
    id: "jpm",
    label: "BNY ⇄ J.P. Morgan",
    counterparty: "J.P. Morgan",
    chats: [
      closed("aapl-jpm-0372", "AAPL 4,500 · amount break", "Resolved 17 Nov", "JPM Fails Agent", [
        "J.P. Morgan's agent asked why its AAPL delivery DTC-DO-20261117-000214 was DK'd for an amount difference.",
        "Our settlement amount was $1,041,300.00; J.P. Morgan delivered against $1,041,325.00 after a commission correction.",
        "The client confirmed the corrected amount; J.P. Morgan redelivered and it settled at 11:42 ET.",
      ]),
      closed("goog-jpm-0350", "GOOGL 3,000 · late affirmation", "Resolved 10 Nov", "JPM Fails Agent", [
        "J.P. Morgan's agent reported its confirm was affirmed late in CTM.",
        "Our instruction matched once the affirmation arrived.",
        "Settled at 10:31 ET.",
      ]),
    ],
  },
];

export const GS_CONNECTIONS: Connection[] = [
  {
    id: "bny",
    label: "Goldman ⇄ BNY",
    counterparty: "BNY",
    chats: [
      { id: LIVE_CHAT_ID, title: "NVDA 10,000 · DK by BNY", meta: "Live · GS-FAIL-…0091", status: "live", messages: [] },
    ],
  },
  {
    id: "ss",
    label: "Goldman ⇄ State Street",
    counterparty: "State Street",
    chats: [
      closed("meta-ss-0211", "META 6,000 · DK", "Resolved 13 Nov", "State Street Fails Agent", [
        "State Street DK'd our META delivery: its client's allocation was split across two funds.",
        "We redelivered as two deliveries of 3,000.",
        "Both settled by 13:05 ET.",
      ]),
    ],
  },
];

export const BNY_EMPLOYEES = [
  { id: "orchestrator", name: "Settlement Fails Orchestrator", line: "Settlement fails across counterparties" },
  { id: "ssi", name: "Reference Data Assistant", line: "SSIs and counterparty static data" },
  { id: "recon", name: "Cash Reconciliation Assistant", line: "Breaks in cash ledgers" },
  { id: "corp-actions", name: "Corporate Actions Assistant", line: "Elections and entitlements" },
];

export function findSideChat(id: string): SideChat | undefined {
  for (const c of [...BNY_CONNECTIONS, ...GS_CONNECTIONS]) {
    const chat = c.chats.find((x) => x.id === id);
    if (chat) return chat;
  }
}
