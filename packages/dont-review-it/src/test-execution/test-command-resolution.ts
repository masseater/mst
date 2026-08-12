const SHELL_TOKEN = /(?:\\[\s\S]|"(?:\\[\s\S]|[^"\\])*"|'[^']*'|[^\s\\'";&|\n])+|&&|\|\||[;&|\n]/gu;

const COMMAND_SEPARATORS: ReadonlySet<string> = new Set(["&&", "||", ";", "&", "|", "\n"]);

const ENVIRONMENT_ASSIGNMENT = /^[A-Za-z_][A-Za-z\d_]*=/u;

const ENV_OPTIONS_WITH_VALUE: ReadonlySet<string> = new Set(["-C", "-P", "-u"]);

const NPX_OPTIONS_WITH_VALUE: ReadonlySet<string> = new Set([
  "--package",
  "--workspace",
  "-p",
  "-w",
]);

const NPX_BOOLEAN_OPTIONS: ReadonlySet<string> = new Set(["--no", "--yes", "-y"]);

const NPM_EXEC_OPTIONS_WITH_VALUE: ReadonlySet<string> = new Set([
  "--package",
  "--workspace",
  "-w",
]);

const NPM_EXEC_BOOLEAN_OPTIONS: ReadonlySet<string> = new Set([
  "--include-workspace-root",
  "--workspaces",
  "--yes",
]);

const VP_EXEC_OPTIONS_WITH_VALUE: ReadonlySet<string> = new Set([
  "--filter",
  "--resume-from",
  "-F",
]);

const VP_EXEC_BOOLEAN_OPTIONS: ReadonlySet<string> = new Set([
  "--fail-if-no-match",
  "--parallel",
  "--recursive",
  "--report-summary",
  "--reverse",
  "--transitive",
  "--workspace",
  "-r",
  "-t",
  "-w",
]);

const VP_RUN_OPTIONS_WITH_VALUE: ReadonlySet<string> = new Set([
  "--concurrency-limit",
  "--filter",
  "--log",
  "-F",
]);

const VP_RUN_BOOLEAN_OPTIONS: ReadonlySet<string> = new Set([
  "--cache",
  "--fail-if-no-match",
  "--ignore-depends-on",
  "--last-details",
  "--no-cache",
  "--parallel",
  "--recursive",
  "--transitive",
  "--verbose",
  "--workspace",
  "-h",
  "-r",
  "-t",
  "-v",
  "-w",
]);

const BENIGN_COMMANDS: ReadonlySet<string> = new Set(["echo", "printf", "true"]);

export type CommandResolution =
  | { readonly kind: "not-test" }
  | { readonly kind: "test"; readonly arguments: readonly string[] }
  | { readonly kind: "unresolved" };

type WrapperResolution =
  | { readonly kind: "resolved"; readonly command: readonly string[] }
  | { readonly kind: "unresolved" };

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

const splitEnvCommand = (source: string): readonly string[] | null => {
  const segments = commandSegmentsIn(source).filter((segment) => segment.length > 0);
  const [first, second] = segments;
  return first === undefined || second !== undefined ? null : first;
};

const envOptionWidth = (token: string): number => {
  if (ENVIRONMENT_ASSIGNMENT.test(token)) return 1;
  if (ENV_OPTIONS_WITH_VALUE.has(token)) return 2;
  return /^-C.+|^-P.+|^-u.+/u.test(token) || /^-[0iv]+$/u.test(token) ? 1 : 0;
};

const envSplitResolution = ({
  command,
  index,
  token,
}: {
  readonly command: readonly string[];
  readonly index: number;
  readonly token: string;
}): WrapperResolution => {
  const source = token === "-S" ? command[index + 1] : token.slice(2);
  const split = source === undefined ? null : splitEnvCommand(source);
  return split === null
    ? { kind: "unresolved" }
    : {
        kind: "resolved",
        command: [...split, ...command.slice(index + (token === "-S" ? 2 : 1))],
      };
};

const commandAfterEnvAt = (command: readonly string[], index: number): WrapperResolution => {
  const token = command[index];
  if (token === undefined) return { kind: "unresolved" };
  if (token === "--") return { kind: "resolved", command: command.slice(index + 1) };
  const optionWidth = envOptionWidth(token);
  if (optionWidth > 0) return commandAfterEnvAt(command, index + optionWidth);
  if (token === "-S" || token.startsWith("-S")) {
    return envSplitResolution({ command, index, token });
  }
  return token.startsWith("-")
    ? { kind: "unresolved" }
    : { kind: "resolved", command: command.slice(index) };
};

