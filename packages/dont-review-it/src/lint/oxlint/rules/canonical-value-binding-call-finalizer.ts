import type { ESTree } from "@oxlint/plugins";

export const createCanonicalValueBindingCallFinalizer = (input: {
  readonly bindingWriteCount: () => number;
  readonly recordCall: (node: ESTree.CallExpression) => void;
}) => {
  const pending = new Set<ESTree.CallExpression>();
  const finalizePass = (): boolean => {
    const before = input.bindingWriteCount();
    for (const call of [...pending].toSorted((left, right) => left.start - right.start)) {
      input.recordCall(call);
    }
    return input.bindingWriteCount() > before;
  };
  const finalize = (): void => {
    while (finalizePass()) continue;
  };
  return {
    finalize,
    record: (node: ESTree.CallExpression) => {
      pending.add(node);
    },
  };
};
