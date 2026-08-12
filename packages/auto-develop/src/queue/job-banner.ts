import { engineSessionName } from "../engine/session-name.ts";

import type { Mode } from "../contract/vocabulary.ts";

const formatElapsed = (elapsedMs: number): string => {
  const totalSeconds = Math.max(0, Math.round(elapsedMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}m${seconds}s`;
};

const failureMessageOf = (runFailure: unknown): string =>
  runFailure instanceof Error ? runFailure.message : String(runFailure);

export const withJobBanner = async <RunResult>(banner: {
  readonly mode: Mode;
  readonly prNumber: number;
  readonly run: () => Promise<RunResult>;
  readonly out?: { readonly write: (chunk: string) => void };
  readonly now?: () => number;
}): Promise<RunResult> => {
  const { out = process.stdout, now = Date.now } = banner;
  const attachHint = `attach: tmux attach -t ${engineSessionName(banner.prNumber)}`;
  const startedAtMs = now();
  out.write(`[${banner.mode}] 🪟 PR #${banner.prNumber} picked up — ${attachHint}\n`);
  try {
    const completedValue = await banner.run();
    out.write(
      `[${banner.mode}] ✅ PR #${banner.prNumber} done in ${formatElapsed(now() - startedAtMs)} — ${attachHint}\n`,
    );
    return completedValue;
  } catch (runFailure) {
    out.write(
      `[${banner.mode}] ❌ PR #${banner.prNumber} failed: ${failureMessageOf(runFailure)} — ${attachHint}\n`,
    );
    throw runFailure;
  }
};