const commandIndexAfterCommandOptions = (
  command: readonly string[],
  index: number,
): number | null => {
  const token = command[index];
  if (token === "-p") return commandIndexAfterCommandOptions(command, index + 1);
  if (token === "--") return index + 1;
  return token?.startsWith("-") === true ? null : index;
};

const commandAfterCommand = (command: readonly string[]): WrapperResolution => {
  const index = commandIndexAfterCommandOptions(command, 1);
  return index === null
    ? { kind: "unresolved" }
    : { kind: "resolved", command: command.slice(index) };
};

const commandAfterExecAt = (command: readonly string[], index: number): WrapperResolution => {
  const token = command[index];
  if (token === undefined) return { kind: "unresolved" };
  if (token === "--") return { kind: "resolved", command: command.slice(index + 1) };
  if (token === "-a") return commandAfterExecAt(command, index + 2);
  if (/^-[cl]+$/u.test(token)) return commandAfterExecAt(command, index + 1);
  return token.startsWith("-")
    ? { kind: "unresolved" }
    : { kind: "resolved", command: command.slice(index) };
};

const transparentWrapperResolutionOf = (command: readonly string[]): WrapperResolution => {
  const name = executableName(command[0] ?? "");
  if (name === "env") return commandAfterEnvAt(command, 1);
  if (name === "command") return commandAfterCommand(command);
  if (name === "exec") return commandAfterExecAt(command, 1);
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
  if (resolution.kind === "unresolved" || resolution.command === command) return resolution;
  return transparentCommandAt(resolution.command, wrapperDepth + 1);
};

const transparentCommandIn = (segment: readonly string[]): WrapperResolution => {
  const commandIndex = segment.findIndex((token) => !ENVIRONMENT_ASSIGNMENT.test(token));
  return commandIndex === -1
    ? { kind: "unresolved" }
    : transparentCommandAt(segment.slice(commandIndex), 0);
};

const optionWithEquals = (token: string, options: ReadonlySet<string>): boolean =>
  [...options].some((option) => token.startsWith(`${option}=`));

const optionAdvance = ({
  token,
  optionsWithValue,
  booleanOptions,
}: {
  readonly token: string;
  readonly optionsWithValue: ReadonlySet<string>;
  readonly booleanOptions: ReadonlySet<string>;
}): number => {
  if (optionsWithValue.has(token)) return 2;
  return optionWithEquals(token, optionsWithValue) ||
    booleanOptions.has(token) ||
    optionWithEquals(token, booleanOptions)
    ? 1
    : 0;
};

const optionIndexIn = ({
  command,
  index,
  optionsWithValue,
  booleanOptions,
  shellOptions,
}: {
  readonly command: readonly string[];
  readonly index: number;
  readonly optionsWithValue: ReadonlySet<string>;
  readonly booleanOptions: ReadonlySet<string>;
  readonly shellOptions: ReadonlySet<string>;
}): { readonly kind: "resolved"; readonly index: number } | { readonly kind: "unresolved" } => {
  const token = command[index];
  if (token === undefined) return { kind: "resolved", index };
  if (token === "--") return { kind: "resolved", index: index + 1 };
  if (shellOptions.has(token) || optionWithEquals(token, shellOptions)) {
    return { kind: "unresolved" };
  }
  const advance = optionAdvance({ token, optionsWithValue, booleanOptions });
  if (advance > 0) {
    return advance === 2 && command[index + 1] === undefined
      ? { kind: "unresolved" }
      : optionIndexIn({
          command,
          index: index + advance,
          optionsWithValue,
          booleanOptions,
          shellOptions,
        });
  }
  return token.startsWith("-") ? { kind: "unresolved" } : { kind: "resolved", index };
};

const commandAfterOptionWrapper = ({
  command,
  start,
  optionsWithValue,
  booleanOptions,
  shellOptions,
}: {
  readonly command: readonly string[];
  readonly start: number;
  readonly optionsWithValue: ReadonlySet<string>;
  readonly booleanOptions: ReadonlySet<string>;
  readonly shellOptions: ReadonlySet<string>;
}): WrapperResolution => {
  const resolution = optionIndexIn({
    command,
    index: start,
    optionsWithValue,
    booleanOptions,
    shellOptions,
  });
  return resolution.kind === "unresolved"
    ? resolution
    : { kind: "resolved", command: command.slice(resolution.index) };
};

