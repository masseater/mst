const literalsFollowInOrder = ({
  segment,
  literals,
  cursor,
  lastMatchableEnd,
}: {
  readonly segment: string;
  readonly literals: readonly string[];
  readonly cursor: number;
  readonly lastMatchableEnd: number;
}): boolean => {
  const [literal, ...remaining] = literals;
  if (literal === undefined) return true;

  const found = segment.indexOf(literal, cursor);
  if (found === -1 || found + literal.length > lastMatchableEnd) return false;

  return literalsFollowInOrder({
    segment,
    literals: remaining,
    cursor: found + literal.length,
    lastMatchableEnd,
  });
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

  return literalsFollowInOrder({
    segment,
    literals: literals.slice(1, -1),
    cursor: head.length,
    lastMatchableEnd: segment.length - tail.length,
  });
};
