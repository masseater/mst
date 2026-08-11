export const ENGINE_SESSION_PREFIX = "auto-develop";

export const engineSessionName = (prNumber: number): string =>
  `${ENGINE_SESSION_PREFIX}-pr-${prNumber}`;
