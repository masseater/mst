const SHELL_TOKEN =
  /(?:\d*(?:<<<|>>|<<|<>|>\||>&|<&|>|<)|&>>?)|(?:\\[\s\S]|"(?:\\[\s\S]|[^"\\])*"|'[^']*'|[^ \t\\'";&|<>\n])+|&&|\|\||[;&|\n]/gu;

const COMMAND_SEPARATORS: ReadonlySet<string> = new Set(["&&", "||", ";", "&", "|", "\n"]);

const REDIRECTION = /^(?:\d*(?:<<<|>>|<<|<>|>\||>&|<&|>|<)|&>>?)$/u;

type ShellCommandSegment = {
  readonly command: readonly string[];
  readonly terminated: boolean;
  readonly staticallyInspectable: boolean;
};

type ShellToken = {
  readonly end: number;
  readonly joinedToPrevious: boolean;
  readonly raw: string;
  readonly leadingSyntaxIsStatic: boolean;
};

type WordState = {
  readonly braceDepth: number;
  readonly executesCommands: boolean;
  readonly index: number;
  readonly quote: "double" | "single" | null;
  readonly staticallyInspectable: boolean;
  readonly value: string;
};

type SegmentState = ShellCommandSegment & {
  readonly expectsRedirectionTarget: boolean;
};

type ParserState = {
  readonly complete: readonly ShellCommandSegment[];
  readonly current: SegmentState;
};

type LexicalState = {
  readonly commenting: boolean;
  readonly index: number;
  readonly quote: "double" | "single" | null;
  readonly source: string;
  readonly wordStarted: boolean;
};

const staticGap = (gap: string): boolean => /^[ \t]*$/u.test(gap);

const lexicalStateAfterCommentCharacter = (state: LexicalState, character: string): LexicalState =>
  character === "\n"
    ? {
        ...state,
        commenting: false,
        index: state.index + 1,
        source: `${state.source}\n`,
        wordStarted: false,
      }
    : { ...state, index: state.index + 1 };

const quoteAfter = (quote: LexicalState["quote"], character: string): LexicalState["quote"] => {
  if (character === "'" && quote !== "double") return quote === "single" ? null : "single";
  if (character === '"' && quote !== "single") return quote === "double" ? null : "double";
  return quote;
};

const lexicalStateAfterBackslash = (input: string, state: LexicalState): LexicalState => {
  const next = input.charAt(state.index + 1);
  return next === "\n"
    ? { ...state, index: state.index + 2 }
    : {
        ...state,
        index: Math.min(input.length, state.index + 2),
        source: `${state.source}\\${next}`,
        wordStarted: true,
      };
};

const lexicalStateAfterPlainCharacter = (state: LexicalState, character: string): LexicalState => {
  const quote = quoteAfter(state.quote, character);
  const delimiter = quote === null && /[ \t\n;&|<>]/u.test(character);
  return {
    ...state,
    index: state.index + 1,
    quote,
    source: `${state.source}${character}`,
    wordStarted: delimiter ? false : state.wordStarted || !/[ \t\n]/u.test(character),
  };
};

const lexicalStateAfterCharacter = (input: string, state: LexicalState): LexicalState => {
  const character = input.charAt(state.index);
  if (state.commenting) return lexicalStateAfterCommentCharacter(state, character);
  if (state.quote !== "single" && character === "\\") {
    return lexicalStateAfterBackslash(input, state);
  }
  if (state.quote === null && character === "#" && !state.wordStarted) {
    return { ...state, commenting: true, index: state.index + 1 };
  }
  return lexicalStateAfterPlainCharacter(state, character);
};

const lexicallyNormalizedSource = (source: string): string =>
  Array.from({ length: source.length + 1 }).reduce<LexicalState>(
    (state) => (state.index < source.length ? lexicalStateAfterCharacter(source, state) : state),
    { commenting: false, index: 0, quote: null, source: "", wordStarted: false },
  ).source;

const tokensIn = (source: string): readonly ShellToken[] => {
  const matches = Array.from(source.matchAll(SHELL_TOKEN));
  return matches.map((match, index) => {
    const previous = matches[index - 1];
    const previousEnd = previous === undefined ? 0 : previous.index + previous[0].length;
    return {
      end: match.index + match[0].length,
      joinedToPrevious: match.index === previousEnd,
      raw: match[0],
      leadingSyntaxIsStatic: staticGap(source.slice(previousEnd, match.index)),
    };
  });
};

const staticExpansionCharacter = (character: string): boolean =>
  !["$", "`", "*", "?", "[", "(", ")", "~"].includes(character);

const doubleQuotedEscape = (character: string): boolean =>
  ["$", "`", '"', "\\"].includes(character);

const wordAfterBackslash = (source: string, state: WordState): WordState => {
  const next = source.charAt(state.index + 1);
  if (state.quote === "double" && !doubleQuotedEscape(next)) {
    return { ...state, index: state.index + 2, value: `${state.value}\\${next}` };
  }
  return { ...state, index: state.index + 2, value: `${state.value}${next}` };
};

const wordAfterQuote = (state: WordState, quote: "double" | "single"): WordState => ({
  ...state,
  index: state.index + 1,
  quote: state.quote === quote ? null : quote,
});

const wordAfterSingleQuotedCharacter = (state: WordState, character: string): WordState =>
  character === "'"
    ? wordAfterQuote(state, "single")
    : { ...state, index: state.index + 1, value: `${state.value}${character}` };

