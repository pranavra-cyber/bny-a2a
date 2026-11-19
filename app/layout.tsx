import type { Metadata } from "next";
import { Google_Sans_Flex, IBM_Plex_Sans, IBM_Plex_Serif } from "next/font/google";
import { ProtoProvider } from "@/components/proto/Proto";
import { setupProblems } from "@/lib/config";
import { dataSetupProblems } from "@/lib/consoles";
import { demoConfig } from "@/lib/demoConfig";
import "./globals.css";

const flex = Google_Sans_Flex({ variable: "--font-flex", subsets: ["latin"], fallback: ["Inter", "system-ui", "sans-serif"] });
// Goldman's own assistant: a different typeface, so it reads as another firm's product.
const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600", "700"], fallback: ["system-ui", "sans-serif"] });
const plexSerif = IBM_Plex_Serif({ variable: "--font-plex-serif", subsets: ["latin"], weight: ["400", "500", "600"], fallback: ["Georgia", "serif"] });

export const metadata: Metadata = {
  title: "Eliza A2A Prototype",
  description: "Illustrative agent-to-agent settlement-fail prototype (BNY × Goldman Sachs × AllianzGI).",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const problems = [...setupProblems(), ...dataSetupProblems()];
  return (
    <html lang="en" className={`${flex.variable} ${plex.variable} ${plexSerif.variable} h-full antialiased`}>
      <body className="min-h-full">
        {problems.length ? (
          <main className="mx-auto max-w-3xl p-8">
            <h1 className="text-2xl font-semibold text-navy">Setup needed</h1>
            <ul className="mt-4 list-disc space-y-2 pl-6 whitespace-pre-wrap">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </main>
        ) : (
          <ProtoProvider cfg={demoConfig()}>{children}</ProtoProvider>
        )}
      </body>
    </html>
  );
}
