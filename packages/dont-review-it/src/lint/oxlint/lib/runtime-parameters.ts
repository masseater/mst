import type { ESTree } from "@oxlint/plugins";

export const runtimeParametersOf = (
  declared: ESTree.Function | ESTree.ArrowFunctionExpression,
): readonly ESTree.ParamPattern[] =>
  declared.params.filter(
    (parameter, index) =>
      index !== 0 || parameter.type !== "Identifier" || parameter.name !== "this",
  );
