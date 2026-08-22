import { describe, expect, test } from "vite-plus/test";

import { renderStatusBar } from "./status-bar.ts";

describe("renderStatusBar", () => {
  const it = test
    .extend("threeLineBar", () =>
      renderStatusBar({
        snapshot: {
          mode: "reviewer",
          engineCommand: "claude",
          connected: true,
          runningLanes: ["pr-7"],
          waitingLanes: ["pr-9"],
          uptimeMs: 3_723_000,
        },
        width: 80,
      }))
    .extend("connectedBar", () =>
      renderStatusBar({
        snapshot: {
          mode: "reviewer",
          engineCommand: "claude",
          connected: true,
          runningLanes: ["pr-7"],
          waitingLanes: ["pr-9"],
          uptimeMs: 3_723_000,
        },
        width: 80,
      }),
    )
    .extend("reconnectingBar", () =>
      renderStatusBar({
        snapshot: {
          mode: "reviewer",
          engineCommand: "claude",
          connected: false,
          runningLanes: ["pr-7"],
          waitingLanes: ["pr-9"],
          uptimeMs: 3_723_000,
        },
        width: 80,
      }),
    )
    .extend("runningLaneBar", () =>
      renderStatusBar({
        snapshot: {
          mode: "reviewer",
          engineCommand: "claude",
          connected: true,
          runningLanes: ["pr-7"],
          waitingLanes: ["pr-9"],
          uptimeMs: 3_723_000,
        },
        width: 80,
      }),
    )
    .extend("emptyLanesBar", () =>
      renderStatusBar({
        snapshot: {
          mode: "reviewer",
          engineCommand: "claude",
          connected: true,
          runningLanes: [],
          waitingLanes: [],
          uptimeMs: 3_723_000,
        },
        width: 80,
      }),
    )
    .extend("clippedBar", () =>
      renderStatusBar({
        snapshot: {
          mode: "reviewer",
          engineCommand: "claude",
          connected: true,
          runningLanes: ["pr-7"],
          waitingLanes: ["pr-9"],
          uptimeMs: 3_723_000,
        },
        width: 20,
      }),
    )
    .extend("negativeUptimeBar", () =>
      renderStatusBar({
        snapshot: {
          mode: "reviewer",
          engineCommand: "claude",
          connected: true,
          runningLanes: ["pr-7"],
          waitingLanes: ["pr-9"],
          uptimeMs: -5,
        },
        width: 80,
      }),
    );

  it("見出しと実行中レーンと待機レーンの 3 行を返す", ({ threeLineBar }) => {
    expect(threeLineBar).toStrictEqual([
      "[reviewer] claude — connected — up 01:02:03",
      "running: pr-7",
      "waiting: pr-9",
    ]);
  });

  it("接続中は 1 行目に connected と時分秒ゼロ埋め 2 桁の稼働時間を出す", ({ connectedBar }) => {
    expect(connectedBar).toStrictEqual([
      "[reviewer] claude — connected — up 01:02:03",
      "running: pr-7",
      "waiting: pr-9",
    ]);
  });

  it("切断中は reconnecting と表示する", ({ reconnectingBar }) => {
    expect(reconnectingBar).toStrictEqual([
      "[reviewer] claude — reconnecting — up 01:02:03",
      "running: pr-7",
      "waiting: pr-9",
    ]);
  });

  it("実行中レーンを 2 行目に並べる", ({ runningLaneBar }) => {
    expect(runningLaneBar).toStrictEqual([
      "[reviewer] claude — connected — up 01:02:03",
      "running: pr-7",
      "waiting: pr-9",
    ]);
  });

  it("レーンが空なら none と書く", ({ emptyLanesBar }) => {
    expect(emptyLanesBar).toStrictEqual([
      "[reviewer] claude — connected — up 01:02:03",
      "running: none",
      "waiting: none",
    ]);
  });

  it("端末幅を超える行は末尾を省略記号で切り詰める", ({ clippedBar }) => {
    expect(clippedBar).toStrictEqual(["[reviewer] claude —…", "running: pr-7", "waiting: pr-9"]);
  });

  it("負の経過時間は 0 に倒して表示する", ({ negativeUptimeBar }) => {
    expect(negativeUptimeBar).toStrictEqual([
      "[reviewer] claude — connected — up 00:00:00",
      "running: pr-7",
      "waiting: pr-9",
    ]);
  });
});
