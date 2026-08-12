const SEGMENT_SEPARATOR = /(\|\||&&|;|\||&|\n|\(|\))/u;

const SURROUNDING_QUOTES = /^["']+|["']+$/gu;

const ENVIRONMENT_BINDING = /^[A-Za-z_][A-Za-z0-9_]*=/u;

const FLAG_MARK = "-";

const RUN_TIME_SUBSTITUTION = /[$`]/u;

const ADDRESS_TOKEN = /^[a-z][a-z0-9+.-]*:\/\//iu;

const ADDRESS_ELEMENT_SEPARATOR = /[/@?]/u;

const VERSION_MARK = "@";

const PIPE = "|";

const RUNNER_PREFIXES: readonly (readonly string[])[] = [
  ["npx"],
  ["bunx"],
  ["npm", "exec"],
  ["pnpm", "dlx"],
  ["pnpm", "exec"],
  ["yarn", "dlx"],
  ["yarn", "exec"],
  ["bash", "-c"],
  ["sh", "-c"],
  ["zsh", "-c"],
];

const SHELL_EVALUATORS: ReadonlySet<string> = new Set([
  "bash",
  "dash",
  "ksh",
  "sh",
  "source",
  "zsh",
]);

const INLINE_EVALUATORS: ReadonlySet<string> = new Set(["eval"]);

type CommandSegment = {
  readonly tokens: readonly string[];
  readonly piped: boolean;
};

const tokensOf = (written: string): readonly string[] =>
  written
    .split(/\s+/u)
    .map((token) => token.replace(SURROUNDING_QUOTES, ""))
    .filter((token) => token !== "");

const segmentsOf = (line: string): readonly CommandSegment[] => {
  const parts = line.split(SEGMENT_SEPARATOR);
  return parts.flatMap((part, index) =>
    index % 2 === 0 ? [{ tokens: tokensOf(part), piped: parts[index - 1] === PIPE }] : [],
  );
};

const withoutLeadingFlags = (tokens: readonly string[]): readonly string[] => {
  const [head, ...rest] = tokens;
  return head?.startsWith(FLAG_MARK) === true ? withoutLeadingFlags(rest) : tokens;
};

const behindRunner = (tokens: readonly string[]): readonly string[] | null => {
  const prefix = RUNNER_PREFIXES.find((words) =>
    words.every((word, index) => tokens[index] === word),
  );
  return prefix === undefined ? null : withoutLeadingFlags(tokens.slice(prefix.length));
};

const invokedTokenOf = (tokens: readonly string[]): string | null => {
  const [head, ...rest] = tokens;
  if (head === undefined) return null;
  if (ENVIRONMENT_BINDING.test(head)) return invokedTokenOf(rest);

  const behind = behindRunner(tokens);
  return behind === null ? head : invokedTokenOf(behind);
};

const withoutVersion = (token: string): string => {
  const scoped = token.startsWith(VERSION_MARK);
  const marked = token.indexOf(VERSION_MARK, scoped ? 1 : 0);
  return marked <= 0 ? token : token.slice(0, marked);
};

const addressElementsOf = (token: string): readonly string[] =>
  ADDRESS_TOKEN.test(token)
    ? token.split(ADDRESS_ELEMENT_SEPARATOR).filter((held) => held !== "")
    : [];

const namesUnderSegment = (segment: CommandSegment): readonly string[] => {
  const invoked = invokedTokenOf(segment.tokens);
  const named =
    invoked === null || RUN_TIME_SUBSTITUTION.test(invoked) ? [] : [withoutVersion(invoked)];
  return [...named, ...segment.tokens.flatMap(addressElementsOf)];
};

export const namesRunner = (token: string): boolean =>
  RUNNER_PREFIXES.some(([head]) => head === token);

export const invokedNamesIn = (line: string): readonly string[] =>
  segmentsOf(line).flatMap(namesUnderSegment);

export const carriesUndecidedTarget = (line: string): boolean =>
  segmentsOf(line).some((segment) => {
    const invoked = invokedTokenOf(segment.tokens);
    if (invoked === null) return false;
    if (RUN_TIME_SUBSTITUTION.test(invoked)) return true;
    return INLINE_EVALUATORS.has(invoked) || (segment.piped && SHELL_EVALUATORS.has(invoked));
  });
