import { standardIoTest } from "@mst/dont-review-it/vitest";
import { describe, expect } from "vite-plus/test";

import { withJobBanner } from "./job-banner.ts";

const jobFailure = new Error("engine crashed");

describe("withJobBanner", () => {
  describe("出力先を指定しない実行", () => {
    const it = standardIoTest.extend("theDefaultStreamBannerRun", { auto: true }, () =>
      withJobBanner({
        mode: "reviewer",
        prNumber: 7,
        now: () => 0,
        run: () => Promise.resolve(),
      }),
    );

    it("開始行と完了行を標準出力へ書く", ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [
            "[reviewer] 🪟 PR #7 picked up — attach: tmux attach -t auto-develop-pr-7
        ",
            "[reviewer] ✅ PR #7 done in 0s — attach: tmux attach -t auto-develop-pr-7
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

  describe("1 秒に満たない経過の実行", () => {
    const it = standardIoTest.extend("theQuarterSecondBannerRun", { auto: true }, () => {
      const elapsedClockReadings = [0, 250].values();
      return withJobBanner({
        mode: "reviewer",
        prNumber: 7,
        now: () => elapsedClockReadings.next().value ?? 0,
        run: () => Promise.resolve(),
      });
    });

    it("完了行の経過を 0 秒と書く", ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [
            "[reviewer] 🪟 PR #7 picked up — attach: tmux attach -t auto-develop-pr-7
        ",
            "[reviewer] ✅ PR #7 done in 0s — attach: tmux attach -t auto-develop-pr-7
        ",
          ],
        }
      `);
    });
  });

  describe("負の経過の実行", () => {
    const it = standardIoTest.extend("theNegativeSpanBannerRun", { auto: true }, () => {
      const elapsedClockReadings = [0, -10].values();
      return withJobBanner({
        mode: "reviewer",
        prNumber: 7,
        now: () => elapsedClockReadings.next().value ?? 0,
        run: () => Promise.resolve(),
      });
    });

    it("完了行の経過を 0 秒と書く", ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [
            "[reviewer] 🪟 PR #7 picked up — attach: tmux attach -t auto-develop-pr-7
        ",
            "[reviewer] ✅ PR #7 done in 0s — attach: tmux attach -t auto-develop-pr-7
        ",
          ],
        }
      `);
    });
  });

  describe("60 秒を超える経過の実行", () => {
    const it = standardIoTest.extend("theFourMinuteBannerRun", { auto: true }, () => {
      const elapsedClockReadings = [0, 252_000].values();
      return withJobBanner({
        mode: "reviewer",
        prNumber: 7,
        now: () => elapsedClockReadings.next().value ?? 0,
        run: () => Promise.resolve(),
      });
    });

    it("完了行の経過を分とゼロ埋め 2 桁秒で書く", ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [
            "[reviewer] 🪟 PR #7 picked up — attach: tmux attach -t auto-develop-pr-7
        ",
            "[reviewer] ✅ PR #7 done in 4m12s — attach: tmux attach -t auto-develop-pr-7
        ",
          ],
        }
      `);
    });
  });

  describe("端数を含む経過で成功した実行", () => {
    const it = standardIoTest.extend("theReviewHandedBackByTheBanner", { auto: true }, () => {
      const elapsedClockReadings = [0, 3252].values();
      return withJobBanner({
        mode: "reviewer",
        prNumber: 7,
        now: () => elapsedClockReadings.next().value ?? 0,
        run: () => Promise.resolve("reviewed"),
      });
    });

    it("本体の戻り値をそのまま返す", ({ theReviewHandedBackByTheBanner }) => {
      expect(theReviewHandedBackByTheBanner).toBe("reviewed");
    });

    it("開始行と、端数を最近接の整数秒へ丸めた完了行を書く", ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [
            "[reviewer] 🪟 PR #7 picked up — attach: tmux attach -t auto-develop-pr-7
        ",
            "[reviewer] ✅ PR #7 done in 3s — attach: tmux attach -t auto-develop-pr-7
        ",
          ],
        }
      `);
    });
  });

  describe("エラーで失敗した実行", () => {
    const it = standardIoTest.extend(
      "theFailureRethrownByTheBanner",
      { auto: true },
      async (): Promise<unknown> => {
        try {
          return await withJobBanner({
            mode: "author",
            prNumber: 7,
            now: () => 0,
            run: () => Promise.reject(jobFailure),
          });
        } catch (bannerFailure) {
          return bannerFailure;
        }
      },
    );

    it("元のエラーをそのまま再送出する", ({ theFailureRethrownByTheBanner }) => {
      expect(theFailureRethrownByTheBanner).toBe(jobFailure);
    });

    it("エラーメッセージ入りの失敗行を書く", ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [
            "[author] 🪟 PR #7 picked up — attach: tmux attach -t auto-develop-pr-7
        ",
            "[author] ❌ PR #7 failed: engine crashed — attach: tmux attach -t auto-develop-pr-7
        ",
          ],
        }
      `);
    });
  });

  describe("エラーでない値で失敗した実行", () => {
    const it = standardIoTest.extend(
      "theNonErrorRethrownByTheBanner",
      { auto: true },
      async (): Promise<unknown> => {
        try {
          return await withJobBanner({
            mode: "author",
            prNumber: 7,
            now: () => 0,
            run: async () => {
              const brokenSignal: unknown = "broken";
              throw brokenSignal;
            },
          });
        } catch (bannerFailure) {
          return bannerFailure;
        }
      },
    );

    it("投げられた値をそのまま再送出する", ({ theNonErrorRethrownByTheBanner }) => {
      expect(theNonErrorRethrownByTheBanner).toBe("broken");
    });

    it("投げられた値を文字列化して失敗行に書く", ({ stdout }) => {
      expect(stdout).toMatchInlineSnapshot(`
        {
          "chunks": [
            "[author] 🪟 PR #7 picked up — attach: tmux attach -t auto-develop-pr-7
        ",
            "[author] ❌ PR #7 failed: broken — attach: tmux attach -t auto-develop-pr-7
        ",
          ],
        }
      `);
    });
  });
});
