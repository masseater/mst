import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { commandIdOf, defaultSpoolRoot, timestampOf } from "./log-destination.ts";

const makeTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "log-destination-"));
  onTestFinished(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
};

describe("log-destination", () => {
  test("package.json を持つ祖先が見つかればその隣の .spool が退避先になる", () => {
    const marked = makeTempDir();
    writeFileSync(join(marked, "package.json"), "{}");
    const nested = join(marked, "a", "b");
    mkdirSync(nested, { recursive: true });
    expect(defaultSpoolRoot(nested)).toBe(join(marked, ".spool"));
  });

  test("package.json が見つからなければ起点の .spool が退避先になる", () => {
    const bare = makeTempDir();
    expect(defaultSpoolRoot(bare)).toBe(join(bare, ".spool"));
  });

  test("起点を渡さない探索は作業ディレクトリから始まる", () => {
    expect(defaultSpoolRoot()).toBe(join(process.cwd(), ".spool"));
  });

  test("時刻は辞書順が時刻順になる UTC 基本形式で秒精度に落ちる", () => {
    expect(timestampOf(new Date("2026-08-12T03:04:05.678Z"))).toBe("20260812T030405Z");
  });

  test("コマンド識別子は実行ファイルのベース名と先頭引数を名前に使える形へ正規化する", () => {
    expect(commandIdOf(["/usr/local/bin/node", "-e", "ignored third"])).toBe("node--e");
  });

  test("コマンド識別子は 40 文字で切られる", () => {
    expect(commandIdOf(["command", "x".repeat(80)])).toHaveLength(40);
  });
});
