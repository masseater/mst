import { spawnSync } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { PassThrough } from "node:stream";

import { describe, expect, onTestFinished, test, vi } from "vite-plus/test";

import { runSpool, type SpoolDeps } from "./run-spool.ts";

class CapturedStream extends PassThrough {
  private captured = "";

  constructor() {
    super();
    this.on("data", (part: Buffer) => {
      this.captured += String(part);
    });
  }

  get text(): string {
    return this.captured;
  }
}

type CapturedIo = { stdout: CapturedStream; stderr: CapturedStream };

const makeTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "spool-test-"));
  onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
};

const captureIo = (): CapturedIo => ({
  stdout: new CapturedStream(),
  stderr: new CapturedStream(),
});

const escapeDeps = (root: string): SpoolDeps & CapturedIo => ({
  ...captureIo(),
  isPassthrough: () => false,
  spoolRoot: () => root,
});

type Seams = Omit<Partial<SpoolDeps>, "stdout" | "stderr">;

const runRecorded = async (argv: string[], seams: Seams = {}) => {
  const root = makeTempDir();
  const deps = { ...escapeDeps(root), ...seams };
  const exitCode = await runSpool(argv, deps);
  return { root, exitCode, stdout: deps.stdout.text, stderr: deps.stderr.text };
};

const logPathFrom = (stdout: string): string => {
  const matched = /spool: log: (.+) \(\d+ bytes, \d+ lines\)/.exec(stdout);
  if (matched === null) {
    throw new Error(`no log line in: ${stdout}`);
  }
  return matched[1] as string;
};

const stubCi = (ciSignal: string | undefined): void => {
  vi.stubEnv("CI", ciSignal);
  onTestFinished(() => {
    vi.unstubAllEnvs();
  });
};

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

const waitFor = async (isReady: () => boolean): Promise<void> => {
  if (isReady()) {
    return;
  }
  await sleep(20);
  return waitFor(isReady);
};

const recordIn = (root: string): string => {
  const listedEntries = readdirSync(root);
  return listedEntries[0] === undefined ? "" : readFileSync(join(root, listedEntries[0]), "utf8");
};

const clockOf = (ticks: number[]): (() => number) => {
  const remaining = ticks.values();
  return () => remaining.next().value as number;
};

const node = process.execPath;

describe("使い方の誤り", () => {
  test("コマンド未指定・区切り無し・区切り前の引数はいずれも使い方を stderr へ出して 2 で終わる", async () => {
    for (const argv of [[], ["--"], ["-x", "--", "echo", "hi"], ["echo", "hi"]]) {
      const io = captureIo();
      expect(await runSpool(argv, io)).toBe(2);
      expect(io.stderr.text).toContain("usage: spool -- <command> [args...]");
      expect(io.stdout.text).toBe("");
    }
  });
});

