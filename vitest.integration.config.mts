import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Level-B integration suites: the real Worker under workerd with its local D1, started and
 * restarted as separate processes (scripts/local-stack/harness.mjs), plus wrangler's real
 * migration tooling. Slow (minutes), so they run on demand and in CI, not in `npm test`.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/shang-hai/integration/**/*.test.ts"],
    testTimeout: 180_000,
    hookTimeout: 240_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
