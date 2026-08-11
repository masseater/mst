import { describe, expect, test, vi } from "vite-plus/test";

import { formatElapsed, withJobBanner } from "./job-banner.ts";

const recordingOut = (): {
  readonly out: { readonly write: (chunk: string) => void };
  readonly lines: () => readonly string[];
} => {
  const chunks = new Map<number, string>();
  return {
    out: {
      write: (chunk) => {
        chunks.set(chunks.size, chunk);
      },
    },
    lines: () => [...chunks.values()],
  };
};

describe("formatElapsed", () => {
  test("最近接の整数秒へ丸める", () => {
    expect([formatElapsed(3252), formatElapsed(250), formatElapsed(-10)]).toStrictEqual([
      "3s",
      "0s",
      "0s",
    ]);
  });

  test("60 秒以上は分とゼロ埋め 2 桁秒の形式になる", () => {
    expect(formatElapsed(252_000)).toStrictEqual("4m12s");
  });
});

describe("withJobBanner", () => {
  test("成功時は開始行と経過時間入りの完了行の 2 行が出る", async () => {
    const { out, lines } = recordingOut();
    const clock = new Map([["nowMs", 0]]);
    const completedValue = await withJobBanner({
      mode: "reviewer",
      prNumber: 7,
      out,
      now: () => {
        const nowMs = clock.get("nowMs") ?? 0;
        clock.set("nowMs", nowMs + 3252);
        return nowMs;
      },
      run: () => Promise.resolve("reviewed"),
    });
    expect([completedValue, lines()]).toStrictEqual([
      "reviewed",
      [
        "[reviewer] 🪟 PR #7 picked up — attach: tmux attach -t auto-develop-pr-7\n",
        "[reviewer] ✅ PR #7 done in 3s — attach: tmux attach -t auto-develop-pr-7\n",
      ],
    ]);
  });

  test("失敗時はエラーメッセージ入りの失敗行を出して元のエラーを再送出する", async () => {
    const { out, lines } = recordingOut();
    const jobFailure = new Error("engine crashed");
    await expect(
      withJobBanner({
        mode: "author",
        prNumber: 7,
        out,
        now: () => 0,
        run: () => Promise.reject(jobFailure),
      }),
    ).rejects.toThrow(jobFailure);
    expect(lines()[1]).toStrictEqual(
      "[author] ❌ PR #7 failed: engine crashed — attach: tmux attach -t auto-develop-pr-7\n",
    );
  });

  test("エラーでない値が投げられたら文字列化してメッセージに使う", async () => {
    const { out, lines } = recordingOut();
    await expect(
      withJobBanner({
        mode: "author",
        prNumber: 7,
        out,
        now: () => 0,
        run: async () => {
          const nonErrorFailure: unknown = "broken";
          throw nonErrorFailure;
        },
      }),
    ).rejects.toThrow("broken");
    expect(lines()[1]?.includes("failed: broken")).toStrictEqual(true);
  });

  test("出力先を指定しなければ標準出力へ書かれる", async () => {
    const stdoutSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true);
    await withJobBanner({ mode: "reviewer", prNumber: 7, run: () => Promise.resolve() });
    const writtenLines = stdoutSpy.mock.calls.map(([chunk]) => chunk);
    stdoutSpy.mockRestore();
    expect(writtenLines.length).toStrictEqual(2);
  });
});
