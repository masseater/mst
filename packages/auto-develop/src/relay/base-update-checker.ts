import { EXCLUSION_LABEL } from "../contract/vocabulary.ts";
import { EVENT_TTL_MS } from "./durations.ts";
import { indicatesSummaryConflict } from "./startup-drain.ts";
import { baseUpdateCheckDeliveryId, synthesizeEnvelope } from "./synth.ts";

import type { GithubPullSummary, GithubReader } from "./github-reader.ts";
import type { EventStore } from "./store.ts";

export type BaseUpdateCheckReport = {
  readonly scanned: number;
  readonly behind: number;
  readonly stored: number;
};

const storeBehindEvent = async (storing: {
  readonly pull: GithubPullSummary;
  readonly events: EventStore;
  readonly nowMs: number;
}): Promise<void> => {
  const envelope = synthesizeEnvelope({
    filtered: { kind: "base-update", pullNumber: storing.pull.number },
    deliveryId: baseUpdateCheckDeliveryId(storing.pull),
    authorLogin: storing.pull.authorLogin,
  });
  await storing.events.createIfAbsent({
    id: envelope.delivery_id,
    eventType: envelope.event_type,
    deliveryId: envelope.delivery_id,
    payload: envelope.payload,
    receivedAtMs: storing.nowMs,
    expiresAtMs: storing.nowMs + EVENT_TTL_MS,
  });
};

export const runBaseUpdateCheck = async (check: {
  readonly github: GithubReader;
  readonly events: EventStore;
  readonly now?: () => number;
}): Promise<BaseUpdateCheckReport> => {
  const openPulls = await check.github.listOpenPullRequests();
  const eligiblePulls = openPulls.filter((pull) => !pull.labelNames.includes(EXCLUSION_LABEL));
  const behindPulls = eligiblePulls.filter(
    (pull) => !indicatesSummaryConflict(pull) && pull.mergeStateStatus === "BEHIND",
  );
  const now = check.now ?? Date.now;
  const nowMs = now();
  for (const pull of behindPulls) {
    await storeBehindEvent({ pull, events: check.events, nowMs });
  }
  return { scanned: openPulls.length, behind: behindPulls.length, stored: behindPulls.length };
};
