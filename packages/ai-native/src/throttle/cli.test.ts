import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { text } from "node:stream/consumers";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { lock } from "proper-lockfile";
import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { ensureSlots } from "./slots.ts";

const CLI_PATH = fileURLToPath(new URL("./cli.ts", import.meta.url));

const isolatedTmp = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "throttle-cli-tmp-"));
  onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
};

const slotDirUnder = (tmpRoot: string): string => join(tmpRoot, "mst-throttle", "mst");

type ProcessReport = {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
};

const collect = async (invocation: {
  executable: string;
  args: readonly string[];
  tmpRoot: string;
}): Promise<ProcessReport> => {
  const child = spawn(invocation.executable, [...invocation.args], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, TMPDIR: invocation.tmpRoot },
  });
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

const acquireSlotIn = async (slotDir: string): Promise<() => Promise<void>> => {
  ensureSlots(slotDir, 1);
  try {
    return await lock(join(slotDir, "slot-0"), { stale: 60_000, retries: 0 });
  } catch (slotStillHeld) {
    await delay(200);
    return acquireSlotIn(slotDir);
  }
};

describe("cli", () => {
  test("the entry forwards its arguments and exposes the throttle exit code", async () => {
    const originalExitCode = process.exitCode;
    onTestFinished(() => {
      process.exitCode = originalExitCode;
      vi.doUnmock("./run-throttle.ts");
    });
    const runThrottle = vi.fn<() => Promise<number>>().mockResolvedValue(17);
    vi.doMock(import("./run-throttle.ts"), () => ({ runThrottle }));
    await import("./cli.ts");

    expect(runThrottle).toHaveBeenCalledExactlyOnceWith(process.argv.slice(2));
    expect(process.exitCode).toBe(17);
  });

  test(
    "a call without a command prints the usage on stderr and exits 2",
    { timeout: 20_000 },
    async () => {
      const report = await collect({
        executable: process.execPath,
        args: [CLI_PATH],
        tmpRoot: isolatedTmp(),
      });

      expect(report.code).toBe(2);
      expect(report.stdout).toBe("");
      expect(report.stderr).toContain("Usage: throttle");
    },
  );

  test(
    "the child's streams pass through byte for byte, plus only throttle's own stderr lines",
    { timeout: 30_000 },
    async () => {
      const tmpRoot = isolatedTmp();
      const script = String.raw`process.stdout.write('alpha\nbeta\n'); process.stderr.write('gamma\ndelta\n');`;

      const direct = await collect({ executable: process.execPath, args: ["-e", script], tmpRoot });
      const wrapped = await collect({
        executable: process.execPath,
        args: [CLI_PATH, "--", process.execPath, "-e", script],
        tmpRoot,
      });

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
      const tmpRoot = isolatedTmp();
      const slotDir = slotDirUnder(tmpRoot);
      const release = await acquireSlotIn(slotDir);
      onTestFinished(async () => {
        await release();
      });
      const waitersDir = join(slotDir, "waiters");
      const child = spawn(process.execPath, [CLI_PATH, "--", process.execPath, "-e", ""], {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, TMPDIR: tmpRoot, MST_THROTTLE_LIMIT: "" },
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
