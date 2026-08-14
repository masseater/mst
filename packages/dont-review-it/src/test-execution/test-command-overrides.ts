import { globSync } from "node:fs";
import { dirname, join } from "node:path";

import { defaultDependencyCatalogChecksConfig } from "../dependency-catalog/config.ts";
import { readWorkspaceManifests } from "../dependency-catalog/manifest-files.ts";
import { recordOf } from "../dependency-catalog/record-fields.ts";
import { parsedWorkspaceDefinitionOrNull } from "../dependency-catalog/workspace-definition.ts";
import { isFile, readTextFile } from "../lint/oxlint/lib/canonical-values/source-files.ts";
import { rootTestInvocationMessagesIn } from "./root-test-invocation.ts";
import { type CommandResolution, testCommandResolutionsIn } from "./test-command-resolution.ts";

import type { RepositoryProblem, ScannedProblems } from "@mst/repository-checks";

const CONFIG_OPTIONS: ReadonlySet<string> = new Set(["--config", "-c"]);

const BOOLEAN_OPTION_VALUES: ReadonlySet<string> = new Set(["false", "true"]);

const TEST_CONFIG_PATTERN = "{vite,vitest}.config.{js,cjs,mjs,ts,cts,mts}";

const TEST_LIFECYCLE_SCRIPT_NAMES = ["pretest", "posttest"] as const;

const configMessageFor = (scriptName: string): string =>
  `The ${scriptName} script must not select a test config with \`--config\` or \`-c\`. Remove that argument and merge the test settings into the auto-discovered \`vite.config\` or \`vitest.config\`, so lint and the coverage gate inspect the same source universe.`;

const coverageMessageFor = (scriptName: string): string =>
  `The ${scriptName} script must not override coverage settings or reduce the coverage source universe on the command line. Remove every \`--coverage.*\`, \`--coverage=...\`, \`--no-coverage\`, \`--changed\`, and \`--changed=...\` argument, and remove any \`true\` or \`false\` value after \`--coverage\`; only bare \`--coverage\` may enable the statically inspected coverage configuration.`;

const runnerArgumentMessageFor = (scriptName: string): string =>
  `The ${scriptName} script must not select a test subset, alternate root or project, non-run mode, or other runner behavior. Remove every test-runner argument except one optional bare \`--coverage\`, so the recursive guard runs the package's full auto-discovered suite and coverage source universe.`;

const uninspectableMessageFor = (scriptName: string): string =>
  `The ${scriptName} script must expose exactly one normal test run in the current package through one statically inspectable command. Replace shell control operators, delegation, expansion, environment changes, alternate roots or projects, non-run modes, arbitrary executable paths, and package-manager or Vite Plus exec wrappers with \`spool -- vp test\`. Only bare \`vp test\`, explicit \`vitest run\` or \`./node_modules/.bin/vitest run\`, and transparent \`env --\`, \`command --\`, \`exec --\`, or \`spool --\` wrappers preserve the inspected config and coverage source universe.`;

const lifecycleMessageFor = (scriptName: (typeof TEST_LIFECYCLE_SCRIPT_NAMES)[number]): string =>
  `The \`scripts.${scriptName}\` lifecycle entry must not run outside the statically inspected test command. Delete this entry and move the required setup or teardown into the auto-discovered Vite/Vitest config or the test implementation, so \`vp run ... test\` executes only \`scripts.test\`.`;

const missingTestEntryMessage =
  "A workspace that owns a Vite/Vitest test config must not omit `scripts.test`, because the recursive coverage gate would skip the workspace. Add `scripts.test` as a string containing exactly one directly invoked test runner, such as `spool -- vp test`.";

const nonStringTestEntryMessage =
  "A workspace that owns a Vite/Vitest test config must not declare `scripts.test` as a non-string value, because the recursive coverage gate cannot execute and inspect it. Replace the value with one string containing exactly one directly invoked test runner, such as `spool -- vp test`.";

