// Attack console: runs one preset against the gateway and returns each step.
import { NextRequest } from "next/server";
import { ATTACKS, type AttackId } from "@/lib/attackCatalog";
import { runAttack } from "@/lib/attacks";

export async function POST(req: NextRequest) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!ATTACKS.some((a) => a.id === id)) return Response.json({ error: "unknown attack" }, { status: 400 });
  return Response.json(runAttack(id as AttackId));
}
