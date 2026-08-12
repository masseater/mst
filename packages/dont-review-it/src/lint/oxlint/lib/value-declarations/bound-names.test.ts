import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { boundNamesIn } from "./bound-names.ts";

const it = test
  .extend("namesBoundByArrow", () =>
    boundNamesIn(parseSync("bound.ts", `const run = (step, count) => step + count;`).program.body))
  .extend("namesBoundByFunctionDeclaration", () =>
    boundNamesIn(parseSync("bound.ts", `function run(step) { return step; }`).program.body),
  )
  .extend("namesBoundByClass", () =>
    boundNamesIn(parseSync("bound.ts", `class Owner { run(step) { return step; } }`).program.body),
  )
  .extend("namesBoundByDestructuredParameter", () =>
    boundNamesIn(
      parseSync("bound.ts", `const run = ({ id, seeds: [first, ...rest] = [] }) => id;`).program
        .body,
    ),
  )
  .extend("namesBoundByCatchClause", () =>
    boundNamesIn(
      parseSync("bound.ts", `try { run(); } catch (failure) { report(failure); }`).program.body,
    ),
  )
  .extend("namesBoundByTypeParameter", () =>
    boundNamesIn(parseSync("bound.ts", `const run = <Held,>(held: Held) => held;`).program.body),
  )
  .extend("namesBoundBesideTypeAnnotation", () =>
    boundNamesIn(parseSync("bound.ts", `const run = ({ id }: Held) => id;`).program.body),
  )
  .extend("namesBoundByPlainRead", () =>
    boundNamesIn(parseSync("bound.ts", `report(readFileSync("x"));`).program.body),
  );

describe("boundNamesIn", () => {
  it("takes the parameters of an arrow", ({ namesBoundByArrow }) => {
    expect(namesBoundByArrow).toStrictEqual(new Set(["run", "step", "count"]));
  });

  it("takes the name and the parameters of a function declaration", ({
    namesBoundByFunctionDeclaration,
  }) => {
    expect(namesBoundByFunctionDeclaration).toStrictEqual(new Set(["run", "step"]));
  });

  it("takes the name of a class and of the bindings inside it", ({ namesBoundByClass }) => {
    expect(namesBoundByClass).toStrictEqual(new Set(["Owner", "step"]));
  });

  it("takes the pieces a parameter is destructured into", ({
    namesBoundByDestructuredParameter,
  }) => {
    expect(namesBoundByDestructuredParameter).toStrictEqual(
      new Set(["run", "id", "first", "rest"]),
    );
  });

  it("takes the binding a failure is caught into", ({ namesBoundByCatchClause }) => {
    expect(namesBoundByCatchClause).toStrictEqual(new Set(["failure"]));
  });

  it("takes the type parameter a declaration is written over", ({ namesBoundByTypeParameter }) => {
    expect(namesBoundByTypeParameter).toStrictEqual(new Set(["run", "Held", "held"]));
  });

  it("leaves the type a parameter is annotated with out of the bindings", ({
    namesBoundBesideTypeAnnotation,
  }) => {
    expect(namesBoundBesideTypeAnnotation).toStrictEqual(new Set(["run", "id"]));
  });

  it("leaves a name that is only read out of the bindings", ({ namesBoundByPlainRead }) => {
    expect(namesBoundByPlainRead).toStrictEqual(new Set([]));
  });
});
