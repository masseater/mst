import { describe, expect, test, vi } from "vite-plus/test";

import { silentLogger } from "../logging/logger.ts";
import { createEventDispatcher } from "./event-dispatch.ts";

import type { FilteredEvent } from "../contract/filtered-event.ts";
import type { JobQueue } from "../queue/job-queue.ts";

const queueWith = (
  accepts: boolean,
): {
  readonly queue: JobQueue;
  readonly enqueue: ReturnType<typeof vi.fn<JobQueue["enqueue"]>>;
} => {
  const enqueue = vi.fn<JobQueue["enqueue"]>(() => accepts);
  return {
    queue: {
      enqueue,
      enqueueFollowUp: () => true,
      setHandlers: () => undefined,
      runningLanes: () => [],
      waitingLanes: () => [],
      size: () => ({ waiting: 0, running: 0 }),
      isIdle: () => true,
      admitsLane: () => true,
      cancelLane: () => 0,
      drain: () => Promise.resolve(),
      reserveLane: () => Promise.resolve(null),
    },
    enqueue,
  };
};

const dispatchOne = (setup: { readonly event: FilteredEvent; readonly accepts?: boolean }) => {
  const { queue, enqueue } = queueWith(setup.accepts ?? true);
  const onPrClosed = vi.fn<(pullNumber: number) => void>();
  const onExcluded = vi.fn<(pullNumber: number) => void>();
  const dispatcher = createEventDispatcher({ queue, onPrClosed, onExcluded, log: silentLogger });
  const accepted = dispatcher.dispatch(setup.event);
  return {
    accepted,
    enqueued: enqueue.mock.calls,
    closures: onPrClosed.mock.calls,
    exclusions: onExcluded.mock.calls,
  };
};

const it = test
  .extend("reviewRequestedDispatch", () =>
    dispatchOne({
      event: { kind: "review-requested", pullNumber: 7, deliveryId: "d-1" },
    }))
  .extend("withoutDeliveryIdDispatch", () =>
    dispatchOne({ event: { kind: "merge-conflict", pullNumber: 7 } }),
  )
  .extend("closedDispatch", () =>
    dispatchOne({ event: { kind: "pr-closed", pullNumber: 7, deliveryId: "d-2" } }),
  )
  .extend("excludedDispatch", () =>
    dispatchOne({ event: { kind: "pr-excluded", pullNumber: 7, deliveryId: "d-3" } }),
  )
  .extend("refusedDispatch", () =>
    dispatchOne({
      event: { kind: "base-update", pullNumber: 7, deliveryId: "d-4" },
      accepts: false,
    }),
  );

describe("createEventDispatcher の投入", () => {
  it("PR イベントを PR レーンのジョブとして積む", ({ reviewRequestedDispatch }) => {
    expect(reviewRequestedDispatch.enqueued[0]?.[0].lane).toStrictEqual("pr-7");
  });

  it("配信 ID を重複排除キーに使う", ({ reviewRequestedDispatch }) => {
    expect(reviewRequestedDispatch.enqueued[0]?.[0].key).toStrictEqual("d-1");
  });

  it("配信 ID が無ければ種別と PR 番号からキーを作る", ({ withoutDeliveryIdDispatch }) => {
    expect(withoutDeliveryIdDispatch.enqueued[0]?.[0].key).toStrictEqual("merge-conflict-7");
  });

  it("キューが拒めば受理しなかったことを返す", ({ refusedDispatch }) => {
    expect(refusedDispatch.accepted).toStrictEqual(false);
  });
});

describe("createEventDispatcher のライフサイクル通知", () => {
  it("クローズはキューに積まずライフサイクルへ通知する", ({ closedDispatch }) => {
    expect(closedDispatch.closures).toStrictEqual([[7]]);
  });

  it("クローズはジョブを積まない", ({ closedDispatch }) => {
    expect(closedDispatch.enqueued).toStrictEqual([]);
  });

  it("除外はキューに積まず除外通知を出す", ({ excludedDispatch }) => {
    expect(excludedDispatch.exclusions).toStrictEqual([[7]]);
  });

  it("除外はジョブを積まない", ({ excludedDispatch }) => {
    expect(excludedDispatch.enqueued).toStrictEqual([]);
  });
});
