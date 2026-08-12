import { standardIoTest } from "@mst/dont-review-it/vitest";
import { describe, expect, test } from "vite-plus/test";

import { withJobBanner } from "./job-banner.ts";

const recordingOut = (): {
  readonly out: { readonly write: (chunk: string) => void };
  readonly lines: () => readonly string[];
} => {
  const writtenChunks = new Map<number, string>();
  return {
    out: {
      write: (writtenChunk) => {
        writtenChunks.set(writtenChunks.size, writtenChunk);
      },
    },
    lines: () => [...writtenChunks.values()],
  };
};

const jobFailure = new Error("engine crashed");

const bannerRunTaking = async (
  elapsedMs: number,
): Promise<{ readonly completed: string; readonly lines: readonly string[] }> => {
  const { out, lines } = recordingOut();
  const clock = new Map([["nowMs", 0]]);
  const completed = await withJobBanner({
    mode: "reviewer",
    prNumber: 7,
    out,
    now: () => {
      const nowMs = clock.get("nowMs") ?? 0;
      clock.set("nowMs", nowMs + elapsedMs);
      return nowMs;
    },
    run: () => Promise.resolve("reviewed"),
  });
  return { completed, lines: lines() };
};

const it = test
  .extend("successfulBannerRun", () => bannerRunTaking(3252))
  .extend("quarterSecondBannerRun", () => bannerRunTaking(250))
  .extend("negativeSpanBannerRun", () => bannerRunTaking(-10))
  .extend("fourMinuteBannerRun", () => bannerRunTaking(252_000))
  .extend(
    "failedBannerRun",
    async (): Promise<{ readonly caught: unknown; readonly failureLine: string }> => {
      const { out, lines } = recordingOut();
      try {
        await withJobBanner({
          mode: "author",
          prNumber: 7,
          out,
          now: () => 0,
          run: () => Promise.reject(jobFailure),
        });
        return { caught: null, failureLine: lines()[1] ?? "" };
      } catch (bannerFailure) {
        return { caught: bannerFailure, failureLine: lines()[1] ?? "" };
      }
    },
  )
  .extend(
    "nonErrorBannerRun",
    async (): Promise<{ readonly caught: unknown; readonly failureLine: string }> => {
      const { out, lines } = recordingOut();
      try {
        await withJobBanner({
          mode: "author",
          prNumber: 7,
          out,
          now: () => 0,
          run: async () => {
            const nonErrorFailure: unknown = "broken";
            throw nonErrorFailure;
          },
        });
        return { caught: null, failureLine: lines()[1] ?? "" };
      } catch (bannerFailure) {
        return { caught: bannerFailure, failureLine: lines()[1] ?? "" };
      }
    },
  );

standardIoTest("出力先を指定しなければ標準出力へ書かれる", async ({ stdout }) => {
  await withJobBanner({
    mode: "reviewer",
    prNumber: 7,
    now: () => 0,
    run: () => Promise.resolve(),
  });

  expect(stdout.text).toMatchInlineSnapshot(`
    "[reviewer] 🪟 PR #7 picked up — attach: tmux attach -t auto-develop-pr-7
    [reviewer] ✅ PR #7 done in 0s — attach: tmux attach -t auto-develop-pr-7
    "
  `);
});

standardIoTest("既定の経路は標準エラーへ何も書かない", async ({ stderr }) => {
  await withJobBanner({
    mode: "reviewer",
    prNumber: 7,
    now: () => 0,
    run: () => Promise.resolve(),
  });

  expect(stderr.text).toMatchInlineSnapshot(`""`);
});

describe("withJobBanner の経過時間表記", () => {
  it("1 秒に満たない経過は 0 秒と書く", ({ quarterSecondBannerRun }) => {
    expect(quarterSecondBannerRun.lines[1]).toContain("done in 0s");
  });

  it("負の経過も 0 秒と書く", ({ negativeSpanBannerRun }) => {
    expect(negativeSpanBannerRun.lines[1]).toContain("done in 0s");
  });

  it("60 秒以上は分とゼロ埋め 2 桁秒の形式で書く", ({ fourMinuteBannerRun }) => {
    expect(fourMinuteBannerRun.lines[1]).toContain("done in 4m12s");
  });
});

describe("withJobBanner", () => {
  it("成功時は本体の戻り値をそのまま返す", ({ successfulBannerRun }) => {
    expect(successfulBannerRun.completed).toStrictEqual("reviewed");
  });

  it("成功時は開始行と、端数を最近接の整数秒へ丸めた完了行の 2 行が出る", ({
    successfulBannerRun,
  }) => {
    expect(successfulBannerRun.lines).toStrictEqual([
      "[reviewer] 🪟 PR #7 picked up — attach: tmux attach -t auto-develop-pr-7\n",
      "[reviewer] ✅ PR #7 done in 3s — attach: tmux attach -t auto-develop-pr-7\n",
    ]);
  });

  it("失敗時は元のエラーを再送出する", ({ failedBannerRun }) => {
    expect(failedBannerRun.caught).toStrictEqual(jobFailure);
  });

  it("失敗時はエラーメッセージ入りの失敗行を出す", ({ failedBannerRun }) => {
    expect(failedBannerRun.failureLine).toStrictEqual(
      "[author] ❌ PR #7 failed: engine crashed — attach: tmux attach -t auto-develop-pr-7\n",
    );
  });

  it("エラーでない値もそのまま再送出する", ({ nonErrorBannerRun }) => {
    expect(nonErrorBannerRun.caught).toStrictEqual("broken");
  });

  it("エラーでない値が投げられたら文字列化してメッセージに使う", ({ nonErrorBannerRun }) => {
    expect(nonErrorBannerRun.failureLine).toContain("failed: broken");
  });
});
