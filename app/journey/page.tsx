import { connection } from "next/server";
import { Journey } from "@/components/journey/Journey";
import { runDrills } from "@/lib/drills";

export default async function Page() {
  // The drills run through the gateway with live tokens, so render per request, not at build time.
  await connection();
  return <Journey drills={runDrills()} />;
}
