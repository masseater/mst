export type GeneratedRegion = {
  readonly head: string;
  readonly body: string;
  readonly tail: string;
};

export const normalizedContent = (writtenText: string): string =>
  writtenText
    .split("\n")
    .map((line) =>
      line
        .trim()
        .replaceAll(/[ \t]+/gu, " ")
        .replaceAll(/-{3,}/gu, "---"),
    )
    .filter((line) => line !== "")
    .join("\n");

export const regionIn = ({
  source,
  begin,
  end,
}: {
  readonly source: string;
  readonly begin: string;
  readonly end: string;
}): GeneratedRegion | null => {
  const beginAt = source.indexOf(begin);
  const endAt = source.indexOf(end, beginAt + begin.length);
  if (beginAt === -1 || endAt === -1) return null;

  return {
    head: source.slice(0, beginAt + begin.length),
    body: source.slice(beginAt + begin.length, endAt),
    tail: source.slice(endAt),
  };
};

export const blockOf = ({
  begin,
  content,
  end,
}: {
  readonly begin: string;
  readonly content: string;
  readonly end: string;
}): string => `${begin}\n\n${content}\n\n${end}`;

export const withRefreshedRegion = ({
  region,
  content,
}: {
  readonly region: GeneratedRegion;
  readonly content: string;
}): string => `${region.head}\n\n${content}\n\n${region.tail}`;

export const withRefreshedRegionIn = ({
  source,
  begin,
  end,
  content,
}: {
  readonly source: string;
  readonly begin: string;
  readonly end: string;
  readonly content: string;
}): string => {
  const found = regionIn({ source, begin, end });
  return found === null ? source : withRefreshedRegion({ region: found, content });
};