describe("退避の記録", () => {
  test("全量が欠落も重複も並べ替えも無く記録され要約は固定の 3 行になる", async () => {
    const script = 'for (let i = 0; i < 5000; i += 1) console.log("line " + i);';
    const commandLine = [node, "-e", script].join(" ");
    const recordedRun = await runRecorded(["--", node, "-e", script]);
    expect(recordedRun.exitCode).toBe(0);
    expect(recordedRun.stderr).toBe("");
    const summaryLines = recordedRun.stdout.split("\n");
    expect(summaryLines).toHaveLength(4);
    expect(summaryLines[3]).toBe("");
    expect(summaryLines[0]).toBe(`spool: command: ${commandLine}`);
    const filePath = logPathFrom(recordedRun.stdout);
    const wanted = Array.from({ length: 5000 }, (_, lineIndex) => `line ${lineIndex}\n`).join("");
    expect(readFileSync(filePath, "utf8")).toBe(`${commandLine}\n\n${wanted}`);
    expect(summaryLines[1]).toBe(`spool: log: ${filePath} (${wanted.length} bytes, 5000 lines)`);
  });

  test(
    "出力量を桁で変えても要約の行数は変わらずファイルには全量が残る",
    { timeout: 30_000 },
    async () => {
      const summariesFor = async (lineCount: number) => {
        const script = `const line = "x".repeat(99) + "\\n"; for (let i = 0; i < ${lineCount}; i += 1) process.stdout.write(line);`;
        const recordedRun = await runRecorded(["--", node, "-e", script]);
        expect(recordedRun.exitCode).toBe(0);
        const commandLine = [node, "-e", script].join(" ");
        return { stdout: recordedRun.stdout, fileSize: commandLine.length + 2 + lineCount * 100 };
      };
      const small = await summariesFor(10_000);
      const large = await summariesFor(100_000);
      expect(small.stdout.split("\n")).toHaveLength(4);
      expect(large.stdout.split("\n")).toHaveLength(4);
      expect(statSync(logPathFrom(small.stdout)).size).toBe(small.fileSize);
      expect(statSync(logPathFrom(large.stdout)).size).toBe(large.fileSize);
      expect(large.stdout).toContain(`(${String(100_000 * 100)} bytes, 100000 lines)`);
    },
  );

  test("出力が無い子は 0 bytes 0 lines の要約になる", async () => {
    const recordedRun = await runRecorded(["--", node, "-e", ""]);
    expect(recordedRun.exitCode).toBe(0);
    expect(recordedRun.stdout).toContain("(0 bytes, 0 lines)");
  });

  test("エスケープ列は記録から除去され可視文字は残る", async () => {
    const script = 'process.stdout.write("\\u001b[31mred\\u001b[0m plain\\n");';
    const recordedRun = await runRecorded(["--", node, "-e", script]);
    const writtenBody = readFileSync(logPathFrom(recordedRun.stdout), "utf8");
    expect(writtenBody).toContain("red plain\n");
    expect(writtenBody).not.toContain("");
  });

  test(
    "標準出力と標準エラーは書かれた順で 1 つのファイルに合流する",
    { timeout: 15_000 },
    async () => {
      const script = [
        "const delay = (ms) => new Promise((r) => setTimeout(r, ms));",
        '(async () => { console.log("out one"); await delay(200); console.error("err two"); await delay(200); console.log("out three"); })();',
      ].join(" ");
      const recordedRun = await runRecorded(["--", node, "-e", script]);
      expect(recordedRun.exitCode).toBe(0);
      const writtenBody = readFileSync(logPathFrom(recordedRun.stdout), "utf8");
      expect(writtenBody.endsWith("out one\nerr two\nout three\n")).toBe(true);
    },
  );

  test("実行中のファイルを外から読むと途中までの内容が見える", { timeout: 15_000 }, async () => {
    const root = makeTempDir();
    const deps = escapeDeps(root);
    const script =
      'console.log("first-" + "mark"); setTimeout(() => { console.log("second-" + "mark"); }, 700);';
    const running = runSpool(["--", node, "-e", script], deps);
    await waitFor(() => recordIn(root).includes("first-mark"));
    const observed = recordIn(root);
    expect(await Promise.race([running, Promise.resolve("pending")])).toBe("pending");
    expect(observed).toContain("first-mark");
    expect(observed).not.toContain("second-mark");
    expect(await running).toBe(0);
    expect(readFileSync(logPathFrom(deps.stdout.text), "utf8")).toContain("second-mark");
  });
});

describe("終了コードと結末", () => {
  test("子の 0 でない終了コードはそのまま返り要約は標準出力に出る", async () => {
    const recordedRun = await runRecorded(["--", node, "-e", "process.exit(7)"]);
    expect(recordedRun.exitCode).toBe(7);
    expect(recordedRun.stdout).toContain("spool: exit: 7 (");
    expect(recordedRun.stderr).toBe("");
  });

  test("0 でない終了時は記録の末尾 20 行が要約に続く", async () => {
    const script = 'for (let i = 1; i <= 30; i += 1) console.log("row " + i); process.exit(3);';
    const recordedRun = await runRecorded(["--", node, "-e", script]);
    expect(recordedRun.exitCode).toBe(3);
    const wanted = Array.from({ length: 20 }, (_, rowIndex) => `row ${rowIndex + 11}\n`).join("");
    expect(recordedRun.stdout.endsWith(`\n${wanted}`)).toBe(true);
    expect(recordedRun.stdout).not.toContain("row 10\n");
  });

  test("改行で終わらない出力も抜粋と行数に数えられる", async () => {
    const recordedRun = await runRecorded([
      "--",
      node,
      "-e",
      'process.stdout.write("partial oops"); process.exit(9);',
    ]);
    expect(recordedRun.exitCode).toBe(9);
    expect(recordedRun.stdout).toContain("(12 bytes, 1 lines)");
    expect(recordedRun.stdout.endsWith("partial oops\n")).toBe(true);
  });

  test("シグナルで死んだ子は 128+signum で返り記録はそこまで残る", async () => {
    const script =
      'process.stdout.write("before signal\\n", () => process.kill(process.pid, "SIGKILL"));';
    const recordedRun = await runRecorded(["--", node, "-e", script]);
    expect(recordedRun.exitCode).toBe(137);
    expect(recordedRun.stdout).toContain("spool: exit: 137 (");
    expect(readFileSync(logPathFrom(recordedRun.stdout), "utf8")).toContain("before signal\n");
  });

  test("起動できないコマンドは 127 で返り stderr に理由が出てファイルは残らない", async () => {
    const recordedRun = await runRecorded(["--", "/nonexistent/never-here"]);
    expect(recordedRun.exitCode).toBe(127);
    expect(recordedRun.stdout).toBe("");
    expect(recordedRun.stderr).toContain("spool: error: cannot start command:");
    expect(readdirSync(recordedRun.root)).toHaveLength(0);
  });
});

