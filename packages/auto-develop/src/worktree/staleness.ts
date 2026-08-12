const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

export type StalenessInputs = {
  readonly remoteBranchExists: boolean | null;
  readonly lastUsedMtimeMs: number | null;
  readonly nowMs: number;
};

export const shouldReclaim = (inputs: StalenessInputs): boolean => {
  if (inputs.remoteBranchExists === null) return false;
  if (!inputs.remoteBranchExists) return true;
  if (inputs.lastUsedMtimeMs === null) return false;
  return inputs.nowMs - inputs.lastUsedMtimeMs >= STALE_AFTER_MS;
};

export const remoteBranchPresentIn = (lsRemoteOutput: string, branch: string): boolean => {
  const qualifiedRef = `refs/heads/${branch}`;
  return lsRemoteOutput.split("\n").some((line) => line.split("\t").at(-1) === qualifiedRef);
};
