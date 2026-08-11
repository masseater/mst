import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { text } from "node:stream/consumers";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { lock } from "proper-lockfile";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { ensureSlots } from "./slots.ts";

const CLI_PATH = fileURLToPath(new URL("./cli.ts", import.meta.url));
const DEFAULT_SLOT_DIR = join(tmpdir(), "mst-throttle", "mst");

type ProcessReport = {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

const collect = async (executable: string, args: readonly string[]): Promise<ProcessReport> => {
  const child = spawn(executable, [...args], { stdio: ["ignore", "pipe", "pipe"] });
  const childEnd = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve) => {
      child.once("exit", (code, signal) => {
        resolve({ code, signal });
      });
    },
  );
  const [stdout, stderr, end] = await Promise.all([
    text(child.stdout),
    text(child.stderr),
    childEnd,
  ]);
  return { code: end.code, signal: end.signal, stdout, stderr };
};

const waitUntil = async (isDone: () => boolean): Promise<void> => {
  if (isDone()) return;
  await delay(100);
  return waitUntil(isDone);
};

const acquireDefaultSlot = async (): Promise<() => Promise<void>> => {
  ensureSlots(DEFAULT_SLOT_DIR, 1);
  try {
    return await lock(join(DEFAULT_SLOT_DIR, "slot-0"), { stale: 60_000, retries: 0 });
  } catch (heldElsewhere) {
    await delay(200);
    return acquireDefaultSlot();
  }
};

describe("cli", () => {
  test(
    "a call without a command prints the usage on stderr and exits 2",
    { timeout: 20_000 },
    async () => {
      const report = await collect(process.execPath, [CLI_PATH]);

      expect(report.code).toBe(2);
      expect(report.stdout).toBe("");
      expect(report.stderr).toContain("Usage: throttle");
    },
  );

  test(
    "the child's streams pass through byte for byte, plus only throttle's own stderr lines",
    { timeout: 30_000 },
    async () => {
      const script =
        "process.stdout.write('alpha\\nbeta\\n'); process.stderr.write('gamma\\ndelta\\n');";

      const direct = await collect(process.execPath, ["-e", script]);
      const wrapped = await collect(process.execPath, [
        CLI_PATH,
        "--",
        process.execPath,
        "-e",
        script,
      ]);

      expect(direct.code).toBe(0);
      expect(wrapped.code).toBe(0);
      expect(wrapped.stdout).toBe(direct.stdout);
      const passthrough = wrapped.stderr
        .split("\n")
        .filter((line) => !line.startsWith("throttle: "))
        .join("\n");
      expect(passthrough).toBe(direct.stderr);
    },
  );

  test(
    "a waiting wrapper removes its queue entry and dies of the forwarded signal",
    { timeout: 30_000 },
    async () => {
      vi.stubEnv("MST_THROTTLE_LIMIT", "");
      onTestFinished(() => {
        vi.unstubAllEnvs();
      });
      const release = await acquireDefaultSlot();
      onTestFinished(async () => {
        await release();
      });
      const waitersDir = join(DEFAULT_SLOT_DIR, "waiters");
      const child = spawn(process.execPath, [CLI_PATH, "--", process.execPath, "-e", ""], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      const childDeath = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
        (resolve) => {
          child.once("exit", (code, signal) => {
            resolve({ code, signal });
          });
        },
      );
      const ownEntries = (): string[] =>
        readdirSync(waitersDir).filter((name) => name.includes(`-${child.pid}-`));

      await waitUntil(() => ownEntries().length === 1);

      child.kill("SIGTERM");
      const death = await childDeath;

      expect(death.signal).toBe("SIGTERM");
      await waitUntil(() => ownEntries().length === 0);
      expect(ownEntries()).toHaveLength(0);
    },
  );
});
