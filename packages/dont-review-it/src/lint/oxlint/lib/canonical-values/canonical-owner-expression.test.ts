import { describe, expect, test } from "vite-plus/test";

import { analyzeCanonicalValuesRepository } from "./builder.ts";
import {
  annotateCanonicalValues,
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFile,
} from "./canonical-values-test-fixture.ts";

const analyzeBoundary = (boundary: string) => {
  const repositoryRoot = createCanonicalValuesTestRepository();
  writeCanonicalValuesTestFile({
    repositoryRoot,
    relativePath: "src/values.ts",
    contents: `${annotateCanonicalValues(
      "order.status",
      'export const VALUES = ["draft", "published"] as const;',
    )}${boundary}`,
  });
  return analyzeCanonicalValuesRepository({ repositoryRoot });
};

describe("canonical owner alias expressions", { timeout: 10_000 }, () => {
  test.each([
    "const alias = true && VALUES; (alias as unknown as string[]).pop();",
    "const alias = false || VALUES; (alias as unknown as string[]).pop();",
    "const alias = null ?? VALUES; (alias as unknown as string[]).pop();",
    "const alias = (0, VALUES); (alias as unknown as string[]).pop();",
    "let alias: readonly string[] | undefined; alias ||= VALUES; (alias as unknown as string[]).pop();",
    "let alias: readonly string[] | undefined; alias ??= VALUES; (alias as unknown as string[]).pop();",
    "let alias: readonly string[] | undefined = []; alias &&= VALUES; (alias as unknown as string[]).pop();",
    "let alias: readonly string[] = []; [alias] = [VALUES]; (alias as unknown as string[]).pop();",
    "let alias: readonly string[] = []; ({ value: alias } = { value: VALUES }); (alias as unknown as string[]).pop();",
    "function mutate(value: readonly string[] = VALUES) { (value as string[]).pop(); } mutate();",
    "function mutate(...args: readonly (readonly string[])[]) { (args[0] as string[]).pop(); } mutate(VALUES);",
    "function mutate(value: readonly string[]) { (value as string[]).pop(); } mutate.apply(null, [VALUES]);",
  ])("a reachable alias expression cannot hide owner mutation", (boundary) => {
    const analyzed = analyzeBoundary(boundary);

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: 1,
      conceptId: "order.status",
    });
  });

  test.each([
    "const alias = false && VALUES; consume(alias);",
    "const alias = true || VALUES; consume(alias);",
    "const alias = (VALUES, [] as const); consume(alias);",
  ])("an unreachable or discarded owner branch stays detached", (boundary) => {
    const analyzed = analyzeBoundary(boundary);

    expect(analyzed.problems).toStrictEqual([]);
    expect(analyzed.catalog.entries).toHaveLength(1);
  });
});
