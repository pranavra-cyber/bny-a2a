"use client";
// The attack console as a tab of the Eliza workspace, for BNY's own people (a security test of
// BNY's gateway). Everyone else is pointed away: the standalone /attack stage stays as it was.
import Link from "next/link";
import { AttackConsole } from "../attack/AttackConsole";
import { useProto } from "../proto/Proto";
import { Shell } from "./Shell";

export function AttackWorkspace() {
  const { persona, hydrated } = useProto();
  const note = (text: string, withLink: boolean) => (
    <p className="mx-auto max-w-xl px-6 py-12 text-sm text-muted">
      {text}{" "}
      {withLink && (
        <Link href="/attack" className="font-medium text-teal hover:underline">
          Open the attack console
        </Link>
      )}
    </p>
  );
  let body: React.ReactNode = null;
  if (hydrated) {
    if (persona.firm === "BNY") body = <AttackConsole embedded />;
    else if (persona.id === "hacker" || persona.id === "insider") body = note("From outside BNY you work from the attack console stage.", true);
    else body = note("The attack console tests BNY's gateway and is part of BNY's workspace.", false);
  }
  return (
    <Shell title="Attack console" subtitle="Try to get past BNY's gateway · runs the real gateway code">
      {body}
    </Shell>
  );
}
