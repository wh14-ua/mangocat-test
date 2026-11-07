#!/usr/bin/env node
// The staff panel ships as a generated bundle (workers/shang-hai-orders/panel/generated/assets.ts)
// committed with the Worker. Rebuilds it and fails if the committed one was out of date (a change
// to panel/client that was never rebuilt would deploy the OLD panel).
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const build = spawnSync("npm", ["--prefix", "workers/shang-hai-orders", "run", "--silent", "build:panel"], { cwd: ROOT, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);
const diff = spawnSync("git", ["diff", "--quiet", "--", "workers/shang-hai-orders/panel/generated"], { cwd: ROOT });
if (diff.status !== 0) {
  console.error("✗ The panel bundle was out of date: it has just been rebuilt — review and commit workers/shang-hai-orders/panel/generated/.");
  process.exit(1);
}
console.log("Panel bundle is up to date.");