describe("記録の失敗", () => {
  test("退避先を用意できないと子は走らず 1 で返り stderr にパスが出る", async () => {
    const dir = makeTempDir();
    const blocked = join(dir, "blocked");
    writeFileSync(blocked, "occupied");
    const sentinel = join(dir, "sentinel");
    const script = 'require("node:fs").writeFileSync(process.argv[1], "ran");';
    const deps = { ...captureIo(), isPassthrough: () => false, spoolRoot: () => blocked };
    expect(await runSpool(["--", node, "-e", script, sentinel], deps)).toBe(1);
    expect(deps.stdout.text).toBe("");
    expect(deps.stderr.text).toContain(`spool: error: cannot record to ${blocked}/`);
    expect(existsSync(sentinel)).toBe(false);
  });

  test(
    "途中で記録が失敗すると子が成功しても 1 で返り子には介入しない",
    { timeout: 15_000 },
    async () => {
      const root = makeTempDir();
      const aux = makeTempDir();
      const gate = join(aux, "gate");
      const marker = join(aux, "marker");
      const fifoPath = join(root, "20260811T120000Z-node--e-feed0123.log");
      expect(spawnSync("mkfifo", [fifoPath]).status).toBe(0);
      const script = [
        'const fs = require("node:fs");',
        'process.stdout.write("phase one\\n");',
        "const gate = process.argv[1];",
        "const marker = process.argv[2];",
        "const poll = () => {",
        "  if (!fs.existsSync(gate)) { setTimeout(poll, 20); return; }",
        '  process.stdout.write("y".repeat(2097152), () => { fs.writeFileSync(marker, "done"); process.exit(0); });',
        "};",
        "poll();",
      ].join(" ");
      const deps = {
        ...escapeDeps(root),
        now: () => new Date("2026-08-11T12:00:00Z"),
        uniqueSuffix: () => "feed0123",
      };
      const running = runSpool(["--", node, "-e", script, gate, marker], deps);
      const reader = createReadStream(fifoPath);
      const observedRecord = new CapturedStream();
      reader.pipe(observedRecord);
      await waitFor(() => observedRecord.text.includes("phase one"));
      reader.destroy();
      writeFileSync(gate, "open");
      expect(await running).toBe(1);
      expect(deps.stdout.text).toBe("");
      expect(deps.stderr.text).toContain(`spool: error: cannot record to ${fifoPath}`);
      expect(existsSync(marker)).toBe(true);
    },
  );
});

describe("素通し", () => {
  test("素通しでは退避ファイルを作らず終了コードを透過し要約は 1 行短い", async () => {
    const dir = makeTempDir();
    const never = join(dir, "never");
    const deps = { ...captureIo(), isPassthrough: () => true, spoolRoot: () => never };
    expect(await runSpool(["--", node, "-e", "process.exit(5)"], deps)).toBe(5);
    expect(existsSync(never)).toBe(false);
    const lines = deps.stdout.text.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("spool: command: ");
    expect(lines[1]).toContain("spool: exit: 5 (");
    expect(deps.stdout.text).not.toContain("spool: log:");
  });

  test("素通しでも起動できないコマンドは 127 で stderr に理由が出る", async () => {
    const deps = { ...captureIo(), isPassthrough: () => true };
    expect(await runSpool(["--", "/nonexistent/never-here"], deps)).toBe(127);
    expect(deps.stderr.text).toContain("spool: error: cannot start command:");
  });

  test("環境変数 CI が空でなく false 以外なら素通しになる", async () => {
    stubCi("1");
    const dir = makeTempDir();
    const root = join(dir, "root");
    const deps = { ...captureIo(), spoolRoot: () => root };
    expect(await runSpool(["--", node, "-e", ""], deps)).toBe(0);
    expect(existsSync(root)).toBe(false);
    expect(deps.stdout.text).not.toContain("spool: log:");
  });

  test("環境変数 CI が false と空文字列の場合は退避する", async () => {
    for (const ciSignal of ["false", ""]) {
      stubCi(ciSignal);
      const root = makeTempDir();
      const deps = { ...captureIo(), spoolRoot: () => root };
      expect(await runSpool(["--", node, "-e", ""], deps)).toBe(0);
      expect(readdirSync(root)).toHaveLength(1);
    }
  });
});

