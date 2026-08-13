import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { buildCellClassIndex } from "./cell-class-index.ts";
import { sourceFactsIn } from "./construction-sites.ts";

const CELL = "class Tally {\n  total = 0;\n  add(row: number) { this.total += row; }\n}";

const CONTAINED = `${CELL}
const sum = (rows: readonly number[]): number => {
  const tally = new Tally();
  for (const row of rows) tally.add(row);
  return tally.total;
};
`;

const NOTHING_ELSEWHERE = "export {};\n";

describe("buildCellClassIndex", () => {
  describe("a class written into after construction and built once inside one function", () => {
    const it = test.extend("cellClassIndex", () =>
      buildCellClassIndex([
        {
          relativePath: "src/held.ts",
          facts: sourceFactsIn(parseSync("src/held.ts", CONTAINED).program),
        },
        {
          relativePath: "src/other.ts",
          facts: sourceFactsIn(parseSync("src/other.ts", NOTHING_ELSEWHERE).program),
        },
      ]));

    it("is found", ({ cellClassIndex }) => {
      expect(cellClassIndex).toStrictEqual({
        findingsByPath: new Map([
          ["src/held.ts", [{ className: "Tally", fields: ["total"], scopeName: "sum" }]],
          ["src/other.ts", []],
        ]),
      });
    });
  });

  describe("a class built inside a function with no name of its own", () => {
    const it = test.extend("cellClassIndex", () =>
      buildCellClassIndex([
        {
          relativePath: "src/held.ts",
          facts: sourceFactsIn(
            parseSync(
              "src/held.ts",
              `${CELL}\nrun(() => { const tally = new Tally(); tally.add(1); });\n`,
            ).program,
          ),
        },
        {
          relativePath: "src/other.ts",
          facts: sourceFactsIn(parseSync("src/other.ts", NOTHING_ELSEWHERE).program),
        },
      ]));

    it("carries no scope name", ({ cellClassIndex }) => {
      expect(cellClassIndex).toStrictEqual({
        findingsByPath: new Map([
          ["src/held.ts", [{ className: "Tally", fields: ["total"], scopeName: null }]],
          ["src/other.ts", []],
        ]),
      });
    });
  });

  describe("a class settled by its constructor alone", () => {
    const it = test.extend("cellClassIndex", () =>
      buildCellClassIndex([
        {
          relativePath: "src/held.ts",
          facts: sourceFactsIn(
            parseSync(
              "src/held.ts",
              "class Seed {\n  readonly at: number;\n  constructor(at: number) { this.at = at; }\n}\nconst walk = () => { const seed = new Seed(1); return seed.at; };\n",
            ).program,
          ),
        },
        {
          relativePath: "src/other.ts",
          facts: sourceFactsIn(parseSync("src/other.ts", NOTHING_ELSEWHERE).program),
        },
      ]));

    it("is found nowhere", ({ cellClassIndex }) => {
      expect(cellClassIndex).toStrictEqual({
        findingsByPath: new Map([
          ["src/held.ts", []],
          ["src/other.ts", []],
        ]),
      });
    });
  });

  describe("a class handed to the module surface", () => {
    const it = test.extend("cellClassIndex", () =>
      buildCellClassIndex([
        {
          relativePath: "src/held.ts",
          facts: sourceFactsIn(parseSync("src/held.ts", `export ${CONTAINED}`).program),
        },
        {
          relativePath: "src/other.ts",
          facts: sourceFactsIn(parseSync("src/other.ts", NOTHING_ELSEWHERE).program),
        },
      ]));

    it("is found nowhere", ({ cellClassIndex }) => {
      expect(cellClassIndex).toStrictEqual({
        findingsByPath: new Map([
          ["src/held.ts", []],
          ["src/other.ts", []],
        ]),
      });
    });
  });

  describe("a class whose name is read somewhere other than a construction", () => {
    const it = test.extend("cellClassIndex", () =>
      buildCellClassIndex([
        {
          relativePath: "src/held.ts",
          facts: sourceFactsIn(
            parseSync("src/held.ts", `${CONTAINED}\nclass Wider extends Tally {}\n`).program,
          ),
        },
        {
          relativePath: "src/other.ts",
          facts: sourceFactsIn(parseSync("src/other.ts", NOTHING_ELSEWHERE).program),
        },
      ]));

    it("is found nowhere", ({ cellClassIndex }) => {
      expect(cellClassIndex).toStrictEqual({
        findingsByPath: new Map([
          ["src/held.ts", []],
          ["src/other.ts", []],
        ]),
      });
    });
  });

  describe("a class built inside two functions", () => {
    const it = test.extend("cellClassIndex", () =>
      buildCellClassIndex([
        {
          relativePath: "src/held.ts",
          facts: sourceFactsIn(
            parseSync(
              "src/held.ts",
              `${CELL}\nconst first = () => { const tally = new Tally(); tally.add(1); return tally.total; };\nconst second = () => { const tally = new Tally(); tally.add(2); return tally.total; };\n`,
            ).program,
          ),
        },
        {
          relativePath: "src/other.ts",
          facts: sourceFactsIn(parseSync("src/other.ts", NOTHING_ELSEWHERE).program),
        },
      ]));

    it("is found nowhere", ({ cellClassIndex }) => {
      expect(cellClassIndex).toStrictEqual({
        findingsByPath: new Map([
          ["src/held.ts", []],
          ["src/other.ts", []],
        ]),
      });
    });
  });

  describe("a class built twice inside one function", () => {
    const it = test.extend("cellClassIndex", () =>
      buildCellClassIndex([
        {
          relativePath: "src/held.ts",
          facts: sourceFactsIn(
            parseSync(
              "src/held.ts",
              `${CELL}\nconst walk = () => { const left = new Tally(); const right = new Tally(); left.add(1); right.add(2); return left.total + right.total; };\n`,
            ).program,
          ),
        },
        {
          relativePath: "src/other.ts",
          facts: sourceFactsIn(parseSync("src/other.ts", NOTHING_ELSEWHERE).program),
        },
      ]));

    it("is found", ({ cellClassIndex }) => {
      expect(cellClassIndex).toStrictEqual({
        findingsByPath: new Map([
          ["src/held.ts", [{ className: "Tally", fields: ["total"], scopeName: "walk" }]],
          ["src/other.ts", []],
        ]),
      });
    });
  });

  describe("a class whose instance leaves its scope", () => {
    const it = test.extend("cellClassIndex", () =>
      buildCellClassIndex([
        {
          relativePath: "src/held.ts",
          facts: sourceFactsIn(
            parseSync(
              "src/held.ts",
              `${CELL}\nconst walk = () => { const tally = new Tally(); return tally; };\n`,
            ).program,
          ),
        },
        {
          relativePath: "src/other.ts",
          facts: sourceFactsIn(parseSync("src/other.ts", NOTHING_ELSEWHERE).program),
        },
      ]));

    it("is found nowhere", ({ cellClassIndex }) => {
      expect(cellClassIndex).toStrictEqual({
        findingsByPath: new Map([
          ["src/held.ts", []],
          ["src/other.ts", []],
        ]),
      });
    });
  });

  describe("a class built at the module top level", () => {
    const it = test.extend("cellClassIndex", () =>
      buildCellClassIndex([
        {
          relativePath: "src/held.ts",
          facts: sourceFactsIn(
            parseSync(
              "src/held.ts",
              `${CELL}\nconst tally = new Tally();\nconst walk = () => tally.add(1);\n`,
            ).program,
          ),
        },
        {
          relativePath: "src/other.ts",
          facts: sourceFactsIn(parseSync("src/other.ts", NOTHING_ELSEWHERE).program),
        },
      ]));

    it("is found nowhere", ({ cellClassIndex }) => {
      expect(cellClassIndex).toStrictEqual({
        findingsByPath: new Map([
          ["src/held.ts", []],
          ["src/other.ts", []],
        ]),
      });
    });
  });

  describe("a class that is never built", () => {
    const it = test.extend("cellClassIndex", () =>
      buildCellClassIndex([
        {
          relativePath: "src/held.ts",
          facts: sourceFactsIn(parseSync("src/held.ts", CELL).program),
        },
        {
          relativePath: "src/other.ts",
          facts: sourceFactsIn(parseSync("src/other.ts", NOTHING_ELSEWHERE).program),
        },
      ]));

    it("is found nowhere", ({ cellClassIndex }) => {
      expect(cellClassIndex).toStrictEqual({
        findingsByPath: new Map([
          ["src/held.ts", []],
          ["src/other.ts", []],
        ]),
      });
    });
  });

  describe("a class whose name is built in a file that declares no such class", () => {
    const it = test.extend("cellClassIndex", () =>
      buildCellClassIndex([
        {
          relativePath: "src/held.ts",
          facts: sourceFactsIn(parseSync("src/held.ts", CONTAINED).program),
        },
        {
          relativePath: "src/other.ts",
          facts: sourceFactsIn(
            parseSync(
              "src/other.ts",
              'import { Tally } from "./far.ts";\nconst held = new Tally();\n',
            ).program,
          ),
        },
      ]));

    it("is found nowhere", ({ cellClassIndex }) => {
      expect(cellClassIndex).toStrictEqual({
        findingsByPath: new Map([
          ["src/held.ts", []],
          ["src/other.ts", []],
        ]),
      });
    });
  });

  describe("a class whose name is built in a file that declares its own such class", () => {
    const it = test.extend("cellClassIndex", () =>
      buildCellClassIndex([
        {
          relativePath: "src/held.ts",
          facts: sourceFactsIn(parseSync("src/held.ts", CONTAINED).program),
        },
        {
          relativePath: "src/other.ts",
          facts: sourceFactsIn(parseSync("src/other.ts", CONTAINED).program),
        },
      ]));

    it("is found", ({ cellClassIndex }) => {
      expect(cellClassIndex).toStrictEqual({
        findingsByPath: new Map([
          ["src/held.ts", [{ className: "Tally", fields: ["total"], scopeName: "sum" }]],
          ["src/other.ts", [{ className: "Tally", fields: ["total"], scopeName: "sum" }]],
        ]),
      });
    });
  });
});
