import { join } from "node:path";

import { attempt } from "es-toolkit";

import { defaultDependencyCatalogChecksConfig } from "../dependency-catalog/config.ts";
import { readWorkspaceManifests } from "../dependency-catalog/manifest-files.ts";
import { recordOf, stringEntriesOf } from "../dependency-catalog/record-fields.ts";
import { parseWorkspaceDefinition } from "../dependency-catalog/workspace-definition.ts";
import { readTextFile } from "../lint/oxlint/lib/canonical-values/source-files.ts";

import type { RepositoryProblem } from "@mst/utils";

const SHELL_TOKEN = /(?:\\[\s\S]|"(?:\\[\s\S]|[^"\\])*"|'[^']*'|[^\s\\'";&|\n])+|&&|\|\||[;&|\n]/gu;

const COMMAND_SEPARATORS: ReadonlySet<string> = new Set(["&&", "||", ";", "&", "|", "\n"]);

const CONFIG_OPTIONS: ReadonlySet<string> = new Set(["--config", "-c"]);

const ENVIRONMENT_ASSIGNMENT = /^[A-Za-z_][A-Za-z\d_]*=/u;

const shellTokenValue = (token: string): string =>
  token.replaceAll(/\\([\s\S])/gu, "$1").replaceAll(/["']/gu, "");

const commandSegmentsIn = (source: string): readonly (readonly string[])[] => {
  const tokens = [...source.matchAll(SHELL_TOKEN)].map(([token]) => token);
  const segments = tokens.reduce<{
    readonly complete: readonly (readonly string[])[];
    readonly current: readonly string[];
  }>(
    (state, token) =>
      COMMAND_SEPARATORS.has(token)
        ? { complete: [...state.complete, state.current], current: [] }
        : { complete: state.complete, current: [...state.current, shellTokenValue(token)] },
    { complete: [], current: [] },
  );
  return [...segments.complete, segments.current];
};

const executableName = (token: string): string => token.replace(/^.*[\\/]/u, "");

const taskSelectorIsTest = (token: string): boolean => /(?:^|#)test$/u.test(token);

const commandIn = (segment: readonly string[]): readonly string[] => {
  const commandIndex = segment.findIndex((token) => !ENVIRONMENT_ASSIGNMENT.test(token));
  return commandIndex === -1 ? [] : segment.slice(commandIndex);
};

const testArgumentsIn = (segment: readonly string[]): readonly string[] | null => {
  const command = commandIn(segment);
  const executable = command[0];
  if (executable === undefined) return null;
  const name = executableName(executable);
  if (name === "vitest") return command.slice(1);
  if (name === "vp" && command[1] === "test") return command.slice(2);
  if (name !== "vp" || command[1] !== "run") return null;
  const selectorIndex = command.findIndex(
    (token, index) => index >= 2 && taskSelectorIsTest(token),
  );
  return selectorIndex === -1 ? null : command.slice(selectorIndex + 1);
};

const effectiveOptionsIn = (arguments_: readonly string[]): readonly string[] => {
  const separatorIndex = arguments_.indexOf("--");
  return separatorIndex === -1 ? arguments_ : arguments_.slice(0, separatorIndex);
};

const configMessageFor = (scriptName: string): string =>
  `The ${scriptName} script must not select a test config with \`--config\` or \`-c\`. Remove that argument and merge the test settings into the auto-discovered \`vite.config\` or \`vitest.config\`, so lint and the coverage gate inspect the same source universe.`;

const coverageMessageFor = (scriptName: string): string =>
  `The ${scriptName} script must not override coverage settings on the command line. Remove every \`--coverage.*\` and \`--coverage=...\` argument; only bare \`--coverage\` may enable the statically inspected coverage configuration.`;

const violationMessagesIn = (command: string, scriptName: string): readonly string[] =>
  commandSegmentsIn(command).flatMap((segment) => {
    const arguments_ = testArgumentsIn(segment);
    if (arguments_ === null) return [];
    const options = effectiveOptionsIn(arguments_);
    const config = options.some(
      (option) => CONFIG_OPTIONS.has(option) || /^(?:--config|-c)=/u.test(option),
    );
    const coverage = options.some(
      (option) => option.startsWith("--coverage.") || option.startsWith("--coverage="),
    );
    return [
      config ? configMessageFor(scriptName) : null,
      coverage ? coverageMessageFor(scriptName) : null,
    ].filter((message): message is string => message !== null);
  });

const packagePatternsIn = (source: string): readonly string[] | null => {
  const [failure, definition] = attempt(() =>
    parseWorkspaceDefinition({ source, config: defaultDependencyCatalogChecksConfig }),
  );
  return failure === null && definition !== null ? definition.packagePatterns : null;
};

const problemsForManifest = ({
  relativePath,
  manifest,
}: {
  readonly relativePath: string;
  readonly manifest: unknown;
}): readonly RepositoryProblem[] =>
  stringEntriesOf(recordOf(manifest).scripts).flatMap(([scriptName, command]) =>
    violationMessagesIn(command, scriptName).map((message) => ({
      file: relativePath,
      line: null,
      message,
    })),
  );

export const testCommandOverrideProblems = (
  repositoryRoot: string,
): readonly RepositoryProblem[] => {
  const config = defaultDependencyCatalogChecksConfig;
  const source = readTextFile(join(repositoryRoot, config.workspaceDefinitionFileName));
  const packagePatterns = source === null ? [] : (packagePatternsIn(source) ?? []);

  return readWorkspaceManifests({ repositoryRoot, packagePatterns, config }).flatMap(
    problemsForManifest,
  );
};

export const formatTestCommandOverrideProblem = ({ file, message }: RepositoryProblem): string =>
  `${file} ${message}`;
