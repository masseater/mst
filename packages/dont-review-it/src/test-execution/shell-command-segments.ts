const SHELL_TOKEN =
  /(?:\d*(?:<<<|>>|<<|<>|>\||>&|<&|>|<)|&>>?)|(?:\\[\s\S]|"(?:\\[\s\S]|[^"\\])*"|'[^']*'|[^ \t\\'";&|<>\n])+|&&|\|\||[;&|\n]/gu;

const COMMAND_SEPARATORS = ["&&", "||", ";", "&", "|", "\n"] as const;

type CommandSeparator = (typeof COMMAND_SEPARATORS)[number];

const isCommandSeparator = (token: string): token is CommandSeparator =>
  COMMAND_SEPARATORS.includes(token as CommandSeparator);

const REDIRECTION = /^(?:\d*(?:<<<|>>|<<|<>|>\||>&|<&|>|<)|&>>?)$/u;

export type ShellCommandSegment = {
  readonly command: readonly string[];
  readonly hasRedirection: boolean;
  readonly terminator: CommandSeparator | null;
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

const lexicalStateAfterCommentCharacter = (
  lexicalState: LexicalState,
  character: string,
): LexicalState =>
  character === "\n"
    ? {
        ...lexicalState,
        commenting: false,
        index: lexicalState.index + 1,
        source: `${lexicalState.source}\n`,
        wordStarted: false,
      }
    : { ...lexicalState, index: lexicalState.index + 1 };

const quoteAfter = (quote: LexicalState["quote"], character: string): LexicalState["quote"] => {
  if (character === "'" && quote !== "double") return quote === "single" ? null : "single";
  if (character === '"' && quote !== "single") return quote === "double" ? null : "double";
  return quote;
};

const lexicalStateAfterBackslash = (input: string, lexicalState: LexicalState): LexicalState => {
  const escapedCharacter = input.charAt(lexicalState.index + 1);
  return escapedCharacter === "\n"
    ? { ...lexicalState, index: lexicalState.index + 2 }
    : {
        ...lexicalState,
        index: Math.min(input.length, lexicalState.index + 2),
        source: `${lexicalState.source}\\${escapedCharacter}`,
        wordStarted: true,
      };
};

const lexicalStateAfterPlainCharacter = (
  lexicalState: LexicalState,
  character: string,
): LexicalState => {
  const quote = quoteAfter(lexicalState.quote, character);
  const delimiter = quote === null && /[ \t\n;&|<>]/u.test(character);
  return {
    ...lexicalState,
    index: lexicalState.index + 1,
    quote,
    source: `${lexicalState.source}${character}`,
    wordStarted: delimiter ? false : lexicalState.wordStarted || !/[ \t\n]/u.test(character),
  };
};

const lexicalStateAfterCharacter = (input: string, lexicalState: LexicalState): LexicalState => {
  const character = input.charAt(lexicalState.index);
  if (lexicalState.commenting) return lexicalStateAfterCommentCharacter(lexicalState, character);
  if (lexicalState.quote !== "single" && character === "\\") {
    return lexicalStateAfterBackslash(input, lexicalState);
  }
  if (lexicalState.quote === null && character === "#" && !lexicalState.wordStarted) {
    return { ...lexicalState, commenting: true, index: lexicalState.index + 1 };
  }
  return lexicalStateAfterPlainCharacter(lexicalState, character);
};

const lexicallyNormalizedSource = (source: string): string =>
  Array.from({ length: source.length + 1 }).reduce<LexicalState>(
    (lexicalState) =>
      lexicalState.index < source.length
        ? lexicalStateAfterCharacter(source, lexicalState)
        : lexicalState,
    { commenting: false, index: 0, quote: null, source: "", wordStarted: false },
  ).source;

const tokensIn = (source: string): readonly ShellToken[] => {
  const matches = Array.from(source.matchAll(SHELL_TOKEN));
  return matches.map((match, index) => {
    const previousMatch = matches[index - 1];
    const previousEnd =
      previousMatch === undefined ? 0 : previousMatch.index + previousMatch[0].length;
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

const wordAfterBackslash = (source: string, wordState: WordState): WordState => {
  const escapedCharacter = source.charAt(wordState.index + 1);
  if (wordState.quote === "double" && !doubleQuotedEscape(escapedCharacter)) {
    return {
      ...wordState,
      index: wordState.index + 2,
      value: `${wordState.value}\\${escapedCharacter}`,
    };
  }
  return {
    ...wordState,
    index: wordState.index + 2,
    value: `${wordState.value}${escapedCharacter}`,
  };
};

const wordAfterQuote = (wordState: WordState, quote: "double" | "single"): WordState => ({
  ...wordState,
  index: wordState.index + 1,
  quote: wordState.quote === quote ? null : quote,
});

const wordAfterSingleQuotedCharacter = (wordState: WordState, character: string): WordState =>
  character === "'"
    ? wordAfterQuote(wordState, "single")
    : {
        ...wordState,
        index: wordState.index + 1,
        value: `${wordState.value}${character}`,
      };

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

const braceDepthAfter = (wordState: WordState, character: string): number => {
  if (wordState.quote !== null) return wordState.braceDepth;
  if (character === "{") return wordState.braceDepth + 1;
  return character === "}" ? Math.max(0, wordState.braceDepth - 1) : wordState.braceDepth;
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

const wordAfterCharacter = (source: string, wordState: WordState): WordState => {
  const character = source.charAt(wordState.index);
  if (wordState.quote === "single") return wordAfterSingleQuotedCharacter(wordState, character);
  if (character === "\\") return wordAfterBackslash(source, wordState);
  if (character === '"') return wordAfterQuote(wordState, "double");
  if (character === "'" && wordState.quote === null) return wordAfterQuote(wordState, "single");
  return {
    ...wordState,
    braceDepth: braceDepthAfter(wordState, character),
    executesCommands:
      wordState.executesCommands ||
      characterExecutesCommand({ source, state: wordState, character }),
    index: wordState.index + 1,
    staticallyInspectable:
      wordState.staticallyInspectable &&
      wordCharacterIsStatic({ source, state: wordState, character }),
    value: `${wordState.value}${character}`,
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
    (wordState) =>
      wordState.index < source.length ? wordAfterCharacter(source, wordState) : wordState,
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
  hasRedirection: false,
  terminator: null,
  terminated: false,
  staticallyInspectable: true,
});

const completedState = (parserState: ParserState, terminator: CommandSeparator): ParserState => ({
  complete: [
    ...parserState.complete,
    {
      command: parserState.current.command,
      hasRedirection: parserState.current.hasRedirection,
      terminator,
      terminated: true,
      staticallyInspectable:
        parserState.current.staticallyInspectable && !parserState.current.expectsRedirectionTarget,
    },
  ],
  current: emptySegment(),
});

const stateAfterRedirection = (parserState: ParserState, token: ShellToken): ParserState => ({
  ...parserState,
  current: {
    ...parserState.current,
    expectsRedirectionTarget: true,
    hasRedirection: true,
    staticallyInspectable:
      parserState.current.staticallyInspectable &&
      !parserState.current.expectsRedirectionTarget &&
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

const stateAfterWord = (parserState: ParserState, token: ShellToken): ParserState => {
  const word = decodedWord(token.raw);
  if (parserState.current.expectsRedirectionTarget) {
    return {
      ...parserState,
      current: {
        ...parserState.current,
        expectsRedirectionTarget: false,
        staticallyInspectable: redirectionTargetIsStatic({ state: parserState, token, word }),
      },
    };
  }
  return {
    ...parserState,
    current: {
      ...parserState.current,
      command: [...parserState.current.command, word.value],
      staticallyInspectable: commandWordIsStatic({ state: parserState, token, word }),
    },
  };
};

const stateAfterToken = (parserState: ParserState, token: ShellToken): ParserState => {
  if (isCommandSeparator(token.raw)) return completedState(parserState, token.raw);
  return REDIRECTION.test(token.raw)
    ? stateAfterRedirection(parserState, token)
    : stateAfterWord(parserState, token);
};

export const shellCommandSegmentsIn = (source: string): readonly ShellCommandSegment[] => {
  const normalizedSource = lexicallyNormalizedSource(source);
  const tokens = tokensIn(normalizedSource);
  const commandParserState = tokens.reduce<ParserState>(stateAfterToken, {
    complete: [],
    current: emptySegment(),
  });
  const last = tokens.at(-1);
  const trailingStart = last?.end ?? 0;
  return [
    ...commandParserState.complete,
    {
      command: commandParserState.current.command,
      hasRedirection: commandParserState.current.hasRedirection,
      terminator: null,
      terminated: false,
      staticallyInspectable:
        commandParserState.current.staticallyInspectable &&
        !commandParserState.current.expectsRedirectionTarget &&
        staticGap(normalizedSource.slice(trailingStart)),
    },
  ];
};
