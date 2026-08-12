import { describe, expect, test } from "vite-plus/test";

import { valueDeclarationsIn, type ValueDeclaration } from "./declarations.ts";

const RELATIVE_PATH = "packages/one/src/read.ts";

const declarationsIn = (source: string): readonly ValueDeclaration[] =>
  valueDeclarationsIn({ source, relativePath: RELATIVE_PATH });

const namesIn = (source: string): readonly string[] =>
  declarationsIn(source).map((declaration) => declaration.name);

const exportedNamesIn = (source: string): readonly string[] =>
  declarationsIn(source)
    .filter((declaration) => declaration.exported)
    .map((declaration) => declaration.name);

const soleDeclarationOf = (source: string): ValueDeclaration => {
  const [declaration] = declarationsIn(source);
  if (declaration === undefined) throw new Error(`nothing was declared in: ${source}`);
  return declaration;
};

describe("valueDeclarationsIn", () => {
  test("reads a constant under the name it was declared with", () => {
    expect(soleDeclarationOf(`const seed = 1;`).name).toBe("seed");
  });

  test("reads a function declaration as a declared value", () => {
    expect(namesIn(`function run(step: number) { return step; }`)).toStrictEqual(["run"]);
  });

  test("reads a class declaration as a declared value", () => {
    expect(namesIn(`class Owner {}`)).toStrictEqual(["Owner"]);
  });

  test("leaves a type declaration out", () => {
    expect(namesIn(`export type Held = { readonly id: string };`)).toStrictEqual([]);
  });

  test("leaves a binding that spreads into several names out", () => {
    expect(namesIn(`const { first, second } = split();`)).toStrictEqual([]);
  });

  test("leaves a default export out", () => {
    expect(namesIn(`export default 3;`)).toStrictEqual([]);
  });

  test("marks a declaration carried out by its own export keyword", () => {
    expect(exportedNamesIn(`export const seed = 1;\nconst kept = 2;`)).toStrictEqual(["seed"]);
  });

  test("marks a declaration sent away by a later export statement", () => {
    expect(exportedNamesIn(`const seed = 1;\nexport { seed };`)).toStrictEqual(["seed"]);
  });

  test("leaves a name that only passes through a re-export unmarked", () => {
    expect(
      exportedNamesIn(`const seed = 1;\nexport { seed as away } from "./other.ts";`),
    ).toStrictEqual([]);
  });

  test("reads a declaration standing inside another declaration", () => {
    expect(namesIn(`export const outer = () => { const inner = 1; return inner; };`)).toStrictEqual(
      ["outer", "inner"],
    );
  });

  test("leaves a declaration standing inside another one unmarked as exported", () => {
    expect(
      exportedNamesIn(`export const seed = () => { const seed = 1; return seed; };`),
    ).toStrictEqual(["seed"]);
  });

  test("reads the line the declaration stands on", () => {
    expect(soleDeclarationOf(`\n\nconst seed = 1;`).line).toBe(3);
  });

  test("gives two constants that differ only in the alias of one import the same fingerprint", () => {
    const here = valueDeclarationsIn({
      source: `import { readFileSync } from "node:fs";\nexport const read = (path: string) => readFileSync(path, "utf8");`,
      relativePath: "packages/one/src/read.ts",
    });
    const away = valueDeclarationsIn({
      source: `import { readFileSync as slurp } from "node:fs";\nexport const read = (target: string) => slurp(target, "utf8");`,
      relativePath: "packages/two/src/read.ts",
    });

    expect(here[0]?.fingerprint).toBe(away[0]?.fingerprint);
  });

  test("keeps two constants apart when their bodies hold different values", () => {
    expect(soleDeclarationOf(`const seed = 1;`).fingerprint).not.toBe(
      soleDeclarationOf(`const seed = 2;`).fingerprint,
    );
  });
});
