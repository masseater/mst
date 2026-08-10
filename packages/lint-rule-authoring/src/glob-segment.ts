const literalsFollowInOrder = ({
  segment,
  literals,
}: {
  readonly segment: string;
  readonly literals: readonly string[];
}): boolean => {
  const head = literals.slice(0, 1).join("");
  const tail = literals.slice(-1).join("");
  const lastMatchableEnd = segment.length - tail.length;

  return (
    literals.slice(1, -1).reduce<number | null>((cursor, literal) => {
      if (cursor === null) return null;
      const found = segment.indexOf(literal, cursor);
      if (found === -1 || found + literal.length > lastMatchableEnd) return null;
      return found + literal.length;
    }, head.length) !== null
  );
};

export const matchesGlobSegment = ({
  segment,
  pattern,
}: {
  readonly segment: string;
  readonly pattern: string;
}): boolean => {
  const literals = pattern.split("*");
  if (literals.length === 1) return segment === pattern;

  const head = literals.slice(0, 1).join("");
  const tail = literals.slice(-1).join("");
  if (!segment.startsWith(head)) return false;
  if (!segment.endsWith(tail)) return false;
  if (segment.length < head.length + tail.length) return false;

  return literalsFollowInOrder({ segment, literals });
};
