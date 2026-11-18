import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts"),
      "@": path.resolve(import.meta.dirname),
    },
  },
  test: { environment: "node", include: ["tests/**/*.test.ts"], testTimeout: 20000 },
});