const violationMessagesIn = (command: string, scriptName: string): readonly string[] => {
  const resolutions = testCommandResolutionsIn(command);
  const testCommands = resolutions.filter(
    (
      resolution,
    ): resolution is Extract<CommandResolution, { readonly kind: "test" | "unresolved-test" }> =>
      resolution.kind === "test" || resolution.kind === "unresolved-test",
  );
  const messages = testCommands.flatMap((resolution) => {
    const arguments_ = resolution.arguments ?? [];
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
    const runnerArguments =
      arguments_.length > 1 || (arguments_.length === 1 && arguments_[0] !== "--coverage");
    return [
      config ? configMessageFor(scriptName) : null,
      coverage ? coverageMessageFor(scriptName) : null,
      !config && !coverage && runnerArguments ? runnerArgumentMessageFor(scriptName) : null,
    ].filter((message): message is string => message !== null);
  });
  const [onlyResolution] = resolutions;
  const uninspectable = resolutions.length !== 1 || onlyResolution?.kind !== "test";
  return uninspectable ? [...messages, uninspectableMessageFor(scriptName)] : messages;
};

const packagePatternsIn = (source: string): readonly string[] | null => {
  const definition = parsedWorkspaceDefinitionOrNull({
    source,
    config: defaultDependencyCatalogChecksConfig,
  });
  return definition?.packagePatterns ?? null;
};

const problemFor = (relativePath: string, message: string): RepositoryProblem => ({
  file: relativePath,
  line: null,
  message,
});

const ownsTestConfig = ({
  repositoryRoot,
  relativePath,
  rootManifestFileName,
}: {
  readonly repositoryRoot: string;
  readonly relativePath: string;
  readonly rootManifestFileName: string;
}): boolean => {
  if (relativePath === rootManifestFileName) return false;
  const packageDirectory = join(repositoryRoot, dirname(relativePath));
  return globSync(TEST_CONFIG_PATTERN, { cwd: packageDirectory }).some((configPath) =>
    isFile(join(packageDirectory, configPath)),
  );
};

const problemsForManifest = ({
  repositoryRoot,
  relativePath,
  manifest,
  rootManifestFileName,
}: {
  readonly repositoryRoot: string;
  readonly relativePath: string;
  readonly manifest: unknown;
  readonly rootManifestFileName: string;
}): readonly RepositoryProblem[] => {
  const scripts = recordOf(recordOf(manifest).scripts);
  const testEntry = scripts.test;
  const rootGuardProblems =
    relativePath === rootManifestFileName &&
    (Object.hasOwn(scripts, "guard") || Object.hasOwn(scripts, "guard:all"))
      ? rootTestInvocationMessagesIn(scripts).map((message) => problemFor(relativePath, message))
      : [];
  const coverageTarget = ownsTestConfig({
    repositoryRoot,
    relativePath,
    rootManifestFileName,
  });
  const lifecycleProblems =
    typeof testEntry === "string" || coverageTarget
      ? TEST_LIFECYCLE_SCRIPT_NAMES.flatMap((scriptName) =>
          Object.hasOwn(scripts, scriptName)
            ? [problemFor(relativePath, lifecycleMessageFor(scriptName))]
            : [],
        )
      : [];
  if (typeof testEntry === "string") {
    return [
      ...rootGuardProblems,
      ...lifecycleProblems,
      ...violationMessagesIn(testEntry, "test").map((message) => problemFor(relativePath, message)),
    ];
  }
  if (!coverageTarget) return [...rootGuardProblems, ...lifecycleProblems];
  const entryMessage = Object.hasOwn(scripts, "test")
    ? nonStringTestEntryMessage
    : missingTestEntryMessage;
  return [...rootGuardProblems, ...lifecycleProblems, problemFor(relativePath, entryMessage)];
};

export const testCommandOverrideProblems = (repositoryRoot: string): ScannedProblems => {
  const config = defaultDependencyCatalogChecksConfig;
  const source = readTextFile(join(repositoryRoot, config.workspaceDefinitionFileName));
  const packagePatterns = source === null ? [] : (packagePatternsIn(source) ?? []);
  const manifests = readWorkspaceManifests({ repositoryRoot, packagePatterns, config });

  return {
    problems: manifests.flatMap(({ relativePath, manifest }) =>
      problemsForManifest({
        repositoryRoot,
        relativePath,
        manifest,
        rootManifestFileName: config.manifestFileName,
      }),
    ),
    scanned: manifests.length,
  };
};

export const formatTestCommandOverrideProblem = ({ file, message }: RepositoryProblem): string =>
  `${file} ${message}`;
