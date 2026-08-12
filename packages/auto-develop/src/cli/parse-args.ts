export const COMMANDS = [
  "reviewer",
  "author",
  "prepare-review",
  "prepare-author",
  "build-pr-context",
] as const;

export type Command = (typeof COMMANDS)[number];

export type ParsedArgs = {
  readonly command: Command;
  readonly flags: Readonly<Record<string, string | boolean>>;
};

export type ParseFailure = {
  readonly message: string;
};

const isCommand = (candidate: string): candidate is Command =>
  (COMMANDS as readonly string[]).includes(candidate);

const flagPairs = (tokens: readonly string[]): Readonly<Record<string, string | boolean>> =>
  Object.fromEntries(
    tokens.flatMap((token, index) => {
      if (!token.startsWith("--")) return [];
      const name = token.slice(2);
      const next = tokens[index + 1];
      const flagValue = next === undefined || next.startsWith("--") ? true : next;
      return [[name, flagValue]];
    }),
  );

export const parseArgs = (argv: readonly string[]): ParsedArgs | ParseFailure => {
  const [command, ...rest] = argv;
  if (command === undefined) return { message: "a command is required" };
  if (!isCommand(command)) return { message: `unknown command "${command}"` };
  return { command, flags: flagPairs(rest) };
};

export const isParseFailure = (parsed: ParsedArgs | ParseFailure): parsed is ParseFailure =>
  Object.hasOwn(parsed, "message");

export const numberFlag = (read: {
  readonly flags: Readonly<Record<string, string | boolean>>;
  readonly name: string;
}): number | null => {
  const raw = read.flags[read.name];
  if (typeof raw !== "string") return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const stringFlag = (read: {
  readonly flags: Readonly<Record<string, string | boolean>>;
  readonly name: string;
}): string | null => {
  const raw = read.flags[read.name];
  return typeof raw === "string" && raw !== "" ? raw : null;
};
