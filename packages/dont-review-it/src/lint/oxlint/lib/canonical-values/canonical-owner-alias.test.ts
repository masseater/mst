import { describe, expect, test } from "vite-plus/test";

import { analyzeCanonicalValuesRepository } from "./builder.ts";
import {
  annotateCanonicalValues,
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFile,
} from "./canonical-values-test-fixture.ts";

const analyzeMutation = (mutation: string) => {
  const repositoryRoot = createCanonicalValuesTestRepository();
  writeCanonicalValuesTestFile({
    repositoryRoot,
    relativePath: "src/values.ts",
    contents: `${annotateCanonicalValues(
      "order.status",
      'export const VALUES = ["draft", "published"] as const;',
    )}${mutation}`,
  });
  return analyzeCanonicalValuesRepository({ repositoryRoot });
};

describe("canonical owner aliases", () => {
  test.each([
    "const holder = [VALUES] as const; const [alias] = holder; (alias as unknown as string[]).pop();",
    "class Holder { value = VALUES; } const holder = new Holder(); (holder.value as unknown as string[]).pop();",
    "class Holder { static value = VALUES; } (Holder.value as unknown as string[]).pop();",
    'const holder = { ["value"]: VALUES }; (holder.value as unknown as string[]).pop();',
    "const inner = { value: VALUES }; const holder = { ...inner }; (holder.value as unknown as string[]).pop();",
    "const holder: { value?: readonly string[] } = {}; holder.value = VALUES; (holder.value as unknown as string[]).pop();",
    "const holder: (readonly string[])[] = []; holder[0] = VALUES; (holder[0] as unknown as string[]).pop();",
    "const holder = [VALUES] as const; (holder.at(0) as unknown as string[]).pop();",
    'const holder = new Map([["value", VALUES]]); (holder.get("value") as unknown as string[]).pop();',
  ])("an owner stored in a container cannot be mutated", (mutation) => {
    const analyzed = analyzeMutation(mutation);

    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: 1,
      conceptId: "order.status",
    });
  });
});