const commandAfterNpmExec = (command: readonly string[]): WrapperResolution => {
  const separatorIndex = command.indexOf("--", 2);
  const beforeSeparator = command.slice(2, separatorIndex === -1 ? command.length : separatorIndex);
  const wrapper = commandAfterOptionWrapper({
    command: ["npm-exec", ...beforeSeparator],
    start: 1,
    optionsWithValue: NPM_EXEC_OPTIONS_WITH_VALUE,
    booleanOptions: NPM_EXEC_BOOLEAN_OPTIONS,
    shellOptions: new Set(["--call", "-c"]),
  });
  const afterSeparator = separatorIndex === -1 ? [] : command.slice(separatorIndex + 1);
  if (wrapper.kind === "unresolved") return wrapper;
  const [executable, ...arguments_] = wrapper.command;
  if (executable === undefined) {
    return afterSeparator.length === 0
      ? { kind: "unresolved" }
      : { kind: "resolved", command: afterSeparator };
  }
  return {
    kind: "resolved",
    command: [executable, ...arguments_, ...afterSeparator],
  };
};

const commandAfterExecWrapper = (command: readonly string[]): WrapperResolution => {
  const name = executableName(command[0] ?? "");
  if (name === "npx") {
    return commandAfterOptionWrapper({
      command,
      start: 1,
      optionsWithValue: NPX_OPTIONS_WITH_VALUE,
      booleanOptions: NPX_BOOLEAN_OPTIONS,
      shellOptions: new Set(["--call", "-c"]),
    });
  }
  if (name === "pnpm" && command[1] === "exec") {
    return commandAfterOptionWrapper({
      command,
      start: 2,
      optionsWithValue: new Set(),
      booleanOptions: new Set(),
      shellOptions: new Set(),
    });
  }
  if (name === "npm" && (command[1] === "exec" || command[1] === "x")) {
    return commandAfterNpmExec(command);
  }
  if (name === "vp" && command[1] === "exec") {
    return commandAfterOptionWrapper({
      command,
      start: 2,
      optionsWithValue: VP_EXEC_OPTIONS_WITH_VALUE,
      booleanOptions: VP_EXEC_BOOLEAN_OPTIONS,
      shellOptions: new Set(["--shell-mode", "-c"]),
    });
  }
  return { kind: "resolved", command };
};

const vpRunResolution = (command: readonly string[]): CommandResolution => {
  const resolution = optionIndexIn({
    command,
    index: 2,
    optionsWithValue: VP_RUN_OPTIONS_WITH_VALUE,
    booleanOptions: VP_RUN_BOOLEAN_OPTIONS,
    shellOptions: new Set(),
  });
  if (resolution.kind === "unresolved") return resolution;
  const selector = command[resolution.index];
  if (selector === undefined) return { kind: "unresolved" };
  return taskSelectorIsTest(selector)
    ? { kind: "test", arguments: command.slice(resolution.index + 1) }
    : { kind: "not-test" };
};

const testResolutionForCommand = (command: readonly string[]): CommandResolution => {
  const executable = command[0];
  if (executable === undefined) return { kind: "unresolved" };
  const name = executableName(executable);
  if (name === "vitest" || name.startsWith("vitest@")) {
    return { kind: "test", arguments: command.slice(1) };
  }
  if (name === "vp" && command[1] === "test") {
    return { kind: "test", arguments: command.slice(2) };
  }
  if (name === "vp" && command[1] === "run") return vpRunResolution(command);
  return BENIGN_COMMANDS.has(name) || name === "vp" ? { kind: "not-test" } : { kind: "unresolved" };
};

const testCommandResolution = (segment: readonly string[]): CommandResolution => {
  const transparent = transparentCommandIn(segment);
  if (transparent.kind === "unresolved") return transparent;
  const wrapped = commandAfterExecWrapper(transparent.command);
  return wrapped.kind === "unresolved" ? wrapped : testResolutionForCommand(wrapped.command);
};

export const testCommandResolutionsIn = (command: string): readonly CommandResolution[] =>
  commandSegmentsIn(command)
    .filter((segment) => segment.length > 0)
    .map(testCommandResolution);
