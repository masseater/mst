import { dirname, join } from "node:path";

import { parseSync } from "oxc-parser";

import {
  listRepositoryFiles,
  readTextFile,
} from "../lint/oxlint/lib/canonical-values/source-files.ts";
import { defaultExportedValue, unwrappedCall, valueAt } from "../lint/oxlint/lib/config-object.ts";

import type { RepositoryProblem, ScannedProblems } from "@mst/repository-checks";
import type { TelemetryWiringConfig } from "./config.ts";

const configDirectoriesIn = (repositoryRoot: string): readonly string[] =>
  listRepositoryFiles(repositoryRoot)
    .manifests.map((manifest) => dirname(manifest.relativePath))
    .toSorted();

const declaredAt = ({
  held,
  path,
}: {
  readonly held: unknown;
  readonly path: readonly string[];
}): boolean =>
  path.length === 0
    ? held !== null
    : declaredAt({ held: valueAt({ held, key: path[0] as string }), path: path.slice(1) });

const problemsIn = ({
  relativePath,
  source,
  config,
}: {
  readonly relativePath: string;
  readonly source: string;
  readonly config: TelemetryWiringConfig;
}): readonly RepositoryProblem[] => {
  const measured = unwrappedCall(
    valueAt({
      held: defaultExportedValue(parseSync(relativePath, source).program),
      key: config.measuredBlockFieldName,
    }),
  );
  if (measured === null) return [];
  if (declaredAt({ held: measured, path: config.wiringFieldPath })) return [];

  return [
    {
      file: relativePath,
      line: 1,
      message: `A ${config.measuredBlockFieldName} block must not run without telemetry, because a workspace nobody measures is indistinguishable from a workspace that is fast. Declare ${config.wiringFieldPath.join(".")} in this block.`,
    },
  ];
};

export const runTelemetryWiringChecks = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: TelemetryWiringConfig;
}): ScannedProblems => {
  const directories = configDirectoriesIn(repositoryRoot);

  return {
    problems: directories.flatMap((directory) => {
      const relativePath = join(directory, config.toolchainConfigFileName);
      const source = readTextFile(join(repositoryRoot, relativePath));
      return source === null ? [] : problemsIn({ relativePath, source, config });
    }),
    scanned: directories.length,
  };
};