const wordCharacterIsStatic = ({
  source,
  state,
  character,
}: {
  readonly source: string;
  readonly state: WordState;
  readonly character: string;
}): boolean =>
  state.quote === "double"
    ? character !== "$" && character !== "`"
    : staticExpansionCharacter(character) &&
      !(state.braceDepth > 0 && (character === "," || source.startsWith("..", state.index)));

const braceDepthAfter = (state: WordState, character: string): number => {
  if (state.quote !== null) return state.braceDepth;
  if (character === "{") return state.braceDepth + 1;
  return character === "}" ? Math.max(0, state.braceDepth - 1) : state.braceDepth;
};

const characterExecutesCommand = ({
  source,
  state,
  character,
}: {
  readonly source: string;
  readonly state: WordState;
  readonly character: string;
}): boolean =>
  state.quote !== "single" &&
  (character === "`" ||
    (character === "$" &&
      source.charAt(state.index + 1) === "(" &&
      source.charAt(state.index + 2) !== "("));

const wordAfterCharacter = (source: string, state: WordState): WordState => {
  const character = source.charAt(state.index);
  if (state.quote === "single") return wordAfterSingleQuotedCharacter(state, character);
  if (character === "\\") return wordAfterBackslash(source, state);
  if (character === '"') return wordAfterQuote(state, "double");
  if (character === "'" && state.quote === null) return wordAfterQuote(state, "single");
  return {
    ...state,
    braceDepth: braceDepthAfter(state, character),
    executesCommands:
      state.executesCommands || characterExecutesCommand({ source, state, character }),
    index: state.index + 1,
    staticallyInspectable:
      state.staticallyInspectable && wordCharacterIsStatic({ source, state, character }),
    value: `${state.value}${character}`,
  };
};

const decodedWord = (
  source: string,
): {
  readonly executesCommands: boolean;
  readonly staticallyInspectable: boolean;
  readonly valid: boolean;
  readonly value: string;
} => {
  const terminal = Array.from({ length: source.length + 1 }).reduce<WordState>(
    (state) => (state.index < source.length ? wordAfterCharacter(source, state) : state),
    {
      braceDepth: 0,
      executesCommands: false,
      index: 0,
      quote: null,
      staticallyInspectable: true,
      value: "",
    },
  );
  return {
    executesCommands: terminal.executesCommands,
    staticallyInspectable: terminal.staticallyInspectable,
    valid: terminal.index === source.length && terminal.quote === null,
    value: terminal.value,
  };
};

const emptySegment = (): SegmentState => ({
  command: [],
  expectsRedirectionTarget: false,
  terminated: false,
  staticallyInspectable: true,
});

const completedState = (state: ParserState): ParserState => ({
  complete: [
    ...state.complete,
    {
      command: state.current.command,
      terminated: true,
      staticallyInspectable:
        state.current.staticallyInspectable && !state.current.expectsRedirectionTarget,
    },
  ],
  current: emptySegment(),
});

const stateAfterRedirection = (state: ParserState, token: ShellToken): ParserState => ({
  ...state,
  current: {
    ...state.current,
    expectsRedirectionTarget: true,
    staticallyInspectable:
      state.current.staticallyInspectable &&
      !state.current.expectsRedirectionTarget &&
      token.leadingSyntaxIsStatic &&
      !token.raw.includes("<<"),
  },
});

type DecodedWord = ReturnType<typeof decodedWord>;

const redirectionTargetIsStatic = ({
  state,
  token,
  word,
}: {
  readonly state: ParserState;
  readonly token: ShellToken;
  readonly word: DecodedWord;
}): boolean =>
  state.current.staticallyInspectable &&
  token.leadingSyntaxIsStatic &&
  word.valid &&
  !word.executesCommands &&
  !(token.joinedToPrevious && token.raw.startsWith("("));

const commandWordIsStatic = ({
  state,
  token,
  word,
}: {
  readonly state: ParserState;
  readonly token: ShellToken;
  readonly word: DecodedWord;
}): boolean =>
  state.current.staticallyInspectable &&
  token.leadingSyntaxIsStatic &&
  word.valid &&
  word.staticallyInspectable;

const stateAfterWord = (state: ParserState, token: ShellToken): ParserState => {
  const word = decodedWord(token.raw);
  if (state.current.expectsRedirectionTarget) {
    return {
      ...state,
      current: {
        ...state.current,
        expectsRedirectionTarget: false,
        staticallyInspectable: redirectionTargetIsStatic({ state, token, word }),
      },
    };
  }
  return {
    ...state,
    current: {
      ...state.current,
      command: [...state.current.command, word.value],
      staticallyInspectable: commandWordIsStatic({ state, token, word }),
    },
  };
};

const stateAfterToken = (state: ParserState, token: ShellToken): ParserState => {
  if (COMMAND_SEPARATORS.has(token.raw)) return completedState(state);
  return REDIRECTION.test(token.raw)
    ? stateAfterRedirection(state, token)
    : stateAfterWord(state, token);
};

export const shellCommandSegmentsIn = (source: string): readonly ShellCommandSegment[] => {
  const normalizedSource = lexicallyNormalizedSource(source);
  const tokens = tokensIn(normalizedSource);
  const parsed = tokens.reduce<ParserState>(stateAfterToken, {
    complete: [],
    current: emptySegment(),
  });
  const last = tokens.at(-1);
  const trailingStart = last?.end ?? 0;
  return [
    ...parsed.complete,
    {
      command: parsed.current.command,
      terminated: false,
      staticallyInspectable:
        parsed.current.staticallyInspectable &&
        !parsed.current.expectsRedirectionTarget &&
        staticGap(normalizedSource.slice(trailingStart)),
    },
  ];
};
