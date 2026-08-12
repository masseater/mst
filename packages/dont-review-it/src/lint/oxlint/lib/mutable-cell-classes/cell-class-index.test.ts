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

const it = test
  .extend("indexOfAClassWrittenIntoAfterConstruction", () =>
    buildCellClassIndex([
      {
        relativePath: "src/held.ts",
        facts: sourceFactsIn(parseSync("src/held.ts", CONTAINED).program),
      },
      {
        relativePath: "src/other.ts",
        facts: sourceFactsIn(parseSync("src/other.ts", NOTHING_ELSEWHERE).program),
      },
    ]))
  .extend("indexOfAClassBuiltInsideAFunctionWithNoNameOfItsOwn", () =>
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
    ]),
  )
  .extend("indexOfAClassSettledByItsConstructorAlone", () =>
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
    ]),
  )
  .extend("indexOfAClassHandedToTheModuleSurface", () =>
    buildCellClassIndex([
      {
        relativePath: "src/held.ts",
        facts: sourceFactsIn(parseSync("src/held.ts", `export ${CONTAINED}`).program),
      },
      {
        relativePath: "src/other.ts",
        facts: sourceFactsIn(parseSync("src/other.ts", NOTHING_ELSEWHERE).program),
      },
    ]),
  )
  .extend("indexOfAClassWhoseNameIsReadSomewhereOtherThanAConstruction", () =>
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
    ]),
  )
  .extend("indexOfAClassBuiltInsideTwoFunctions", () =>
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
    ]),
  )
  .extend("indexOfAClassBuiltTwiceInsideOneFunction", () =>
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
    ]),
  )
  .extend("indexOfAClassWhoseInstanceLeavesItsScope", () =>
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
    ]),
  )
  .extend("indexOfAClassBuiltAtTheModuleTopLevel", () =>
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
    ]),
  )
  .extend("indexOfAClassThatIsNeverBuilt", () =>
    buildCellClassIndex([
      {
        relativePath: "src/held.ts",
        facts: sourceFactsIn(parseSync("src/held.ts", CELL).program),
      },
      {
        relativePath: "src/other.ts",
        facts: sourceFactsIn(parseSync("src/other.ts", NOTHING_ELSEWHERE).program),
      },
    ]),
  )
  .extend("indexOfAClassBuiltInAFileDeclaringNoSuchClass", () =>
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
    ]),
  )
  .extend("indexOfAClassBuiltInAFileDeclaringItsOwnSuchClass", () =>
    buildCellClassIndex([
      {
        relativePath: "src/held.ts",
        facts: sourceFactsIn(parseSync("src/held.ts", CONTAINED).program),
      },
      {
        relativePath: "src/other.ts",
        facts: sourceFactsIn(parseSync("src/other.ts", CONTAINED).program),
      },
    ]),
  );

describe("buildCellClassIndex", () => {
  it("a class written into after construction and built once inside one function is found", ({
    indexOfAClassWrittenIntoAfterConstruction,
  }) => {
    expect(indexOfAClassWrittenIntoAfterConstruction).toStrictEqual({
      findingsByPath: new Map([
        ["src/held.ts", [{ className: "Tally", fields: ["total"], scopeName: "sum" }]],
        ["src/other.ts", []],
      ]),
    });
  });

  it("a class built inside a function with no name of its own carries no scope name", ({
    indexOfAClassBuiltInsideAFunctionWithNoNameOfItsOwn,
  }) => {
    expect(indexOfAClassBuiltInsideAFunctionWithNoNameOfItsOwn).toStrictEqual({
      findingsByPath: new Map([
        ["src/held.ts", [{ className: "Tally", fields: ["total"], scopeName: null }]],
        ["src/other.ts", []],
      ]),
    });
  });

  it("a class settled by its constructor alone is found nowhere", ({
    indexOfAClassSettledByItsConstructorAlone,
  }) => {
    expect(indexOfAClassSettledByItsConstructorAlone).toStrictEqual({
      findingsByPath: new Map([
        ["src/held.ts", []],
        ["src/other.ts", []],
      ]),
    });
  });

  it("a class handed to the module surface is found nowhere", ({
    indexOfAClassHandedToTheModuleSurface,
  }) => {
    expect(indexOfAClassHandedToTheModuleSurface).toStrictEqual({
      findingsByPath: new Map([
        ["src/held.ts", []],
        ["src/other.ts", []],
      ]),
    });
  });

  it("a class whose name is read somewhere other than a construction is found nowhere", ({
    indexOfAClassWhoseNameIsReadSomewhereOtherThanAConstruction,
  }) => {
    expect(indexOfAClassWhoseNameIsReadSomewhereOtherThanAConstruction).toStrictEqual({
      findingsByPath: new Map([
        ["src/held.ts", []],
        ["src/other.ts", []],
      ]),
    });
  });

  it("a class built inside two functions is found nowhere", ({
    indexOfAClassBuiltInsideTwoFunctions,
  }) => {
    expect(indexOfAClassBuiltInsideTwoFunctions).toStrictEqual({
      findingsByPath: new Map([
        ["src/held.ts", []],
        ["src/other.ts", []],
      ]),
    });
  });

  it("a class built twice inside one function is found", ({
    indexOfAClassBuiltTwiceInsideOneFunction,
  }) => {
    expect(indexOfAClassBuiltTwiceInsideOneFunction).toStrictEqual({
      findingsByPath: new Map([
        ["src/held.ts", [{ className: "Tally", fields: ["total"], scopeName: "walk" }]],
        ["src/other.ts", []],
      ]),
    });
  });

  it("a class whose instance leaves its scope is found nowhere", ({
    indexOfAClassWhoseInstanceLeavesItsScope,
  }) => {
    expect(indexOfAClassWhoseInstanceLeavesItsScope).toStrictEqual({
      findingsByPath: new Map([
        ["src/held.ts", []],
        ["src/other.ts", []],
      ]),
    });
  });

  it("a class built at the module top level is found nowhere", ({
    indexOfAClassBuiltAtTheModuleTopLevel,
  }) => {
    expect(indexOfAClassBuiltAtTheModuleTopLevel).toStrictEqual({
      findingsByPath: new Map([
        ["src/held.ts", []],
        ["src/other.ts", []],
      ]),
    });
  });

  it("a class that is never built is found nowhere", ({ indexOfAClassThatIsNeverBuilt }) => {
    expect(indexOfAClassThatIsNeverBuilt).toStrictEqual({
      findingsByPath: new Map([
        ["src/held.ts", []],
        ["src/other.ts", []],
      ]),
    });
  });

  it("a class whose name is built in a file that declares no such class is found nowhere", ({
    indexOfAClassBuiltInAFileDeclaringNoSuchClass,
  }) => {
    expect(indexOfAClassBuiltInAFileDeclaringNoSuchClass).toStrictEqual({
      findingsByPath: new Map([
        ["src/held.ts", []],
        ["src/other.ts", []],
      ]),
    });
  });

  it("a class whose name is built in a file that declares its own such class is found", ({
    indexOfAClassBuiltInAFileDeclaringItsOwnSuchClass,
  }) => {
    expect(indexOfAClassBuiltInAFileDeclaringItsOwnSuchClass).toStrictEqual({
      findingsByPath: new Map([
        ["src/held.ts", [{ className: "Tally", fields: ["total"], scopeName: "sum" }]],
        ["src/other.ts", [{ className: "Tally", fields: ["total"], scopeName: "sum" }]],
      ]),
    });
  });
});
