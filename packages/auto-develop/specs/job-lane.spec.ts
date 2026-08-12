import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vite-plus/test";

import { createJobQueue } from "../src/queue/job-queue.ts";
import { laneAdmitted, prLaneOf } from "../src/queue/pr-lane.ts";

const snapshotPathIn = (): string =>
  join(mkdtempSync(join(tmpdir(), "auto-develop-spec-")), "queue.json");

describe("PR ごとのレーンが自動応答の同時実行を 1 件に抑える", () => {
  it("レーン名は PR 番号から決まる", () => {
    expect(prLaneOf(7)).toStrictEqual("pr-7");
  });

  it("除外指定は対象指定に勝つ", () => {
    expect(
      laneAdmitted({ lane: "pr-7", prFilter: { targetPrs: [7], excludedPrs: [7] } }),
    ).toStrictEqual(false);
  });

  it("対象指定が空なら PR レーンをすべて受け入れる", () => {
    expect(
      laneAdmitted({ lane: "pr-7", prFilter: { targetPrs: [], excludedPrs: [] } }),
    ).toStrictEqual(true);
  });

  it("同じレーンで実行中の別ジョブは受け付けずに捨てる", async () => {
    const gate = new Map<string, () => void>();
    const handled = vi.fn<(payload: unknown) => Promise<void>>(
      () =>
        new Promise<void>((resolve) => {
          gate.set("release", resolve);
        }),
    );
    const queue = createJobQueue({
      concurrency: 2,
      snapshotPath: snapshotPathIn(),
      handlers: { "pr-events": handled },
    });
    queue.enqueue({
      type: "pr-events",
      payload: {},
      key: "key-1",
      lane: "pr-7",
      label: "first",
    });
    const secondAccepted = queue.enqueue({
      type: "pr-events",
      payload: {},
      key: "key-2",
      lane: "pr-7",
      label: "second",
    });
    gate.get("release")?.();
    await queue.drain();
    expect(secondAccepted).toStrictEqual(false);
  });

  it("後続受付は待機中の 1 件を最新の内容へ差し替える", () => {
    const queue = createJobQueue({
      concurrency: 1,
      snapshotPath: snapshotPathIn(),
      handlers: { "pr-events": () => new Promise<void>(() => undefined) },
    });
    queue.enqueue({ type: "pr-events", payload: {}, key: "key-1", lane: "pr-7", label: "running" });
    queue.enqueueFollowUp({
      type: "pr-events",
      payload: { revision: 2 },
      key: "key-2",
      lane: "pr-7",
      label: "follow-up",
    });
    queue.enqueueFollowUp({
      type: "pr-events",
      payload: { revision: 3 },
      key: "key-3",
      lane: "pr-7",
      label: "newest",
    });
    expect(queue.size().waiting).toStrictEqual(1);
  });

  it("前のプロセスが残したスナップショットを読み戻さない", () => {
    const snapshotPath = snapshotPathIn();
    createJobQueue({ concurrency: 1, snapshotPath });
    expect(JSON.parse(readFileSync(snapshotPath, "utf8"))).toStrictEqual({ jobs: [] });
  });
});
