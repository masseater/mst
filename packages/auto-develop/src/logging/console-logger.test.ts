import { standardIoTest } from "@mst/dont-review-it/vitest";
import { describe, expect, vi } from "vite-plus/test";

import { createConsoleLogger } from "./console-logger.ts";

describe("createConsoleLogger", () => {
  describe("出力先を渡された名前付きのロガーが info を書いた行", () => {
    const it = standardIoTest.extend("theLineFromTheNamedLogger", ({ stdout }) => {
      vi.setSystemTime(new Date("2026-08-11T00:00:00.000Z"));
      createConsoleLogger("watchdog", { out: process.stdout }).info({}, "listening");
      return stdout.text();
    });

    it("与えられた名前を載せた 1 行の JSON になる", ({ theLineFromTheNamedLogger }) => {
      expect(theLineFromTheNamedLogger).toBe(
        '{"level":"info","name":"watchdog","time":"2026-08-11T00:00:00.000Z","msg":"listening"}\n',
      );
    });
  });

  describe("付帯フィールドを添えて info を書いた行", () => {
    const it = standardIoTest.extend("theLineCarryingFields", ({ stdout }) => {
      vi.setSystemTime(new Date("2026-08-11T00:00:00.000Z"));
      createConsoleLogger("relay").info({ port: 8080, attempt: 3 }, "listening");
      return stdout.text();
    });

    it("付帯フィールドを水準と msg の間にそのまま並べる", ({ theLineCarryingFields }) => {
      expect(theLineCarryingFields).toBe(
        '{"level":"info","name":"relay","time":"2026-08-11T00:00:00.000Z","port":8080,"attempt":3,"msg":"listening"}\n',
      );
    });
  });

  describe("メッセージだけを添えて info を書いた行", () => {
    const it = standardIoTest.extend("theLineCarryingTheMessage", ({ stdout }) => {
      vi.setSystemTime(new Date("2026-08-11T00:00:00.000Z"));
      createConsoleLogger("relay").info({}, "ready to accept connections");
      return stdout.text();
    });

    it("メッセージを msg キーに置く", ({ theLineCarryingTheMessage }) => {
      expect(theLineCarryingTheMessage).toBe(
        '{"level":"info","name":"relay","time":"2026-08-11T00:00:00.000Z","msg":"ready to accept connections"}\n',
      );
    });
  });

  describe("warn で書いた行", () => {
    const it = standardIoTest.extend("theWarnLine", ({ stdout }) => {
      vi.setSystemTime(new Date("2026-08-11T00:00:00.000Z"));
      createConsoleLogger("relay").warn({}, "careful");
      return stdout.text();
    });

    it("水準に warn を載せる", ({ theWarnLine }) => {
      expect(theWarnLine).toBe(
        '{"level":"warn","name":"relay","time":"2026-08-11T00:00:00.000Z","msg":"careful"}\n',
      );
    });
  });

  describe("error で書いた行", () => {
    const it = standardIoTest.extend("theErrorLine", ({ stdout }) => {
      vi.setSystemTime(new Date("2026-08-11T00:00:00.000Z"));
      createConsoleLogger("relay").error({}, "broken");
      return stdout.text();
    });

    it("水準に error を載せる", ({ theErrorLine }) => {
      expect(theErrorLine).toBe(
        '{"level":"error","name":"relay","time":"2026-08-11T00:00:00.000Z","msg":"broken"}\n',
      );
    });
  });

  describe("原因を持つ Error を添えて error を書いた行", () => {
    const it = standardIoTest.extend("theLineCarryingAFailure", ({ stdout }) => {
      class FailureWithAPinnedStack extends Error {
        override stack = `${this.name}: ${this.message} at the relay`;
      }
      vi.setSystemTime(new Date("2026-08-11T00:00:00.000Z"));
      createConsoleLogger("relay").error(
        {
          err: new FailureWithAPinnedStack("the relay is unreachable", {
            cause: new FailureWithAPinnedStack("ECONNREFUSED"),
          }),
        },
        "cycle failed",
      );
      return stdout.text();
    });

    it("Error を名前とメッセージとスタックと原因に開いて載せる", ({ theLineCarryingAFailure }) => {
      expect(theLineCarryingAFailure).toBe(
        '{"level":"error","name":"relay","time":"2026-08-11T00:00:00.000Z","err":{"name":"Error","message":"the relay is unreachable","stack":"Error: the relay is unreachable at the relay","cause":{"name":"Error","message":"ECONNREFUSED","stack":"Error: ECONNREFUSED at the relay"}},"msg":"cycle failed"}\n',
      );
    });
  });

  describe("ファイル出力先を渡されたロガー", () => {
    const it = standardIoTest.extend("theLineHandedToTheFileSink", ({ stderr }) => {
      vi.setSystemTime(new Date("2026-08-11T00:00:00.000Z"));
      createConsoleLogger("relay", {
        fileSink: {
          append: (handedLine) => {
            process.stderr.write(handedLine);
          },
        },
      }).info({}, "listening");
      return stderr.text();
    });

    it("標準出力へ書いたものと同じ行をファイル出力先へ渡す", ({ theLineHandedToTheFileSink }) => {
      expect(theLineHandedToTheFileSink).toBe(
        '{"level":"info","name":"relay","time":"2026-08-11T00:00:00.000Z","msg":"listening"}\n',
      );
    });
  });

  describe("出力先を渡されずに info を書いたロガー", () => {
    const it = standardIoTest.extend("theRunWithoutAnOutputStream", { auto: true }, () => {
      vi.setSystemTime(new Date("2026-08-11T00:00:00.000Z"));
      createConsoleLogger("relay").info({}, "listening");
    });

    it("標準出力へ 1 行だけ書く", ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [
            "{"level":"info","name":"relay","time":"2026-08-11T00:00:00.000Z","msg":"listening"}
        ",
          ],
        }
      `);
    });

    it("標準エラーへは何も書かない", ({ stderr }) => {
      expect(stderr).toMatchInlineSnapshot(`
        {
          "chunks": [],
        }
      `);
    });
  });
});
