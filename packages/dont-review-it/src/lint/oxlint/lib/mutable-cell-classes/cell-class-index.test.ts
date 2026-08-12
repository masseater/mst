import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { buildCellClassIndex, type CellClassFinding } from "./cell-class-index.ts";
import { sourceFactsIn } from "./construction-sites.ts";

const CELL = "class Tally {\n  total = 0;\n  add(row: number) { this.total += row; }\n}";

const CONTAINED = `${CELL}
const sum = (rows: readonly number[]): number => {
  const tally = new Tally();
  for (const row of rows) tally.add(row);
  return tally.total;
};
`;

const indexOf = (sources: Readonly<Record<string, string>>) =>
  buildCellClassIndex(
    Object.entries(sources).map(([relativePath, text]) => ({
      relativePath,
      facts: sourceFactsIn(parseSync(relativePath, text).program),
    })),
  );

const findingsIn = (text: string, elsewhere = "export {};\n"): readonly CellClassFinding[] =>
  indexOf({ "src/held.ts": text, "src/other.ts": elsewhere }).findingsByPath.get("src/held.ts") ??
  [];

describe("buildCellClassIndex", () => {
  test("a class written into after construction and built once inside one function is found", () => {
    expect(findingsIn(CONTAINED)).toStrictEqual([
      { className: "Tally", fields: ["total"], scopeName: "sum" },
    ]);
  });

  test("a class built inside a function with no name of its own carries no scope name", () => {
    expect(
      findingsIn(`${CELL}\nrun(() => { const tally = new Tally(); tally.add(1); });\n`),
    ).toStrictEqual([{ className: "Tally", fields: ["total"], scopeName: null }]);
  });

  test("a class settled by its constructor alone is found nowhere", () => {
    expect(
      findingsIn(
        "class Seed {\n  readonly at: number;\n  constructor(at: number) { this.at = at; }\n}\nconst walk = () => { const seed = new Seed(1); return seed.at; };\n",
      ),
    ).toStrictEqual([]);
  });

  test("a class handed to the module surface is found nowhere", () => {
    expect(findingsIn(`export ${CONTAINED}`)).toStrictEqual([]);
  });

  test("a class whose name is read somewhere other than a construction is found nowhere", () => {
    expect(findingsIn(`${CONTAINED}\nclass Wider extends Tally {}\n`)).toStrictEqual([]);
  });

  test("a class built inside two functions is found nowhere", () => {
    expect(
      findingsIn(
        `${CELL}\nconst first = () => { const tally = new Tally(); tally.add(1); return tally.total; };\nconst second = () => { const tally = new Tally(); tally.add(2); return tally.total; };\n`,
      ),
    ).toStrictEqual([]);
  });

  test("a class built twice inside one function is found", () => {
    expect(
      findingsIn(
        `${CELL}\nconst walk = () => { const left = new Tally(); const right = new Tally(); left.add(1); right.add(2); return left.total + right.total; };\n`,
      ),
    ).toStrictEqual([{ className: "Tally", fields: ["total"], scopeName: "walk" }]);
  });

  test("a class whose instance leaves its scope is found nowhere", () => {
    expect(
      findingsIn(`${CELL}\nconst walk = () => { const tally = new Tally(); return tally; };\n`),
    ).toStrictEqual([]);
  });

  test("a class built at the module top level is found nowhere", () => {
    expect(
      findingsIn(`${CELL}\nconst tally = new Tally();\nconst walk = () => tally.add(1);\n`),
    ).toStrictEqual([]);
  });

  test("a class that is never built is found nowhere", () => {
    expect(findingsIn(CELL)).toStrictEqual([]);
  });

  test("a class whose name is built in a file that declares no such class is found nowhere", () => {
    expect(
      findingsIn(CONTAINED, 'import { Tally } from "./far.ts";\nconst held = new Tally();\n'),
    ).toStrictEqual([]);
  });

  test("a class whose name is built in a file that declares its own such class is found", () => {
    expect(findingsIn(CONTAINED, CONTAINED)).toStrictEqual([
      { className: "Tally", fields: ["total"], scopeName: "sum" },
    ]);
  });
});
