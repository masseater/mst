export type StatementPlacement<Held> = {
  readonly held: Held;
  readonly usedAt: readonly number[];
  readonly reportable: boolean;
  readonly carriesEffect: boolean;
};

const usedAtOf = <Held>(
  statements: readonly StatementPlacement<Held>[],
  index: number,
): readonly number[] =>
  statements.flatMap((statement, at) => (at === index ? statement.usedAt : []));

const grownBy = <Held>(
  statements: readonly StatementPlacement<Held>[],
  reached: readonly number[],
): readonly number[] => [
  ...new Set([...reached, ...reached.flatMap((index) => usedAtOf(statements, index))]),
];

const reachedFrom = <Held>(
  statements: readonly StatementPlacement<Held>[],
  reached: readonly number[],
): readonly number[] => {
  const grown = grownBy(statements, reached);
  return grown.length === reached.length ? grown : reachedFrom(statements, grown);
};

const reaches = <Held>(
  statements: readonly StatementPlacement<Held>[],
  edge: { readonly from: number; readonly to: number },
): boolean => reachedFrom(statements, usedAtOf(statements, edge.from)).includes(edge.to);

const carriesEffectAt = <Held>(
  statements: readonly StatementPlacement<Held>[],
  index: number,
): boolean => statements.some((statement, at) => at === index && statement.carriesEffect);

const indexesBetween = (from: number, to: number): readonly number[] =>
  Array.from({ length: Math.max(to - from - 1, 0) }, (_, offset) => from + offset + 1);

const passedOver = (placement: {
  readonly index: number;
  readonly firstUseIndex: number;
}): readonly number[] =>
  placement.firstUseIndex < placement.index
    ? indexesBetween(placement.firstUseIndex - 1, placement.index)
    : indexesBetween(placement.index, placement.firstUseIndex);

const isDetached = <Held>(
  statements: readonly StatementPlacement<Held>[],
  placement: { readonly index: number; readonly firstUseIndex: number },
): boolean => {
  if (reaches(statements, { from: placement.index, to: placement.index })) return false;
  if (passedOver(placement).some((at) => carriesEffectAt(statements, at))) return false;
  if (placement.firstUseIndex < placement.index) return true;
  return indexesBetween(placement.index, placement.firstUseIndex).some(
    (between) => !reaches(statements, { from: between, to: placement.firstUseIndex }),
  );
};

const heldAt = <Held>(
  statements: readonly StatementPlacement<Held>[],
  index: number,
): readonly Held[] => statements.flatMap((statement, at) => (at === index ? [statement.held] : []));

export type DetachedDeclaration<Held> = {
  readonly held: Held;
  readonly firstUse: Held;
};

export const detachedDeclarations = <Held>(
  statements: readonly StatementPlacement<Held>[],
): readonly DetachedDeclaration<Held>[] =>
  statements.flatMap((statement, index) => {
    if (!statement.reportable || statement.usedAt.length === 0) return [];
    const firstUseIndex = Math.min(...statement.usedAt);
    if (!isDetached(statements, { index, firstUseIndex })) return [];
    return heldAt(statements, firstUseIndex).map((firstUse) => ({
      held: statement.held,
      firstUse,
    }));
  });
