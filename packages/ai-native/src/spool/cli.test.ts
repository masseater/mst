import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

vi.mock(import("./run-spool.ts"), () => ({
  runSpool: () => Promise.resolve(7),
  defaultSpoolRoot: () => "",
}));

const cliPath = fileURLToPath(new URL("./cli.ts", import.meta.url));

const makeWorkTree = (): string => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "spool-cli-test-")));
  writeFileSync(join(dir, "package.json"), "{}");
  onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
};

const cleanEnv = (overrides: Record<string, string> = {}): Record<string, string> => ({
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      (listed): listed is [string, string] => listed[0] !== "CI" && listed[1] !== undefined,
    ),
  ),
  ...overrides,
});

const runCli = (
  commandLine: string[],
  { cwd, env }: { cwd: string; env: Record<string, string> },
) =>
  spawnSync(process.execPath, [cliPath, ...commandLine], {
    cwd,
    env,
    encoding: "utf8" as const,
    maxBuffer: 64 * 1024 * 1024,
  });

const spoolFilesIn = (dir: string): string[] =>
  readdirSync(join(dir, ".spool")).map((spelled) => join(dir, ".spool", spelled));

class RssSampler {
  private maxKiloBytes = 0;

  observe(pid: number): void {
    const sampled = spawnSync("ps", ["-o", "rss=", "-p", String(pid)], { encoding: "utf8" });
    const kiloBytes = Number.parseInt(sampled.stdout.trim(), 10);
    this.maxKiloBytes = Number.isNaN(kiloBytes)
      ? this.maxKiloBytes
      : Math.max(this.maxKiloBytes, kiloBytes);
  }

  get maxBytes(): number {
    return this.maxKiloBytes * 1024;
  }
}

describe("spool cli", () => {
  test("エントリは runSpool の結果を終了コードに反映する", async () => {
    const originalExitCode = process.exitCode;
    onTestFinished(() => {
      process.exitCode = originalExitCode;
    });
    await import("./cli.ts");
    expect(process.exitCode).toBe(7);
  });

  test("大量出力を包むと標準出力は固定行数で全量は記録に残る", { timeout: 30_000 }, () => {
    const dir = makeWorkTree();
    const script =
      'const line = "x".repeat(99) + "\\n"; for (let i = 0; i < 50000; i += 1) process.stdout.write(line);';
    const execution = runCli(["--", process.execPath, "-e", script], { cwd: dir, env: cleanEnv() });
    expect(execution.status).toBe(0);
    const lines = execution.stdout.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain(`spool: log: ${join(dir, ".spool")}`);
    expect(lines[1]).toContain("(5000000 bytes, 50000 lines)");
    const files = spoolFilesIn(dir);
    expect(files).toHaveLength(1);
    const commandLine = [process.execPath, "-e", script].join(" ");
    expect(statSync(files[0] as string).size).toBe(commandLine.length + 2 + 5_000_000);
  });

  test(
    "CI では出力が素通しになり退避ファイルが作られず終了コードは透過する",
    { timeout: 15_000 },
    () => {
      const dir = makeWorkTree();
      const script = 'console.log("raw through"); process.exit(4);';
      const execution = runCli(["--", process.execPath, "-e", script], {
        cwd: dir,
        env: cleanEnv({ CI: "true" }),
      });
      expect(execution.status).toBe(4);
      expect(execution.stdout).toContain("raw through\n");
      expect(execution.stdout).toContain("spool: exit: 4 (");
      expect(execution.stdout).not.toContain("spool: log:");
      expect(existsSync(join(dir, ".spool"))).toBe(false);
    },
  );

  test("コマンド未指定は使い方を stderr へ出して 2 で終わる", { timeout: 15_000 }, () => {
    const dir = makeWorkTree();
    const execution = runCli([], { cwd: dir, env: cleanEnv() });
    expect(execution.status).toBe(2);
    expect(execution.stderr).toContain("usage: spool -- <command> [args...]");
    expect(execution.stdout).toBe("");
  });

  test("二重に包んでも外側へ届く量は内側の要約ぶんしか増えない", { timeout: 30_000 }, () => {
    const dir = makeWorkTree();
    const script =
      'const line = "y".repeat(99) + "\\n"; for (let i = 0; i < 20000; i += 1) process.stdout.write(line);';
    const execution = runCli(
      ["--", process.execPath, cliPath, "--", process.execPath, "-e", script],
      {
        cwd: dir,
        env: cleanEnv(),
      },
    );
    expect(execution.status).toBe(0);
    expect(execution.stdout.split("\n")).toHaveLength(4);
    const files = spoolFilesIn(dir);
    expect(files).toHaveLength(2);
    const writtenBodies = files.map((file) => readFileSync(file, "utf8"));
    const outer = writtenBodies.find((writtenBody) => writtenBody.includes("spool: log: "));
    const inner = writtenBodies.find((writtenBody) => !writtenBody.includes("spool: log: "));
    expect(outer).toBeDefined();
    expect(inner).toBeDefined();
    expect((outer as string).split("\n").length).toBeLessThan(10);
    expect((inner as string).endsWith(`${"y".repeat(99)}\n`)).toBe(true);
    expect((inner as string).length).toBeGreaterThan(20_000 * 100);
  });

  test(
    "記録が書き込みより速い出力でもメモリは出力量に比例しない",
    { timeout: 60_000 },
    async () => {
      const dir = makeWorkTree();
      const script =
        'const chunk = "m".repeat(65536); for (let i = 0; i < 4096; i += 1) process.stdout.write(chunk);';
      const child = spawn(process.execPath, [cliPath, "--", process.execPath, "-e", script], {
        cwd: dir,
        env: cleanEnv(),
        stdio: ["ignore", "pipe", "pipe"],
      });
      const sampler = new RssSampler();
      const timer = setInterval(() => {
        sampler.observe(child.pid as number);
      }, 50);
      const exitCode = await new Promise<number | null>((resolvePromise) => {
        child.once("close", (code) => {
          resolvePromise(code);
        });
      });
      clearInterval(timer);
      expect(exitCode).toBe(0);
      const outputBytes = 4096 * 65536;
      const files = spoolFilesIn(dir);
      expect(files).toHaveLength(1);
      expect(statSync(files[0] as string).size).toBeGreaterThan(outputBytes);
      expect(sampler.maxBytes).toBeGreaterThan(0);
      expect(sampler.maxBytes).toBeLessThan(192 * 1024 * 1024);
    },
  );
});
