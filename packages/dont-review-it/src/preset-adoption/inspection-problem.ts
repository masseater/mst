import type { RepositoryProblem } from "@mst/repository-checks";
import type { PresetAdoptionConfig } from "./config.ts";

export const lineAt = ({
  source,
  start,
}: {
  readonly source: string;
  readonly start: number;
}): number => source.slice(0, start).split("\n").length;

export const problemAt = ({
  source,
  start,
  config,
  message,
}: {
  readonly source: string;
  readonly start: number;
  readonly config: PresetAdoptionConfig;
  readonly message: string;
}): RepositoryProblem => ({
  file: config.toolchainConfigFileName,
  line: lineAt({ source, start }),
  message,
});
