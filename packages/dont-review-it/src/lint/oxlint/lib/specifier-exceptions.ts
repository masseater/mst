import { matchesGlobPath } from "./glob-path-match.ts";

import type { Options } from "@oxlint/plugins";

export const SPECIFIER_EXCEPTION_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: { path: { type: "string" }, reason: { type: "string" } },
    required: ["path"],
    additionalProperties: false,
  },
} as const;

export type SpecifierException = {
  readonly path: string;
  readonly reason: string;
};

export const specifierExceptionsIn = (
  ruleOptions: Readonly<Options>,
): readonly SpecifierException[] => {
  const [declared] = ruleOptions;
  if (typeof declared !== "object" || declared === null || Array.isArray(declared)) return [];

  const listed = declared.exceptions;
  if (!Array.isArray(listed)) return [];

  return listed.flatMap((listed) => {
    if (typeof listed !== "object" || listed === null || Array.isArray(listed)) return [];
    const { path, reason } = listed;
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
