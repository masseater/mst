import type { ESTree } from "@oxlint/plugins";
import type { createCanonicalValueGlobalWriteIndex } from "./canonical-value-global-write.ts";

export const createCanonicalValueGlobalWriteRecorders = (input: {
  readonly globalWriteIndex: ReturnType<typeof createCanonicalValueGlobalWriteIndex>;
  readonly recordAssignment: (node: ESTree.AssignmentExpression) => void;
  readonly recordCall: (node: ESTree.CallExpression) => void;
  readonly recordUnary: (node: ESTree.UnaryExpression) => void;
  readonly recordUpdate: (node: ESTree.UpdateExpression) => void;
}) => ({
  recordAssignment: (node: ESTree.AssignmentExpression) => {
    input.recordAssignment(node);
    input.globalWriteIndex.recordAssignment(node);
  },
  recordCall: (node: ESTree.CallExpression) => {
    input.recordCall(node);
    input.globalWriteIndex.recordCall(node);
  },
  recordUnary: (node: ESTree.UnaryExpression) => {
    input.recordUnary(node);
    input.globalWriteIndex.recordUnary(node);
  },
  recordUpdate: (node: ESTree.UpdateExpression) => {
    input.recordUpdate(node);
    input.globalWriteIndex.recordUpdate(node);
  },
});
