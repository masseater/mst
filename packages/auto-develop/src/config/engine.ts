/** @canonical-values auto-develop.engine */
export const ENGINES = ["claude", "codex"] as const;

export type Engine = (typeof ENGINES)[number];

export const DEFAULT_ENGINE = ENGINES[0];
