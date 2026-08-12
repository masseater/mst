import { join } from "node:path";

import { attempt } from "es-toolkit";

import { defaultDependencyCatalogChecksConfig } from "../dependency-catalog/config.ts";
import { readWorkspaceManifests } from "../dependency-catalog/manifest-files.ts";
import { recordOf, stringEntriesOf } from "../dependency-catalog/record-fields.ts";
import { parseWorkspaceDefinition } from "../dependency-catalog/workspace-definition.ts";
import { readTextFile } from "../lint/oxlint/lib/canonical-values/source-files.ts";
import { type CommandResolution, testCommandResolutionsIn } from "./test-command-resolution.ts";

import type { RepositoryProblem } from "@mst/repository-checks";

const CONFIG_OPTIONS: ReadonlySet<string> = new Set(["--config", "-c"]);

const BOOLEAN_OPTION_VALUES: ReadonlySet<string> = new Set(["false", "true"]);

const configMessageFor = (scriptName: string): string =>
  `The ${scriptName} script must not select a test config with \`--config\` or \`-c\`. Remove that argument and merge the test settings into the auto-discovered \`vite.config\` or \`vitest.config\`, so lint and the coverage gate inspect the same source universe.`;

const coverageMessageFor = (scriptName: string): string =>
  `The ${scriptName} script must not override coverage settings or reduce the coverage source universe on the command line. Remove every \`--coverage.*\`, \`--coverage=...\`, \`--no-coverage\`, \`--changed\`, and \`--changed=...\` argument, and remove any \`true\` or \`false\` value after \`--coverage\`; only bare \`--coverage\` may enable the statically inspected coverage configuration.`;

const uninspectableMessageFor = (scriptName: string): string =>
  `The ${scriptName} script must expose its test runner through a statically inspectable command. Replace shell or call mode and unknown wrappers with bare \`vp test\`, or use transparent \`env\`, \`command\`, \`exec\`, \`spool --\`, \`npx\`, \`pnpm exec\`, \`npm exec\`, or \`vp exec\` invocation so config and coverage arguments can be inspected.`;

const violationMessagesIn = (command: string, scriptName: string): readonly string[] => {
  const resolutions = testCommandResolutionsIn(command);
  const testCommands = resolutions.filter(
    (resolution): resolution is Extract<CommandResolution, { readonly kind: "test" }> =>
      resolution.kind === "test",
  );
  const messages = testCommands.flatMap(({ arguments: arguments_ }) => {
    const config = arguments_.some(
      (option) => CONFIG_OPTIONS.has(option) || /^(?:--config|-c)=/u.test(option),
    );
    const coverage = arguments_.some(
      (option, index) =>
        option === "--no-coverage" ||
        option === "--changed" ||
        option.startsWith("--changed=") ||
        option.startsWith("--coverage.") ||
        option.startsWith("--coverage=") ||
        (option === "--coverage" && BOOLEAN_OPTION_VALUES.has(arguments_[index + 1] ?? "")),
    );
    return [
      config ? configMessageFor(scriptName) : null,
      coverage ? coverageMessageFor(scriptName) : null,
    ].filter((message): message is string => message !== null);
  });
  const uninspectable =
    scriptName === "test" &&
    (testCommands.length === 0 ||
      resolutions.some((resolution) => resolution.kind === "unresolved"));
  return uninspectable ? [...messages, uninspectableMessageFor(scriptName)] : messages;
};

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
