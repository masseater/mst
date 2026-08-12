import type { EngineKind } from "../config/engine.ts";
import type { Mode } from "../contract/vocabulary.ts";

const IDENTITY_SOURCES = ["override", "auto"] as const;

export type IdentitySource = (typeof IDENTITY_SOURCES)[number];

const TOKEN_SOURCES = ["github-cli", "environment-variable"] as const;

export type TokenSource = (typeof TOKEN_SOURCES)[number];

export type RunMetadata = {
  readonly mode: Mode;
  readonly engine: EngineKind;
  readonly engineCommand: string;
  readonly engineOverrideSource: "default" | "override";
  readonly ghUser: string;
  readonly ghUserSource: IdentitySource;
  readonly ghTokenSource: TokenSource;
  readonly concurrency: number;
  readonly dryRun: boolean;
  readonly dangerouslySkipPermissions: boolean;
  readonly targetPrs: readonly number[];
  readonly excludedPrs: readonly number[];
};

export const buildRunMetadata = (build: {
  readonly mode: Mode;
  readonly engine: EngineKind;
  readonly engineOverride?: string;
  readonly ghUser: string;
  readonly ghUserSource: IdentitySource;
  readonly ghTokenSource: TokenSource;
  readonly concurrency: number;
  readonly dryRun: boolean;
  readonly dangerouslySkipPermissions: boolean;
  readonly targetPrs: readonly number[];
  readonly excludedPrs: readonly number[];
}): RunMetadata => ({
  mode: build.mode,
  engine: build.engine,
  engineCommand: build.engineOverride ?? build.engine,
  engineOverrideSource: build.engineOverride === undefined ? "default" : "override",
  ghUser: build.ghUser,
  ghUserSource: build.ghUserSource,
  ghTokenSource: build.ghTokenSource,
  concurrency: build.concurrency,
  dryRun: build.dryRun,
  dangerouslySkipPermissions: build.dangerouslySkipPermissions,
  targetPrs: [...build.targetPrs],
  excludedPrs: [...build.excludedPrs],
});

export const runMetadataLogFields = (metadata: RunMetadata): Readonly<Record<string, unknown>> => ({
  mode: metadata.mode,
  engine: metadata.engine,
  engineCommand: metadata.engineCommand,
  engineOverrideSource: metadata.engineOverrideSource,
  ghUserSource: metadata.ghUserSource,
  ghTokenSource: metadata.ghTokenSource,
  concurrency: metadata.concurrency,
  dryRun: metadata.dryRun,
  dangerouslySkipPermissions: metadata.dangerouslySkipPermissions,
  targetPrs: metadata.targetPrs,
  excludedPrs: metadata.excludedPrs,
});
