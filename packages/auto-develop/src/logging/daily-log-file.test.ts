import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { createDailyLogFileSink } from "./daily-log-file.ts";

const it = test
  .extend("writtenLines", () => {
    const directory = join(mkdtempSync(join(tmpdir(), "auto-develop-log-")), "nested");
    const sink = createDailyLogFileSink({
      directory,
      name: "relay",
      nowIso: () => "2026-08-11T00:00:00.000Z",
      onFailure: () => undefined,
    });
    sink.append("first\n");
    sink.append("second\n");
    return readFileSync(join(directory, "relay-2026-08-11.log"), "utf8");
  })
  .extend("rotatedFiles", () => {
    const directory = mkdtempSync(join(tmpdir(), "auto-develop-log-"));
    const day = new Map([["value", "2026-08-11T23:59:59.000Z"]]);
    const sink = createDailyLogFileSink({
      directory,
      name: "relay",
      nowIso: () => day.get("value") as string,
      onFailure: () => undefined,
    });
    sink.append("before midnight\n");
    day.set("value", "2026-08-12T00:00:01.000Z");
    sink.append("after midnight\n");
    return [
      readFileSync(join(directory, "relay-2026-08-11.log"), "utf8"),
      readFileSync(join(directory, "relay-2026-08-12.log"), "utf8"),
    ];
  })
  .extend("failureReports", () => {
    const onFailure = vi.fn<(failure: unknown) => void>();
    const sink = createDailyLogFileSink({
      directory: join("\0invalid", "path"),
      name: "relay",
      nowIso: () => "2026-08-11T00:00:00.000Z",
      onFailure,
    });
    sink.append("line\n");
    return onFailure.mock.calls.length;
  });

describe("createDailyLogFileSink", () => {
  it("ロガー名と日付で決めたファイルへ同じ日の行を追記する", ({ writtenLines }) => {
    expect(writtenLines).toStrictEqual("first\nsecond\n");
  });

  it("日付をまたぐと新しいファイルへ書き分ける", ({ rotatedFiles }) => {
    expect(rotatedFiles).toStrictEqual(["before midnight\n", "after midnight\n"]);
  });

  it("書き込みに失敗しても例外にせず通知だけする", ({ failureReports }) => {
    expect(failureReports).toStrictEqual(1);
  });
});
