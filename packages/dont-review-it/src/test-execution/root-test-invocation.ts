import { isEqual } from "es-toolkit";

import { shellCommandSegmentsIn, type ShellCommandSegment } from "./shell-command-segments.ts";

const ROOT_GUARD_COMMAND = [
  "throttle",
  "--timeout",
  "1800",
  "--",
  "spool",
  "--",
  "vp",
  "run",
  "guard:all",
] as const;

const ROOT_TEST_COMMAND = [
  "vp",
  "run",
  "-r",
  "--concurrency-limit",
  "1",
  "test",
  "--coverage",
  "--maxWorkers",
  "2",
] as const;

const ROOT_GUARD_MESSAGE =
  "The root `guard` script must not append commands or arguments to, wrap differently, or bypass the designated `guard:all` entry. Replace its complete value with `throttle --timeout 1800 -- spool -- vp run guard:all`, so the wrapper encloses every gate exactly once.";

const GUARD_ALL_CHAIN_MESSAGE =
  "The root `guard:all` script must not use expansion or shell control flow that can skip, background, pipe, or hide a gate. Keep every command statically inspectable, join nonempty stages only with `&&`, and leave no trailing operator.";

const ROOT_TEST_COMMAND_MESSAGE =
  "The root `guard:all` script must not omit, delegate, duplicate, or alter the recursive test gate. Keep exactly one `vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2` stage; only `--coverage` and `--maxWorkers 2` may be forwarded to each package test script.";

const singleStaticCommandEquals = (source: string, expected: readonly string[]): boolean => {
  const segments = shellCommandSegmentsIn(source);
  const segment = segments[0];
  if (segments.length !== 1 || segment === undefined) return false;
  return (
    !segment.hasRedirection &&
    segment.terminator === null &&
    segment.staticallyInspectable &&
    isEqual(segment.command, expected)
  );
};

const isStaticAndChain = (segments: readonly ShellCommandSegment[]): boolean =>
  segments.length > 0 &&
  segments.every(
    (segment, index) =>
      segment.command.length > 0 &&
      segment.staticallyInspectable &&
      segment.terminator === (index === segments.length - 1 ? null : "&&"),
  );

const isTestTaskSpecifier = (token: string): boolean => {
  const taskName = token.slice(token.lastIndexOf("#") + 1);
  return taskName === "test" || taskName.startsWith("test:");
};

const PACKAGE_MANAGERS: ReadonlySet<string> = new Set(["bun", "npm", "pnpm", "yarn"]);

const SHELLS: ReadonlySet<string> = new Set(["bash", "dash", "fish", "ksh", "sh", "zsh"]);

const executableBaseName = (token: string): string => token.replace(/^.*[\\/]/u, "");

const executableMatches = (executable: string, name: string): boolean =>
  executable === name || executable.startsWith(`${name}@`);

const argumentsBeforeDoubleDash = (arguments_: readonly string[]): readonly string[] => {
  const doubleDashIndex = arguments_.indexOf("--");
  return doubleDashIndex === -1 ? arguments_ : arguments_.slice(0, doubleDashIndex);
};

const hasStringExecutionOption = (arguments_: readonly string[]): boolean =>
  argumentsBeforeDoubleDash(arguments_).some(
    (argument) =>
      argument === "-c" ||
      argument.startsWith("-c=") ||
      argument.startsWith("--call=") ||
      argument === "--call",
  );

const hasShellStringExecutionOption = (arguments_: readonly string[]): boolean =>
  argumentsBeforeDoubleDash(arguments_).some(
    (argument) =>
      (argument.startsWith("-") && !argument.startsWith("--") && argument.slice(1).includes("c")) ||
      argument === "--command" ||
      argument.startsWith("--command="),
  );

const isOpaqueStringInvocation = (
  executableName: string,
  arguments_: readonly string[],
): boolean => {
  if (SHELLS.has(executableName)) return hasShellStringExecutionOption(arguments_);
  if (executableMatches(executableName, "npx")) return hasStringExecutionOption(arguments_);
  if (!executableMatches(executableName, "npm")) return false;
  const inspectableArguments = argumentsBeforeDoubleDash(arguments_);
  const subcommandIndex = inspectableArguments.findIndex(
    (argument) => argument === "exec" || argument === "x",
  );
  return (
    subcommandIndex !== -1 &&
    hasStringExecutionOption(inspectableArguments.slice(subcommandIndex + 1))
  );
};

const isPackageManagerTestInvocation = (
  executableName: string,
  arguments_: readonly string[],
): boolean =>
  [...PACKAGE_MANAGERS].some((name) => executableMatches(executableName, name)) &&
  arguments_.some(isTestTaskSpecifier);

const isVitePlusTestInvocation = (executableName: string, arguments_: readonly string[]): boolean =>
  executableMatches(executableName, "vp") &&
  (arguments_[0] === "test" ||
    (arguments_[0] === "run" && arguments_.slice(1).some(isTestTaskSpecifier)));

const startsTestInvocationAt = (executable: string, arguments_: readonly string[]): boolean => {
  const executableName = executableBaseName(executable);
  return (
    executableMatches(executableName, "vitest") ||
    isOpaqueStringInvocation(executableName, arguments_) ||
    isPackageManagerTestInvocation(executableName, arguments_) ||
    isVitePlusTestInvocation(executableName, arguments_)
  );
};

const containsTestInvocation = (command: readonly string[]): boolean =>
  command.some((executable, index) => startsTestInvocationAt(executable, command.slice(index + 1)));

const rootGuardMessagesIn = (scripts: Readonly<Record<string, unknown>>): readonly string[] => {
  const guard = scripts.guard;
  return typeof guard === "string" && singleStaticCommandEquals(guard, ROOT_GUARD_COMMAND)
    ? []
    : [ROOT_GUARD_MESSAGE];
};

const guardAllMessagesIn = (scripts: Readonly<Record<string, unknown>>): readonly string[] => {
  const guardAll = scripts["guard:all"];
  if (typeof guardAll !== "string") return [ROOT_TEST_COMMAND_MESSAGE];
  const segments = shellCommandSegmentsIn(guardAll);
  const chainMessages = isStaticAndChain(segments) ? [] : [GUARD_ALL_CHAIN_MESSAGE];
  const testCommands = segments.filter(({ command }) => containsTestInvocation(command));
  const canonicalCommands = testCommands.filter(
    ({ command, hasRedirection }) => !hasRedirection && isEqual(command, ROOT_TEST_COMMAND),
  );
  const invocationMessages =
    testCommands.length === 1 && canonicalCommands.length === 1 ? [] : [ROOT_TEST_COMMAND_MESSAGE];
  return [...chainMessages, ...invocationMessages];
};

export const rootTestInvocationMessagesIn = (
  scripts: Readonly<Record<string, unknown>>,
): readonly string[] => [...rootGuardMessagesIn(scripts), ...guardAllMessagesIn(scripts)];
