import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { runThrottle, type ThrottleSeams } from "./run-throttle.ts";

const temporaryDirectory = (prefix: string): string => {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  onTestFinished(() => {
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
};

const captureStderr = (): (() => string) => {
  const spy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  onTestFinished(() => {
    spy.mockRestore();
  });
  return () => spy.mock.calls.map(([chunk]) => String(chunk)).join("");
};

const stubLimit = (limitEnv: string | undefined): void => {
  vi.stubEnv("MST_THROTTLE_LIMIT", limitEnv);
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
};

const trivialCommand = ["--", process.execPath, "-e", ""];

const recorderArgs = (recording: {
  startFile: string;
  endFile: string;
  holdMs: number;
}): string[] => [
  process.execPath,
  "-e",
  `const { writeFileSync } = require("node:fs"); writeFileSync(${JSON.stringify(recording.startFile)}, String(Date.now())); setTimeout(() => { writeFileSync(${JSON.stringify(recording.endFile)}, String(Date.now())); }, ${recording.holdMs});`,
];

const readStamp = (file: string): number => Number(readFileSync(file, "utf8"));

const recordedRun = (
  stamps: string,
  name: string,
): { argsFor: (holdMs: number) => string[]; interval: () => { start: number; end: number } } => ({
  argsFor: (holdMs: number) =>
    recorderArgs({
      startFile: join(stamps, `${name}-start`),
      endFile: join(stamps, `${name}-end`),
      holdMs,
    }),
  interval: () => ({
    start: readStamp(join(stamps, `${name}-start`)),
    end: readStamp(join(stamps, `${name}-end`)),
  }),
});

const quickSeams = (slotDir: string): ThrottleSeams => ({
  slotDir,
  limit: 1,
  staleMs: 5000,
  waitBudgetMs: 15_000,
  pollMs: 50,
  isInteractive: false,
});

describe("run-throttle", () => {
  test(
    "runs with every default and announces the acquisition and the command line",
    { timeout: 30_000 },
    async () => {
      stubLimit(undefined);
      const stderrText = captureStderr();

      expect(await runThrottle(trivialCommand)).toBe(0);

      expect(stderrText()).toContain("throttle: acquiring a slot (limit 1)");
      expect(stderrText()).toContain(`throttle: run ${process.execPath} -e `);
    },
  );

  test("no command at all is refused with the usage on stderr", async () => {
    const stderrText = captureStderr();

    expect(await runThrottle([])).toBe(2);
    expect(await runThrottle(["--"])).toBe(2);

    expect(stderrText()).toContain("Usage: throttle");
  });

  test("a non-integer timeout is refused naming the value, before any slot exists", async () => {
    const root = temporaryDirectory("throttle-misuse-");
    const slotDir = join(root, "slots");
    const stderrText = captureStderr();

    expect(await runThrottle(["--timeout", "1.5", ...trivialCommand], quickSeams(slotDir))).toBe(2);
    expect(await runThrottle(["--timeout=-9", ...trivialCommand], quickSeams(slotDir))).toBe(2);

    expect(stderrText()).toContain('got "1.5"');
    expect(stderrText()).toContain('got "-9"');
    expect(existsSync(slotDir)).toBe(false);
  });

  test("an unknown option is refused with the usage", async () => {
    const stderrText = captureStderr();

    expect(await runThrottle(["--limit", "3", ...trivialCommand])).toBe(2);

    expect(stderrText()).toContain("Usage: throttle");
  });

  test("two commands under limit 1 never run at the same time", { timeout: 20_000 }, async () => {
    const slotDir = temporaryDirectory("throttle-limit-");
    const stamps = temporaryDirectory("throttle-stamps-");
    const stderrText = captureStderr();
    const seams = quickSeams(slotDir);
    const runA = recordedRun(stamps, "a");
    const runB = recordedRun(stamps, "b");

    const codes = await Promise.all([
      runThrottle(["--", ...runA.argsFor(400)], seams),
      runThrottle(["--", ...runB.argsFor(400)], seams),
    ]);

    expect(codes).toStrictEqual([0, 0]);
    const a = runA.interval();
    const b = runB.interval();
    const [earlier, later] = a.start <= b.start ? [a, b] : [b, a];
    expect(later.start).toBeGreaterThanOrEqual(earlier.end);
    expect(stderrText()).toContain("throttle: waiting 1/1");
  });

  test(
    "a free slot is taken without any waiting output, well below one poll interval",
    { timeout: 10_000 },
    async () => {
      const slotDir = temporaryDirectory("throttle-free-");
      const stderrText = captureStderr();
      const before = Date.now();

      expect(await runThrottle(trivialCommand, { ...quickSeams(slotDir), pollMs: 10_000 })).toBe(0);

      expect(Date.now() - before).toBeLessThan(5000);
      expect(stderrText()).not.toContain("waiting");
    },
  );

  test("different namespaces never contend", { timeout: 10_000 }, async () => {
    const slotDirA = temporaryDirectory("throttle-ns-a-");
    const slotDirB = temporaryDirectory("throttle-ns-b-");
    const stamps = temporaryDirectory("throttle-ns-stamps-");
    const stderrText = captureStderr();
    const runA = recordedRun(stamps, "a");
    const runB = recordedRun(stamps, "b");

    const codes = await Promise.all([
      runThrottle(["--", ...runA.argsFor(400)], quickSeams(slotDirA)),
      runThrottle(["--", ...runB.argsFor(400)], quickSeams(slotDirB)),
    ]);

    expect(codes).toStrictEqual([0, 0]);
    const a = runA.interval();
    const b = runB.interval();
    expect(a.start).toBeLessThan(b.end);
    expect(b.start).toBeLessThan(a.end);
    expect(stderrText()).not.toContain("waiting");
  });

  test(
    "the environment sets the limit, and two slots really run two at a time",
    { timeout: 20_000 },
    async () => {
      stubLimit("2");
      const slotDir = temporaryDirectory("throttle-env-");
      const stamps = temporaryDirectory("throttle-env-stamps-");
      captureStderr();
      const seams = {
        slotDir,
        staleMs: 5000,
        waitBudgetMs: 15_000,
        pollMs: 50,
        isInteractive: false,
      };
      const recorders = ["a", "b", "c"].map((name) => recordedRun(stamps, name));

      const codes = await Promise.all(
        recorders.map((recorder) => runThrottle(["--", ...recorder.argsFor(300)], seams)),
      );

      expect(codes).toStrictEqual([0, 0, 0]);
      const boundaries = recorders
        .flatMap((recorder): [number, number][] => [
          [recorder.interval().start, 1],
          [recorder.interval().end, -1],
        ])
        .toSorted((left, right) => left[0] - right[0] || left[1] - right[1]);
      const tally = boundaries.reduce(
        (state, [, delta]) => {
          const depth = state.depth + delta;
          return { depth, peak: Math.max(state.peak, depth) };
        },
        { depth: 0, peak: 0 },
      );
      expect(tally.peak).toBe(2);
      expect(existsSync(join(slotDir, "slot-1"))).toBe(true);
    },
  );

  test(
    "an invalid environment limit falls back to the default instead of failing",
    { timeout: 15_000 },
    async () => {
      captureStderr();
      for (const raw of ["abc", "0", "-3"]) {
        stubLimit(raw);
        const slotDir = temporaryDirectory("throttle-env-bad-");

        expect(
          await runThrottle(trivialCommand, {
            slotDir,
            staleMs: 5000,
            waitBudgetMs: 5000,
            pollMs: 1000,
            isInteractive: false,
          }),
        ).toBe(0);

        const markers = readdirSync(slotDir).filter((name) => /^slot-\d+$/.test(name));
        expect(markers).toStrictEqual(["slot-0"]);
      }
    },
  );

  test("an unusable slot area fails the run instead of being swallowed", async () => {
    const root = temporaryDirectory("throttle-broken-");
    const plainFile = join(root, "plain-file");
    writeFileSync(plainFile, "");
    const stderrText = captureStderr();

    expect(await runThrottle(trivialCommand, quickSeams(join(plainFile, "nested")))).toBe(1);

    expect(stderrText()).toContain("throttle: ");
    expect(stderrText()).not.toContain("Usage: throttle");
  });
});
