/** @canonical-values auto-develop.engine */
export const ENGINES = ["claude", "codex"] as const;

export type EngineKind = (typeof ENGINES)[number];

export const DEFAULT_ENGINE = ENGINES[0];

export const CLAUDE_ENGINE = ENGINES[0];
