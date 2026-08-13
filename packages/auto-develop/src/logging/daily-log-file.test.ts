import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test, vi } from "vite-plus/test";

import { createDailyLogFileSink } from "./daily-log-file.ts";

describe("createDailyLogFileSink", () => {
  const it = test
    .extend("sameDayLogLines", () => {
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
    .extend("logLinesBeforeMidnight", () => {
      const directory = mkdtempSync(join(tmpdir(), "auto-develop-log-"));
      const clock = ["2026-08-11T23:59:59.000Z", "2026-08-12T00:00:01.000Z"].values();
      const sink = createDailyLogFileSink({
        directory,
        name: "relay",
        nowIso: () => clock.next().value ?? "",
        onFailure: () => undefined,
      });
      sink.append("before midnight\n");
      sink.append("after midnight\n");
      return readFileSync(join(directory, "relay-2026-08-11.log"), "utf8");
    })
    .extend("logLinesAfterMidnight", () => {
      const directory = mkdtempSync(join(tmpdir(), "auto-develop-log-"));
      const clock = ["2026-08-11T23:59:59.000Z", "2026-08-12T00:00:01.000Z"].values();
      const sink = createDailyLogFileSink({
        directory,
        name: "relay",
        nowIso: () => clock.next().value ?? "",
        onFailure: () => undefined,
      });
      sink.append("before midnight\n");
      sink.append("after midnight\n");
      return readFileSync(join(directory, "relay-2026-08-12.log"), "utf8");
    })
    .extend("appendFailureListener", () => {
      const appendFailureListener = vi.fn<(failure: unknown) => void>();
      const sink = createDailyLogFileSink({
        directory: join("\0invalid", "path"),
        name: "relay",
        nowIso: () => "2026-08-11T00:00:00.000Z",
        onFailure: appendFailureListener,
      });
      sink.append("line\n");
      return appendFailureListener;
    });

  it("ロガー名と日付で決めたファイルへ同じ日の行を追記する", ({ sameDayLogLines }) => {
    expect(sameDayLogLines).toStrictEqual("first\nsecond\n");
  });

  it("日付をまたぐ前の行は前日のファイルに残る", ({ logLinesBeforeMidnight }) => {
    expect(logLinesBeforeMidnight).toStrictEqual("before midnight\n");
  });

  it("日付をまたいだ後の行は新しい日のファイルへ書き分ける", ({ logLinesAfterMidnight }) => {
    expect(logLinesAfterMidnight).toStrictEqual("after midnight\n");
  });

  it("書き込みに失敗しても例外にせず通知だけする", ({ appendFailureListener }) => {
    expect(appendFailureListener).toHaveBeenCalledTimes(1);
  });
});
