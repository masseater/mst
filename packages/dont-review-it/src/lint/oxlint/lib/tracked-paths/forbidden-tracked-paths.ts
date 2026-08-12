import type { Options, RuleMeta } from "@oxlint/plugins";

export type GroundedPattern = {
  readonly pattern: string;
  readonly reason: string;
};

export type ForbiddenTrackedPath = {
  readonly pattern: string;
  readonly reason: string;
  readonly ignoreListing: boolean;
  readonly exceptions: readonly GroundedPattern[];
};

const GROUNDED_PATTERN_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: { pattern: { type: "string" }, reason: { type: "string" } },
    required: ["pattern"],
    additionalProperties: false,
  },
} as const;

export const FORBIDDEN_TRACKED_PATH_SCHEMA: RuleMeta["schema"] = [
  {
    type: "object",
    properties: {
      forbidden: {
        type: "array",
        items: {
          type: "object",
          properties: {
            pattern: { type: "string" },
            reason: { type: "string" },
            ignoreListing: { type: "boolean" },
            exceptions: GROUNDED_PATTERN_SCHEMA,
          },
          required: ["pattern", "reason"],
          additionalProperties: false,
        },
      },
      released: GROUNDED_PATTERN_SCHEMA,
    },
    additionalProperties: false,
  },
];

const DEFAULT_FORBIDDEN_TRACKED_PATHS: readonly ForbiddenTrackedPath[] = [
  {
    pattern: "**/node_modules/**",
    reason: "an installed dependency tree is restored from the manifest and the lockfile",
    ignoreListing: true,
    exceptions: [],
  },
  {
    pattern: "**/dist/**",
    reason: "build output is produced from the sources beside it",
    ignoreListing: true,
    exceptions: [],
  },
  {
    pattern: "**/coverage/**",
    reason: "coverage output is produced by the test run",
    ignoreListing: true,
    exceptions: [],
  },
  {
    pattern: "**/.env",
    reason: "environment values belong to the machine that runs the code",
    ignoreListing: true,
    exceptions: [],
  },
];

const namedFieldsOf = (held: unknown): Readonly<Record<string, unknown>> | null =>
  typeof held !== "object" || held === null || Array.isArray(held)
    ? null
    : (held as Readonly<Record<string, unknown>>);

const listedUnder = (options: Readonly<Options>, key: string): readonly unknown[] => {
  const fields = namedFieldsOf(options[0]);
  const held = fields === null ? null : fields[key];
  return Array.isArray(held) ? held : [];
};

const groundedPatternOf = (held: unknown): GroundedPattern | null => {
  const fields = namedFieldsOf(held);
  const pattern = typeof fields?.pattern === "string" ? fields.pattern.trim() : "";
  if (pattern === "") return null;

  return {
    pattern,
    reason: typeof fields?.reason === "string" ? fields.reason.trim() : "",
  };
};

const groundedPatternsIn = (held: unknown): readonly GroundedPattern[] =>
  (Array.isArray(held) ? held : []).map(groundedPatternOf).filter((grounded) => grounded !== null);

const registrationOf = (held: unknown): ForbiddenTrackedPath | null => {
  const grounded = groundedPatternOf(held);
  if (grounded === null) return null;

  const fields = namedFieldsOf(held);
  return {
    ...grounded,
    ignoreListing: fields?.ignoreListing !== false,
    exceptions: groundedPatternsIn(fields?.exceptions),
  };
};

export const registeredTrackedPathsFrom = (
  options: Readonly<Options>,
): readonly ForbiddenTrackedPath[] => [
  ...DEFAULT_FORBIDDEN_TRACKED_PATHS,
  ...listedUnder(options, "forbidden")
    .map(registrationOf)
    .filter((registration) => registration !== null),
];

export const releasesFrom = (options: Readonly<Options>): readonly GroundedPattern[] =>
  groundedPatternsIn(listedUnder(options, "released"));

const RELEASABLE_PATTERNS: ReadonlySet<string> = new Set(
  DEFAULT_FORBIDDEN_TRACKED_PATHS.map((registration) => registration.pattern),
);

export const trackedPathsInForce = ({
  registered,
  releases,
}: {
  readonly registered: readonly ForbiddenTrackedPath[];
  readonly releases: readonly GroundedPattern[];
}): readonly ForbiddenTrackedPath[] => {
  const lifted = new Set(
    releases
      .filter((release) => release.reason !== "" && RELEASABLE_PATTERNS.has(release.pattern))
      .map((release) => release.pattern),
  );
  return registered.filter((registration) => !lifted.has(registration.pattern));
};

export const deadReleasesIn = (releases: readonly GroundedPattern[]): readonly GroundedPattern[] =>
  releases.filter((release) => !RELEASABLE_PATTERNS.has(release.pattern));
