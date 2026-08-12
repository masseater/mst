import type { Mode } from "./vocabulary.ts";

export const connectionCursorId = (githubLogin: string, mode: Mode): string =>
  `${githubLogin.toLowerCase()}-${mode}`;
