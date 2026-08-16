#!/usr/bin/env node
/**
 * Stop the local dev stack: web, oracle, workers, and the concurrently
 * supervisor that started them. Leaves Postgres + Redis running (use
 * `npm run stop:all` to also tear those down).
 *
 * Safe to run when nothing's running — it just reports "nothing to stop".
 */
import { execSync, spawnSync } from "node:child_process";

const GREEN = "\x1b[32m";
const GRAY = "\x1b[90m";
const RESET = "\x1b[0m";
const ok = (m) => console.log(`${GREEN}✓${RESET} ${m}`);
const info = (m) => console.log(`${GRAY}[stop]${RESET} ${m}`);

function tryKill(pid, signal = "TERM") {
  try {
    execSync(`kill -${signal} ${pid}`);
    return true;
  } catch {
    return false;
  }
}

function parentPidOf(pid) {
  try {
    return execSync(`ps -p ${pid} -o ppid=`, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

// Process patterns specific to this repo. Each must match THIS app only —
// `pkill -f` matches the full command line so we anchor on the absolute path.
const ROOT = process.cwd();
const patterns = [
  `concurrently.* ${ROOT}`,
  `concurrently .*-c blue,magenta`,
  `next-server`,
  `node .*${ROOT}.*next/dist`,
  `tsx watch.*${ROOT}/src/workers`,
  `tsx watch.*${ROOT}/packages/oracle`,
  `tsx watch src/index.ts`,
  `npm --prefix ${ROOT}/packages/oracle run dev`,
];

let killed = 0;
for (const p of patterns) {
  const r = spawnSync("pkill", ["-TERM", "-f", p], { stdio: "ignore" });
  if (r.status === 0) killed++;
}

// Belt-and-braces: anything still listening on our dev ports gets a SIGTERM.
for (const port of [3000, 3002]) {
  try {
    const pids = execSync(`lsof -ti :${port} -sTCP:LISTEN 2>/dev/null`, { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean);
    for (const pid of pids) {
      if (tryKill(pid, "TERM")) {
        info(`killed pid ${pid} on port ${port}`);
        killed++;

        // If listener is managed by a watcher (tsx/npm), killing only the
        // child node can trigger an immediate respawn. Also terminate parent.
        const parentPid = parentPidOf(pid);
        if (parentPid && parentPid !== "1" && tryKill(parentPid, "TERM")) {
          info(`killed parent pid ${parentPid} for port ${port}`);
          killed++;
        }
      }
    }
  } catch { /* nothing listening */ }
}

if (killed === 0) {
  info("nothing to stop");
} else {
  // Give them ~1s to exit cleanly, then SIGKILL any holdouts.
  await new Promise((r) => setTimeout(r, 1000));
  for (const port of [3000, 3002]) {
    try {
      const pids = execSync(`lsof -ti :${port} -sTCP:LISTEN 2>/dev/null`, { encoding: "utf8" })
        .trim().split("\n").filter(Boolean);
      for (const pid of pids) {
        if (tryKill(pid, "KILL")) {
          info(`force-killed pid ${pid} on port ${port}`);
        }
        const parentPid = parentPidOf(pid);
        if (parentPid && parentPid !== "1" && tryKill(parentPid, "KILL")) {
          info(`force-killed parent pid ${parentPid} for port ${port}`);
        }
      }
    } catch { /* gone */ }
  }
  ok("dev stack stopped");
}
