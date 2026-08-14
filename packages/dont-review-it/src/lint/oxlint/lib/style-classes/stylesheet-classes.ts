import { uniqBy } from "es-toolkit";

const PRINTED_CHARACTER = /[^\n]/gu;

const blanked = (writtenText: string): string => writtenText.replace(PRINTED_CHARACTER, " ");

const NOISE_PATTERN = /\/\*[\s\S]*?\*\/|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|url\([^)]*\)/gu;

const withoutNoise = (source: string): string => source.replace(NOISE_PATTERN, blanked);

type Prelude = {
  readonly start: number;
  readonly text: string;
};

const BLOCK_DELIMITER = /[{};]/gu;

const BLOCK_OPENING = "{";

const preludesIn = (writtenText: string): readonly Prelude[] => {
  const delimiters = [...writtenText.matchAll(BLOCK_DELIMITER)];
  return delimiters.flatMap((delimiter, position) => {
    if (delimiter[0] !== BLOCK_OPENING) return [];
    const earlier = delimiters[position - 1];
    const start = earlier === undefined ? 0 : earlier.index + 1;
    return [{ start, text: writtenText.slice(start, delimiter.index) }];
  });
};

const AT_RULE_MARK = "@";

const isAtRule = (prelude: Prelude): boolean => prelude.text.trimStart().startsWith(AT_RULE_MARK);

export type StyleClassSite = {
  readonly name: string;
  readonly line: number;
};

const CLASS_SELECTOR = /\.-?[A-Za-z_][\w-]*/gu;

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
