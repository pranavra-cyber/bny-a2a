// The people in the prototype (from the operations-flow deck). Synthetic people;
// the portraits are illustrations in public/personas. Safe for client components.
import type { Seat } from "./engine/guide";

export type PersonaId = "chen" | "torres" | "sharma" | "kim" | "nguyen" | "hacker" | "insider";

export type Persona = {
  id: PersonaId;
  name: string;
  role: string;
  team: string;
  firm: "BNY" | "Goldman Sachs" | "Outside the network";
  photo: string;
  /** Which part of the prototype they play. */
  section: "Onboarding" | "Live A2A case" | "Oversight" | "Security tests";
  /** The task, as a title and one sentence. */
  task: string;
  taskLine: string;
  /** Their seat in the live case, if any. */
  seat?: Seat;
  /** Where the prototype takes them. */
  home: string;
  /** What they decide or approve (from the deck). */
  decides: string;
};

export const PERSONAS: Persona[] = [
  {
    id: "chen",
    name: "David Chen",
    role: "Agent Onboarding Lead",
    team: "BNY AI Hub",
    firm: "BNY",
    photo: "/personas/chen.svg",
    section: "Onboarding",
    task: "Onboard Goldman's fails agent",
    taskLine: "Check who is behind Goldman's agent, layer by layer, and decide what it may ask BNY.",
    home: "/eliza",
    decides: "Whether the agent joins, and with which permissions.",
  },
  {
    id: "torres",
    name: "Michael Torres",
    role: "Settlement Operations Associate",
    team: "Goldman Sachs Fails Desk",
    firm: "Goldman Sachs",
    photo: "/personas/torres.svg",
    section: "Live A2A case",
    task: "Chase the rejected delivery",
    taskLine: "Goldman's NVDA delivery was rejected by BNY; ask BNY's agent why, then hold and redeliver.",
    seat: "goldman",
    home: "/eliza/case",
    decides: "Any change to Goldman's own instruction, and the redelivery.",
  },
  {
    id: "sharma",
    name: "Priya Sharma",
    role: "Settlement Operations Lead",
    team: "BNY Settlement Ops",
    firm: "BNY",
    photo: "/personas/sharma.svg",
    section: "Live A2A case",
    task: "Find the cause and hand it over",
    taskLine: "Supervise BNY's Settlement Ops Agent as it finds whose side differs, and step in if it gets stuck.",
    seat: "bny",
    home: "/eliza/case",
    decides: "Instruction changes not sent by the client, and late-instruction exceptions.",
  },
  {
    id: "kim",
    name: "Daniel Kim",
    role: "Client Service Manager",
    team: "BNY Client Service",
    firm: "BNY",
    photo: "/personas/kim.svg",
    section: "Live A2A case",
    task: "Ask the client to re-instruct",
    taskLine: "Approve the agent's draft to the client, email it to AllianzGI, and pass the client's fix time back.",
    seat: "bny-cs",
    home: "/eliza/case",
    decides: "Every message to the client, before it is sent.",
  },
  {
    id: "nguyen",
    name: "Sarah Nguyen",
    role: "Compliance Officer",
    team: "BNY Compliance",
    firm: "BNY",
    photo: "/personas/nguyen.svg",
    section: "Oversight",
    task: "Review the closed case",
    taskLine: "Check that every approval was given and that only permitted data crossed the boundary.",
    home: "/eliza/audit",
    decides: "Whether approvals were given and only permitted data was shared.",
  },
  {
    id: "hacker",
    name: "Unknown attacker",
    role: "External threat actor",
    team: "No access to the network",
    firm: "Outside the network",
    photo: "/personas/hacker.svg",
    section: "Security tests",
    task: "Get past BNY's gateway from outside",
    taskLine: "Pose as Goldman, forge its Agent Card, steal its pass, replay or edit its messages.",
    home: "/attack",
    decides: "Nothing: every attempt is stopped and logged.",
  },
  {
    id: "insider",
    name: "Jordan Blake",
    role: "Operations Analyst (rogue insider)",
    team: "Goldman Sachs Operations",
    firm: "Goldman Sachs",
    photo: "/personas/insider.svg",
    section: "Security tests",
    task: "Misuse Goldman's real agent",
    taskLine: "Use the registered, trusted agent to inject instructions, fish for client data or exceed its permissions.",
    home: "/attack",
    decides: "Nothing: the gateway limits what the real agent can get.",
  },
];

export const personaById = (id: string | null | undefined) => PERSONAS.find((p) => p.id === id);
export const personaForSeat = (seat: Seat) => PERSONAS.find((p) => p.seat === seat)!;

/** The client contact: outside the prototype, reached by Teams and email. */
export const CLIENT = { name: "Emily Carter", role: "Trade Operations Analyst", firm: "Allianz Global Investors", photo: "/personas/carter.svg" };
