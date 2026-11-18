import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const loaders = ["bny", "goldman", "dtc", "allianzgi", "docs"].flatMap((f) => [`**/data/${f}`, `@/lib/data/${f}`]);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Firm boundary and cost guardrail, enforced at the import level:
    // agents, tools and screens read data only through DataScope, and every
    // model call goes through lib/llm/callModel.ts.
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["lib/data/**", "scripts/data-check.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [{ group: loaders, allowTypeImports: true, message: "Read firm data through DataScope (lib/data/scope.ts)." }],
          paths: [{ name: "openai", message: "Call models only through callModel() in lib/llm/." }],
        },
      ],
    },
  },
  {
    files: ["lib/llm/client.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "scripts/synthetic-data/**"]),
]);

export default eslintConfig;
