import { matchesAnchoredGlobPath } from "../glob-path-match.ts";
import { segmentsOf } from "../path-segments.ts";
import {
  spelledNames,
  type CoverageFinding,
  type DeclaredCheck,
  type RegistrationRow,
} from "./coverage-declarations.ts";

const matchesPattern = (asked: {
  readonly relativePath: string;
  readonly pattern: string;
}): boolean =>
  matchesAnchoredGlobPath({ relativePath: asked.relativePath, pattern: asked.pattern });

export const pathsMatching = (asked: {
  readonly paths: readonly string[];
  readonly patterns: readonly string[];
}): readonly string[] =>
  asked.paths.filter((relativePath) =>
    asked.patterns.some((pattern) => matchesPattern({ relativePath, pattern })),
  );

export const excludingPatternsOf = (asked: {
  readonly check: DeclaredCheck;
  readonly relativePath: string;
}): readonly string[] =>
  asked.check.excludedPaths.filter((pattern) =>
    matchesPattern({ relativePath: asked.relativePath, pattern }),
  );

export const opensPath = (asked: {
  readonly check: DeclaredCheck;
  readonly relativePath: string;
}): boolean => {
  const covered = asked.check.coveredPaths.some((pattern) =>
    matchesPattern({ relativePath: asked.relativePath, pattern }),
  );
  return covered && excludingPatternsOf(asked).length === 0;
};

export const UNCHECKED_AUTHORED_PATH_MESSAGE_ID = "uncheckedAuthoredPath";

const uncheckedFindingOf = (asked: {
  readonly relativePath: string;
  readonly checks: readonly DeclaredCheck[];
}): CoverageFinding => ({
  heldPath: asked.relativePath,
  messageId: UNCHECKED_AUTHORED_PATH_MESSAGE_ID,
  data: {
    authoredPath: asked.relativePath,
    declaredChecks: spelledNames(asked.checks.map((check) => check.name)),
  },
});

export const uncheckedPathFindings = (asked: {
  readonly paths: readonly string[];
  readonly checks: readonly DeclaredCheck[];
  readonly uncheckedDeclarations: readonly RegistrationRow[];
}): readonly CoverageFinding[] =>
  asked.paths
    .filter(
      (relativePath) =>
        !asked.checks.some((check) => opensPath({ check, relativePath })) &&
        !asked.uncheckedDeclarations.some(({ pattern }) =>
          matchesPattern({ relativePath, pattern }),
        ),
    )
    .map((relativePath) => uncheckedFindingOf({ relativePath, checks: asked.checks }));

const EXTENSION_DECLARATION = /^\*\.[^*]+$/u;

export const coversWholeDirectory = (pattern: string): boolean =>
  segmentsOf({ path: pattern, separator: "/" })
    .slice(-1)
    .some((named) => named.includes("*") && !EXTENSION_DECLARATION.test(named));

export const BROAD_UNCHECKED_DECLARATION_MESSAGE_ID = "broadUncheckedDeclaration";

export const broadDeclarationFindings = (
  uncheckedDeclarations: readonly RegistrationRow[],
): readonly CoverageFinding[] =>
  uncheckedDeclarations
    .filter((declaration) => coversWholeDirectory(declaration.pattern))
    .map((declaration) => ({
      heldPath: null,
      messageId: BROAD_UNCHECKED_DECLARATION_MESSAGE_ID,
      data: { pattern: declaration.pattern, reason: declaration.reason },
    }));
