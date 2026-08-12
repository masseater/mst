import type { Mode } from "./vocabulary.ts";

export const connectionCursorId = (githubLogin: string, spelledMode: Mode): string =>
  `${githubLogin.toLowerCase()}-${spelledMode}`;