describe("並行実行", () => {
  test(
    "同時に走る実行はそれぞれ別のファイルに完結して混ざらない",
    { timeout: 15_000 },
    async () => {
      const root = makeTempDir();
      const runs = await Promise.all(
        Array.from({ length: 5 }, async () => {
          const deps = { ...escapeDeps(root), now: () => new Date("2026-08-11T12:00:00Z") };
          const exitCode = await runSpool(["--", node, "-e", "console.log(process.pid)"], deps);
          return { exitCode, stdout: deps.stdout.text };
        }),
      );
      expect(readdirSync(root)).toHaveLength(5);
      for (const recordedRun of runs) {
        expect(recordedRun.exitCode).toBe(0);
        expect(
          String(readFileSync(logPathFrom(recordedRun.stdout), "utf8").split("\n\n")[1]),
        ).toMatch(/^\d+\n$/);
      }
      const pids = new Set(
        runs.map(
          (recordedRun) => readFileSync(logPathFrom(recordedRun.stdout), "utf8").split("\n\n")[1],
        ),
      );
      expect(pids.size).toBe(5);
    },
  );
});

describe("縫い目と既定値", () => {
  test("ファイル名は時刻とコマンド識別子と一意化成分から決まり識別子は 40 文字で切られる", async () => {
    const seams = {
      now: () => new Date("2026-08-11T12:00:00.789Z"),
      uniqueSuffix: () => "cafe0123",
    };
    const shortRun = await runRecorded(["--", node, "-e", "console.log(1)"], seams);
    expect(readdirSync(shortRun.root)).toStrictEqual(["20260811T120000Z-node--e-cafe0123.log"]);
    const longRun = await runRecorded(["--", node, `${"x".repeat(60)}.js`], seams);
    expect(readdirSync(longRun.root)).toStrictEqual([
      `20260811T120000Z-node-${"x".repeat(35)}-cafe0123.log`,
    ]);
  });

  test("経過時間は 60 秒未満なら小数 1 桁の秒で切り捨てられる", async () => {
    const recordedRun = await runRecorded(["--", node, "-e", 'console.log("h")'], {
      monotonicNow: clockOf([0, 12_399]),
    });
    const filePath = logPathFrom(recordedRun.stdout);
    const commandLine = [node, "-e", 'console.log("h")'].join(" ");
    expect(recordedRun.stdout).toBe(
      `spool: command: ${commandLine}\nspool: log: ${filePath} (2 bytes, 1 lines)\nspool: exit: 0 (12.3s)\n`,
    );
  });

  test("経過時間は 60 秒を境に秒表示と分秒表示が切り替わりどちらも切り捨てられる", async () => {
    const displays: [number, string][] = [
      [59_999, "(59.9s)"],
      [60_000, "(1m00s)"],
      [245_000, "(4m05s)"],
    ];
    for (const [elapsedMs, display] of displays) {
      const deps = {
        ...captureIo(),
        isPassthrough: () => true,
        monotonicNow: clockOf([0, elapsedMs]),
      };
      await runSpool(["--", node, "-e", ""], deps);
      expect(deps.stdout.text).toContain(display);
    }
  });

  test("縫い目を渡さない実行は既定値で動き作業ツリーの .spool に記録する", async () => {
    stubCi(undefined);
    const io = captureIo();
    expect(await runSpool(["--", node, "-e", 'console.log("default run")'], io)).toBe(0);
    const filePath = logPathFrom(io.stdout.text);
    onTestFinished(() => {
      rmSync(filePath, { force: true });
    });
    expect(filePath.startsWith(join(process.cwd(), ".spool"))).toBe(true);
    expect(basename(filePath)).toMatch(/^\d{8}T\d{6}Z-node--e-[0-9a-f]{8}\.log$/);
    expect(readFileSync(filePath, "utf8")).toContain("default run\n");
  });
});
