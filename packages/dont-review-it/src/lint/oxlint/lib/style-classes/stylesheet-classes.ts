import { uniqBy } from "es-toolkit";

export type StyleClassSite = {
  readonly name: string;
  readonly line: number;
};

const NOISE_PATTERN = /\/\*[\s\S]*?\*\/|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|url\([^)]*\)/gu;

const PRINTED_CHARACTER = /[^\n]/gu;

const AT_RULE_MARK = "@";

const BLOCK_DELIMITER = /[{};]/gu;

const BLOCK_OPENING = "{";

const CLASS_SELECTOR = /\.-?[A-Za-z_][\w-]*/gu;

const blanked = (text: string): string => text.replace(PRINTED_CHARACTER, " ");

const withoutNoise = (source: string): string => source.replace(NOISE_PATTERN, blanked);

type Prelude = {
  readonly start: number;
  readonly text: string;
};

const preludesIn = (text: string): readonly Prelude[] => {
  const delimiters = [...text.matchAll(BLOCK_DELIMITER)];
  return delimiters.flatMap((delimiter, position) => {
    if (delimiter[0] !== BLOCK_OPENING) return [];
    const previous = delimiters[position - 1];
    const start = previous === undefined ? 0 : previous.index + 1;
    return [{ start, text: text.slice(start, delimiter.index) }];
  });
};

const isAtRule = (prelude: Prelude): boolean => prelude.text.trimStart().startsWith(AT_RULE_MARK);

const classSitesInPrelude = (input: {
  readonly source: string;
  readonly prelude: Prelude;
}): readonly StyleClassSite[] =>
  [...input.prelude.text.matchAll(CLASS_SELECTOR)].map((match) => ({
    name: match[0].slice(1),
    line: input.source.slice(0, input.prelude.start + match.index).split("\n").length,
  }));

export const classSitesIn = (source: string): readonly StyleClassSite[] =>
  uniqBy(
    preludesIn(withoutNoise(source))
      .filter((prelude) => !isAtRule(prelude))
      .flatMap((prelude) => classSitesInPrelude({ source, prelude })),
    (site) => site.name,
  );
