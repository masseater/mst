import { range } from "es-toolkit";

import { classSitesIn, type StyleClassSite } from "./stylesheet-classes.ts";

export type StyleClassIndex = {
  readonly unusedByStyleSheet: ReadonlyMap<string, readonly StyleClassSite[]>;
};

export type StyleClassIndexLoader = (options: {
  readonly repositoryRoot: string;
}) => StyleClassIndex;

export type ReadStyleSheet = {
  readonly relativePath: string;
  readonly source: string;
};

const NAME_SEPARATOR = "-";

const interpolatedPrefixesOf = (spelled: string): readonly string[] => {
  const segments = spelled.split(NAME_SEPARATOR);
  return range(1, segments.length).map(
    (kept) => `${segments.slice(0, kept).join(NAME_SEPARATOR)}${NAME_SEPARATOR}`,
  );
};

const isSpelledIn = (input: { readonly name: string; readonly corpus: string }): boolean =>
  [input.name, ...interpolatedPrefixesOf(input.name)].some((spelling) =>
    input.corpus.includes(spelling),
  );

const unusedEntriesOf = (input: {
  readonly styleSheet: ReadStyleSheet;
  readonly corpus: string;
}): readonly (readonly [string, readonly StyleClassSite[]])[] => {
  const unused = classSitesIn(input.styleSheet.source).filter(
    (site) => !isSpelledIn({ name: site.name, corpus: input.corpus }),
  );
  return unused.length === 0 ? [] : [[input.styleSheet.relativePath, unused]];
};

export const buildStyleClassIndex = ({
  styleSheets,
  referenceTexts,
}: {
  readonly styleSheets: readonly ReadStyleSheet[];
  readonly referenceTexts: readonly string[];
}): StyleClassIndex => {
  const corpus = referenceTexts.join("\n");
  return {
    unusedByStyleSheet: new Map(
      styleSheets.flatMap((styleSheet) => unusedEntriesOf({ styleSheet, corpus })),
    ),
  };
};
