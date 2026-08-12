import { matchesGlobPath } from "./glob-path-match.ts";

import type { Options } from "@oxlint/plugins";

export type SpecifierException = {
  readonly path: string;
  readonly reason: string;
};

export const SPECIFIER_EXCEPTION_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: { path: { type: "string" }, reason: { type: "string" } },
    required: ["path"],
    additionalProperties: false,
  },
} as const;

export const specifierExceptionsIn = (
  options: Readonly<Options>,
): readonly SpecifierException[] => {
  const [declared] = options;
  if (typeof declared !== "object" || declared === null || Array.isArray(declared)) return [];

  const listed = declared.exceptions;
  if (!Array.isArray(listed)) return [];

  return listed.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return [];
    const { path, reason } = entry;
    if (typeof path !== "string") return [];
    return [{ path, reason: typeof reason === "string" ? reason.trim() : "" }];
  });
};

export const exceptionsCovering = ({
  exceptions,
  pathSegments,
  cwd,
}: {
  readonly exceptions: readonly SpecifierException[];
  readonly pathSegments: readonly string[];
  readonly cwd: string;
}): readonly SpecifierException[] =>
  exceptions.filter((exception) => matchesGlobPath({ pathSegments, pattern: exception.path, cwd }));

export const carriesGrounds = (exception: SpecifierException): boolean => exception.reason !== "";
