import type { LifecycleGate } from "../lifecycle/lifecycle-gate.ts";
import type { CommitStatusState } from "../lifecycle/review-verdict.ts";
import type { Logger } from "../logging/logger.ts";
import type { HandlerGithubClient } from "./github-client.ts";

export type GenerationGuard = {
  readonly gate: LifecycleGate;
  readonly prNumber: number;
  readonly generation: number;
};

export type StatusWriter = {
  readonly write: (status: {
    readonly sha: string;
    readonly state: CommitStatusState;
    readonly description: string;
  }) => Promise<boolean>;
};

export const createStatusWriter = (writer: {
  readonly github: HandlerGithubClient;
  readonly context: string;
  readonly log: Logger;
  readonly guard?: GenerationGuard;
}): StatusWriter => ({
  write: async (heldStatus) => {
    const { guard } = writer;
    if (
      guard !== undefined &&
      !guard.gate.isCurrentGeneration({
        prNumber: guard.prNumber,
        generation: guard.generation,
      })
    ) {
      writer.log.info(
        { prNumber: guard.prNumber, state: heldStatus.state },
        "commit heldStatus skipped; the review input generation moved on",
      );
      return false;
    }
    try {
      await writer.github.createCommitStatus({
        sha: heldStatus.sha,
        state: heldStatus.state,
        context: writer.context,
        description: heldStatus.description,
      });
    } catch (statusFailure) {
      writer.log.warn(
        { sha: heldStatus.sha, err: statusFailure },
        "creating the commit heldStatus failed",
      );
    }
    return true;
  },
});
