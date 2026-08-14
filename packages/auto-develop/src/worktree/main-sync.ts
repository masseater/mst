import { DEFAULT_BRANCH_FALLBACK } from "./default-branch.ts";

import type { Logger } from "../logging/logger.ts";
import type { GitRunner } from "./git-runner.ts";

const checkoutIfNeeded = async (checkout: {
  readonly run: (args: readonly string[]) => Promise<unknown>;
  readonly targetBranch: string;
  readonly log: Logger;
}): Promise<void> => {
  const currentBranch = (
    (await checkout.run(["rev-parse", "--abbrev-ref", "HEAD"])) as { stdout: string }
  ).stdout.trim();
  if (currentBranch === checkout.targetBranch) return;
  checkout.log.info(
    { from: currentBranch, targetBranch: checkout.targetBranch },
    "checking out the target branch",
  );
  await checkout.run(["checkout", "--force", checkout.targetBranch]);
};

export const syncMain = async (sync: {
  readonly git: GitRunner;
  readonly startDir: string;
  readonly targetBranch?: string;
  readonly log: Logger;
}): Promise<void> => {
  const rootOutput = await sync.git.run({
    args: ["rev-parse", "--show-toplevel"],
    cwd: sync.startDir,
  });
  const repoDir = rootOutput.stdout.trim();
  const targetBranch = sync.targetBranch ?? DEFAULT_BRANCH_FALLBACK;
  sync.log.info({ targetBranch }, "syncing repository to the target branch");
  const run = (handedArgs: readonly string[]) => sync.git.run({ args: handedArgs, cwd: repoDir });
  await checkoutIfNeeded({ run, targetBranch, log: sync.log });
  await run(["fetch", "origin"]);
  await run(["reset", "--hard", `origin/${targetBranch}`]);
  sync.log.info({ targetBranch }, "repository synced to the target branch");
};
