import { standardIoTest } from "@mst/dont-review-it/vitest";
import { describe, expect, test, vi } from "vite-plus/test";

import { asRecord } from "../contract/unknown-record.ts";
import { createConsoleLogger } from "./console-logger.ts";

const recordingOut = (): {
  readonly out: NodeJS.WritableStream;
  readonly lines: () => readonly string[];
} => {
  const chunks = new Map<number, string>();
  const write = (chunk: string): boolean => {
    chunks.set(chunks.size, chunk);
    return true;
  };
  return { out: { write } as NodeJS.WritableStream, lines: () => [...chunks.values()] };
};

const parsedLine = (line: string): Readonly<Record<string, unknown>> =>
  JSON.parse(line) as Readonly<Record<string, unknown>>;

const it = test
  .extend("infoLine", () => {
    const recording = recordingOut();
    createConsoleLogger("relay", { out: recording.out }).info({ port: 8080 }, "listening");
    return parsedLine(recording.lines()[0] ?? "{}");
  })
  .extend("warnLevel", () => {
    const recording = recordingOut();
    createConsoleLogger("relay", { out: recording.out }).warn({}, "careful");
    return parsedLine(recording.lines()[0] ?? "{}").level;
  })
  .extend("errorLevel", () => {
    const recording = recordingOut();
    createConsoleLogger("relay", { out: recording.out }).error({}, "broken");
    return parsedLine(recording.lines()[0] ?? "{}").level;
  })
  .extend("failureField", () => {
    const recording = recordingOut();
    const failure = new Error("the relay is unreachable", { cause: new Error("ECONNREFUSED") });
    createConsoleLogger("relay", { out: recording.out }).error({ err: failure }, "cycle failed");
    const logged = asRecord(parsedLine(recording.lines()[0] ?? "{}").err);
    return {
      name: logged?.name,
      message: logged?.message,
      carriesStack: typeof logged?.stack === "string",
      causeMessage: asRecord(logged?.cause)?.message,
    };
  })
  .extend("mirroredLines", () => {
    const recording = recordingOut();
    const append = vi.fn<(line: string) => void>();
    createConsoleLogger("relay", { out: recording.out, fileSink: { append } }).info(
      {},
      "listening",
    );
    return { stdout: recording.lines(), file: append.mock.calls.map(([line]) => line) };
  });

standardIoTest("出力先を渡さなければ標準出力へ書く", ({ stdout }) => {
  vi.setSystemTime(new Date("2026-08-11T00:00:00.000Z"));
  createConsoleLogger("relay").info({}, "listening");
  vi.useRealTimers();

  expect(stdout.text).toMatchInlineSnapshot(`
    "{"level":"info","name":"relay","time":"2026-08-11T00:00:00.000Z","msg":"listening"}
    "
  `);
});

standardIoTest("標準エラーへは書かない", ({ stderr }) => {
  createConsoleLogger("relay").info({}, "listening");

  expect(stderr.text).toMatchInlineSnapshot(`""`);
});

describe("createConsoleLogger", () => {
  it("1 行 JSON にロガー名を載せる", ({ infoLine }) => {
    expect(infoLine.name).toStrictEqual("relay");
  });

  it("付帯フィールドをそのまま並べる", ({ infoLine }) => {
    expect(infoLine.port).toStrictEqual(8080);
  });

  it("メッセージを msg キーに置く", ({ infoLine }) => {
    expect(infoLine.msg).toStrictEqual("listening");
  });

  it("警告は warn の水準になる", ({ warnLevel }) => {
    expect(warnLevel).toStrictEqual("warn");
  });

  it("エラーは error の水準になる", ({ errorLevel }) => {
    expect(errorLevel).toStrictEqual("error");
  });

  it("Error は名前とメッセージと原因が読める形に開いて載せる", ({ failureField }) => {
    expect(failureField).toStrictEqual({
      name: "Error",
      message: "the relay is unreachable",
      carriesStack: true,
      causeMessage: "ECONNREFUSED",
    });
  });

  it("ファイル出力先があれば同じ行を書き分ける", ({ mirroredLines }) => {
    expect(mirroredLines.file).toStrictEqual(mirroredLines.stdout);
  });
});
