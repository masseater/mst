import { describe, expect, test } from "vite-plus/test";

import { HaltQueueKeepJobError } from "../queue/halt-disposition.ts";
import { CredentialTerminalError } from "../transport/credential-provider.ts";
import { SseRequestRejectedError } from "../transport/sse-request-rejected-error.ts";
import { backoffAfterFailures, needsOperatorIntervention } from "./cycle-backoff.ts";

const it = test
  .extend("verdictForCredentialRefusal", () =>
    needsOperatorIntervention(new CredentialTerminalError("refused")))
  .extend("verdictForSseRefusal", () => needsOperatorIntervention(new SseRequestRejectedError()))
  .extend("verdictForHaltDisposition", () =>
    needsOperatorIntervention(new HaltQueueKeepJobError("authentication expired")),
  )
  .extend("verdictForTransientFailure", () =>
    needsOperatorIntervention(new Error("the relay is briefly unavailable")),
  )
  .extend("firstFailureFloor", () =>
    backoffAfterFailures({ consecutiveFailures: 1, random: () => 0 }),
  )
  .extend("firstFailureCeiling", () =>
    backoffAfterFailures({ consecutiveFailures: 1, random: () => 1 }),
  )
  .extend("thirdFailureCentre", () =>
    backoffAfterFailures({ consecutiveFailures: 3, random: () => 0.5 }),
  )
  .extend("cappedFailureCentre", () =>
    backoffAfterFailures({ consecutiveFailures: 30, random: () => 0.5 }),
  )
  .extend("neverZeroDelay", () =>
    backoffAfterFailures({ consecutiveFailures: -100, random: () => 0 }),
  );

describe("needsOperatorIntervention", () => {
  it("credential の恒久拒否はループごと終える", ({ verdictForCredentialRefusal }) => {
    expect(verdictForCredentialRefusal).toStrictEqual(true);
  });

  it("SSE 接続要求の拒否はループごと終える", ({ verdictForSseRefusal }) => {
    expect(verdictForSseRefusal).toStrictEqual(true);
  });

  it("キュー停止指示を持つ失敗はループごと終える", ({ verdictForHaltDisposition }) => {
    expect(verdictForHaltDisposition).toStrictEqual(true);
  });

  it("それ以外の失敗は再試行に回す", ({ verdictForTransientFailure }) => {
    expect(verdictForTransientFailure).toStrictEqual(false);
  });
});

describe("backoffAfterFailures", () => {
  it("初回失敗のジッター下限は基準遅延の半分になる", ({ firstFailureFloor }) => {
    expect(firstFailureFloor).toStrictEqual(1500);
  });

  it("初回失敗のジッター上限は基準遅延の 1.5 倍になる", ({ firstFailureCeiling }) => {
    expect(firstFailureCeiling).toStrictEqual(4500);
  });

  it("連続失敗のたびに基準遅延を倍にする", ({ thirdFailureCentre }) => {
    expect(thirdFailureCentre).toStrictEqual(12_000);
  });

  it("どれだけ失敗が続いても 5 分で頭打ちにする", ({ cappedFailureCentre }) => {
    expect(cappedFailureCentre).toStrictEqual(300_000);
  });

  it("下限は 1 ミリ秒で、0 は返さない", ({ neverZeroDelay }) => {
    expect(neverZeroDelay).toStrictEqual(1);
  });
});
