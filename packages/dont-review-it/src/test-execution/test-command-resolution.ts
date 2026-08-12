import { shellCommandSegmentsIn } from "./shell-command-segments.ts";

const ENVIRONMENT_ASSIGNMENT = /^[A-Za-z_][A-Za-z\d_]*=/u;

const BENIGN_COMMANDS: ReadonlySet<string> = new Set(["echo", "printf", "true"]);

export type CommandResolution =
  | { readonly kind: "not-test" }
  | { readonly kind: "test"; readonly arguments: readonly string[] }
  | { readonly kind: "unresolved" }
  | { readonly kind: "unresolved-test"; readonly arguments?: readonly string[] };

type WrapperResolution =
  | { readonly kind: "resolved"; readonly command: readonly string[] }
  | { readonly kind: "unresolved" }
  | { readonly kind: "unresolved-test" };

const executableName = (token: string): string | null => {
  if (token === "./node_modules/.bin/vitest") return "vitest";
  return token.includes("/") || token.includes("\\") ? null : token;
};

const commandAfterEnvAt = (command: readonly string[], index: number): WrapperResolution => {
  const token = command[index];
  if (token === undefined) return { kind: "unresolved" };
  if (token === "--") return { kind: "resolved", command: command.slice(index + 1) };
  return token.startsWith("-") || ENVIRONMENT_ASSIGNMENT.test(token)
    ? { kind: "unresolved-test" }
    : { kind: "resolved", command: command.slice(index) };
};

const commandAfterSimpleWrapper = (command: readonly string[]): WrapperResolution => {
  const token = command[1];
  if (token === undefined) return { kind: "unresolved" };
  if (token === "--") return { kind: "resolved", command: command.slice(2) };
  return token.startsWith("-")
    ? { kind: "unresolved-test" }
    : { kind: "resolved", command: command.slice(1) };
};

const transparentWrapperResolutionOf = (command: readonly string[]): WrapperResolution => {
  const name = executableName(command[0] ?? "");
  if (name === null) return { kind: "unresolved" };
  if (name === "env") return commandAfterEnvAt(command, 1);
  if (name === "command" || name === "exec") return commandAfterSimpleWrapper(command);
  if (name !== "spool") return { kind: "resolved", command };
  return command[1] === "--"
    ? { kind: "resolved", command: command.slice(2) }
    : { kind: "unresolved" };
};

const transparentCommandAt = (
  command: readonly string[],
  wrapperDepth: number,
): WrapperResolution => {
  if (wrapperDepth >= 8) return { kind: "unresolved" };
  const resolution = transparentWrapperResolutionOf(command);
  if (resolution.kind !== "resolved" || resolution.command === command) return resolution;
  return transparentCommandAt(resolution.command, wrapperDepth + 1);
};

const transparentCommandIn = (segment: readonly string[]): WrapperResolution => {
  const first = String(segment[0]);
  return ENVIRONMENT_ASSIGNMENT.test(first)
    ? { kind: "unresolved-test" }
    : transparentCommandAt(segment, 0);
};

const runnerArgumentsResolution = (arguments_: readonly string[]): CommandResolution => {
  const [first, ...rest] = arguments_;
  const normalized = first === "run" ? rest : arguments_;
  return { kind: "test", arguments: normalized };
};

const vitestRunArgumentsResolution = (arguments_: readonly string[]): CommandResolution => {
  const [first, ...rest] = arguments_;
  return first === "run" ? { kind: "test", arguments: rest } : { kind: "unresolved-test" };
};

const testResolutionForCommand = (command: readonly string[]): CommandResolution => {
  const executable = command[0];
  if (executable === undefined) return { kind: "unresolved" };
  const name = executable === "./node_modules/.bin/vitest" ? "vitest" : executable;
  if (name === "vitest") {
    return vitestRunArgumentsResolution(command.slice(1));
  }
  if (name === "vp" && command[1] === "test") {
    return runnerArgumentsResolution(command.slice(2));
  }
  if (name === "vp" && command[1] === "run") return { kind: "unresolved-test" };
  return BENIGN_COMMANDS.has(name) || name === "vp" ? { kind: "not-test" } : { kind: "unresolved" };
};

const testCommandResolution = (segment: readonly string[]): CommandResolution => {
  const transparent = transparentCommandIn(segment);
  if (transparent.kind !== "resolved") return transparent;
  return testResolutionForCommand(transparent.command);
};

const unresolvedSegmentResolution = (command: readonly string[]): CommandResolution => {
  const tentative = testCommandResolution(command);
  if (tentative.kind === "test" || tentative.kind === "unresolved-test") {
    return {
      kind: "unresolved-test",
      ...(tentative.arguments === undefined ? {} : { arguments: tentative.arguments }),
    };
  }
  return tentative.kind === "not-test" ? tentative : { kind: "unresolved" };
};

export const testCommandResolutionsIn = (command: string): readonly CommandResolution[] =>
  shellCommandSegmentsIn(command)
    .filter((segment) => segment.command.length > 0 || segment.terminated)
    .map((segment) =>
      segment.terminated
        ? { kind: "unresolved-test" }
        : segment.staticallyInspectable
          ? testCommandResolution(segment.command)
          : unresolvedSegmentResolution(segment.command),
    );
