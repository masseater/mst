import { describe, expect, test } from "vite-plus/test";

import { renderStatusBar, type StatusSnapshot } from "./status-bar.ts";

const snapshot = (overrides: Partial<StatusSnapshot> = {}): StatusSnapshot => ({
  mode: "reviewer",
  engineCommand: "claude",
  connected: true,
  runningLanes: ["pr-7"],
  waitingLanes: ["pr-9"],
  uptimeMs: 3_723_000,
  ...overrides,
});

const it = test
  .extend("connectedBar", () => renderStatusBar({ snapshot: snapshot(), width: 80 }))
  .extend("reconnectingBar", () =>
    renderStatusBar({ snapshot: snapshot({ connected: false }), width: 80 }),
  )
  .extend("emptyLanesBar", () =>
    renderStatusBar({ snapshot: snapshot({ runningLanes: [], waitingLanes: [] }), width: 80 }),
  )
  .extend("clippedBar", () => renderStatusBar({ snapshot: snapshot(), width: 20 }))
  .extend("negativeUptimeBar", () =>
    renderStatusBar({ snapshot: snapshot({ uptimeMs: -5 }), width: 80 }),
  );

describe("renderStatusBar", () => {
  it("常に 3 行を返す", ({ connectedBar }) => {
    expect(connectedBar.length).toStrictEqual(3);
  });

  it("接続中は 1 行目に connected と時分秒ゼロ埋め 2 桁の稼働時間を出す", ({ connectedBar }) => {
    expect(connectedBar[0]).toStrictEqual("[reviewer] claude — connected — up 01:02:03");
  });

  it("切断中は reconnecting と表示する", ({ reconnectingBar }) => {
    expect(reconnectingBar[0]).toStrictEqual("[reviewer] claude — reconnecting — up 01:02:03");
  });

  it("実行中レーンを 2 行目に並べる", ({ connectedBar }) => {
    expect(connectedBar[1]).toStrictEqual("running: pr-7");
  });

  it("レーンが空なら none と書く", ({ emptyLanesBar }) => {
    expect(emptyLanesBar[1]).toStrictEqual("running: none");
  });

  it("端末幅を超える行は末尾を省略記号で切り詰める", ({ clippedBar }) => {
    expect(clippedBar[0]).toStrictEqual("[reviewer] claude —…");
  });

  it("負の経過時間は 0 に倒して表示する", ({ negativeUptimeBar }) => {
    expect(negativeUptimeBar[0]).toStrictEqual("[reviewer] claude — connected — up 00:00:00");
  });
});
