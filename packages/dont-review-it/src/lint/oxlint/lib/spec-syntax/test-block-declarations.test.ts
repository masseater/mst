import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  assertionEntryBindings,
  carriesSpelledTitle,
  declaresTestBlock,
  groupingBlockBindings,
  testBlockBindings,
  testBlockBodyOf,
  testCallbacksOf,
  type TestBlockBindings,
} from "./test-block-declarations.ts";

import type { ESTree } from "@oxlint/plugins";

const statementsIn = (source: string): readonly ESTree.Statement[] =>
  parseSync("spec.ts", source).program.body.map((statement) => statement as ESTree.Statement);

const lastCallIn = (statements: readonly ESTree.Statement[]): ESTree.CallExpression => {
  const last = statements.at(-1) as ESTree.ExpressionStatement;
  return last.expression as ESTree.CallExpression;
};

const boundIn = (
  bindings: TestBlockBindings,
  statements: readonly ESTree.Statement[],
): ReadonlySet<string> => {
  for (const statement of statements) {
    if (statement.type === "ImportDeclaration") bindings.takeImport(statement);
    if (statement.type === "VariableDeclaration") {
      for (const declarator of statement.declarations) bindings.takeLocalBinding(declarator);
    }
  }
  return bindings.rootNames();
};

const declaresWith = (bindings: TestBlockBindings, source: string): boolean => {
  const statements = statementsIn(source);
  return declaresTestBlock(lastCallIn(statements), boundIn(bindings, statements));
};

const titleSpelledIn = (source: string): boolean =>
  carriesSpelledTitle(lastCallIn(statementsIn(source)));

const bodyShapeIn = (source: string): string | null => {
  const statements = statementsIn(source);
  const writtenBody = testBlockBodyOf(
    lastCallIn(statements),
    boundIn(testBlockBindings(), statements),
  );
  return writtenBody === null ? null : writtenBody.type;
};

const declaresIn = (source: string): boolean => declaresWith(testBlockBindings(), source);

const declaresGroupingIn = (source: string): boolean =>
  declaresWith(groupingBlockBindings(), source);

const callbackShapesIn = (source: string): readonly string[] =>
  testCallbacksOf(lastCallIn(statementsIn(source))).map((taken) => taken.type);

const assertionEntryNamesIn = (source: string): readonly string[] =>
  [...boundIn(assertionEntryBindings(), statementsIn(source))].toSorted();

describe("dont-review-it/spec-syntax/test-block-declarations", () => {
  test("a block written with an injected spelling is a test block declaration", () => {
    expect(declaresIn('it("names a behaviour", () => {});')).toBe(true);
    expect(declaresIn('test("names a behaviour", () => {});')).toBe(true);
  });

  test("a block written with a modifier in front of an injected spelling declares the same way", () => {
    expect(declaresIn('it.skip("names a behaviour", () => {});')).toBe(true);
    expect(declaresIn('it.each(rows)("names a behaviour", (row) => {});')).toBe(true);
  });

  test("a grouping block is not a test block declaration", () => {
    expect(declaresIn('describe("names a group", () => {});')).toBe(false);
  });

  test("a call reached through a receiver is not a test block declaration", () => {
    expect(declaresIn('suite.it("names a behaviour", () => {});')).toBe(false);
  });

  test("a fixture factory is not a test block declaration", () => {
    expect(declaresIn("test.extend({ subject: 1 });")).toBe(false);
  });

  test("a renamed import of a block spelling declares under the name it was bound to", () => {
    expect(
      declaresIn('import { it as check } from "vitest";\ncheck("names a behaviour", () => {});'),
    ).toBe(true);
  });

  test("an import written with a quoted export name is read the same way", () => {
    expect(
      declaresIn(
        'import { "test" as check } from "vitest";\ncheck("names a behaviour", () => {});',
      ),
    ).toBe(true);
  });

  test("an import of something other than a block spelling binds no block", () => {
    expect(
      declaresIn('import { expect } from "vitest";\nexpect("names a behaviour", () => {});'),
    ).toBe(false);
  });

  test("a default or namespace import binds no block", () => {
    expect(declaresIn('import runner from "vitest";\nrunner("names a behaviour", () => {});')).toBe(
      false,
    );
    expect(
      declaresIn('import * as runner from "vitest";\nrunner("names a behaviour", () => {});'),
    ).toBe(false);
  });

  test("a local binding of a block spelling declares under its own name", () => {
    expect(declaresIn('const check = it;\ncheck("names a behaviour", () => {});')).toBe(true);
  });

  test("a builder derived from the base declares under the name it was bound to", () => {
    expect(
      declaresIn(
        'const check = test.extend({ subject: 1 });\ncheck("names a behaviour", () => {});',
      ),
    ).toBe(true);
  });

  test("a builder derived from another builder reaches the same base", () => {
    expect(
      declaresIn(
        'const check = test.extend({ port: 1 }).extend({ subject: 2 });\ncheck("names a behaviour", () => {});',
      ),
    ).toBe(true);
  });

  test("a binding taken from a binding that was derived earlier declares the same way", () => {
    expect(
      declaresIn(
        'const base = test.extend({ subject: 1 });\nconst check = base;\ncheck("names a behaviour", () => {});',
      ),
    ).toBe(true);
  });

  test("a member that is not the builder binds no block", () => {
    expect(
      declaresIn(
        'const check = test.override({ subject: 1 });\ncheck("names a behaviour", () => {});',
      ),
    ).toBe(false);
  });

  test("a binding initialised by a plain call binds no block", () => {
    expect(declaresIn('const check = build();\ncheck("names a behaviour", () => {});')).toBe(false);
  });

  test("a binding initialised by a value that is no call binds no block", () => {
    expect(declaresIn('const port = 3000;\nport("names a behaviour", () => {});')).toBe(false);
  });

  test("a binding taken apart from an object binds no block", () => {
    expect(declaresIn('const { it: check } = runner;\ncheck("names a behaviour", () => {});')).toBe(
      false,
    );
  });

  test("a binding declared without an initialiser binds no block", () => {
    expect(declaresIn('let check;\ncheck("names a behaviour", () => {});')).toBe(false);
  });

  test("both function shapes handed to a block are read as its callbacks", () => {
    expect(callbackShapesIn('it("names a behaviour", () => {});')).toStrictEqual([
      "ArrowFunctionExpression",
    ]);
    expect(callbackShapesIn('it("names a behaviour", function () {});')).toStrictEqual([
      "FunctionExpression",
    ]);
  });

  test("a value handed to a block that is no function is no callback", () => {
    expect(callbackShapesIn('it("names a behaviour", 3000);')).toStrictEqual([]);
  });

  test("a function handed through a wrapping call is still the callback", () => {
    expect(callbackShapesIn('it("names a behaviour", withSetup(() => {}));')).toStrictEqual([
      "ArrowFunctionExpression",
    ]);
  });

  test("a callback spread into the block hides itself from this reading", () => {
    expect(callbackShapesIn('it("names a behaviour", ...handlers);')).toStrictEqual([]);
    expect(callbackShapesIn('it("names a behaviour", withSetup(...handlers));')).toStrictEqual([]);
  });

  test("a group written with the injected spelling is a grouping block declaration", () => {
    expect(declaresGroupingIn('describe("names a group", () => {});')).toBe(true);
    expect(declaresGroupingIn('describe.each(rows)("names a group", (row) => {});')).toBe(true);
  });

  test("a test block is not a grouping block declaration", () => {
    expect(declaresGroupingIn('it("names a behaviour", () => {});')).toBe(false);
    expect(declaresGroupingIn('test("names a behaviour", () => {});')).toBe(false);
  });

  test("a renamed import of the grouping spelling declares under the name it was bound to", () => {
    expect(
      declaresGroupingIn(
        'import { describe as group } from "vitest";\ngroup("a group", () => {});',
      ),
    ).toBe(true);
  });

  test("a local binding of the grouping spelling declares under its own name", () => {
    expect(declaresGroupingIn('const group = describe;\ngroup("a group", () => {});')).toBe(true);
  });

  test("the injected assertion entry stands under its own spelling", () => {
    expect(assertionEntryNamesIn("const port = 3000;")).toStrictEqual(["expect"]);
  });

  test("a renamed import of the assertion entry stands under the name it was bound to", () => {
    expect(assertionEntryNamesIn('import { expect as assertThat } from "vitest";')).toStrictEqual([
      "assertThat",
      "expect",
    ]);
  });

  test("a local binding of the assertion entry stands under its own name", () => {
    expect(assertionEntryNamesIn("const assertThat = expect;")).toStrictEqual([
      "assertThat",
      "expect",
    ]);
  });

  test("a test block spelling binds no assertion entry", () => {
    expect(assertionEntryNamesIn("const check = it;")).toStrictEqual(["expect"]);
  });

  test("a name written out as a string is a spelled title", () => {
    expect(titleSpelledIn('it("names a behaviour", () => {});')).toBe(true);
  });

  test("a name assembled by a template is a spelled title", () => {
    expect(titleSpelledIn("it(`names ${behaviour}`, () => {});")).toBe(true);
  });

  test("a name that is no string leaves the block without a spelled title", () => {
    expect(titleSpelledIn("it(3000, () => {});")).toBe(false);
    expect(titleSpelledIn("it(behaviour, () => {});")).toBe(false);
  });

  test("a block opening with its callback carries no spelled title", () => {
    expect(titleSpelledIn("it(() => {});")).toBe(false);
  });

  test("a block whose first argument is spread carries no spelled title", () => {
    expect(titleSpelledIn("it(...declaration);")).toBe(false);
  });

  test("a block handed nothing carries no spelled title", () => {
    expect(titleSpelledIn("it();")).toBe(false);
  });

  test("a named block hands over the function that carries its body", () => {
    expect(bodyShapeIn('it("names a behaviour", () => {});')).toBe("ArrowFunctionExpression");
    expect(bodyShapeIn('it("names a behaviour", function () {});')).toBe("FunctionExpression");
  });

  test("a body written behind an options object is still the body", () => {
    expect(bodyShapeIn('it("names a behaviour", { retry: 2 }, () => {}, 1000);')).toBe(
      "ArrowFunctionExpression",
    );
  });

  test("a body reached through a derived builder is read the same way", () => {
    expect(
      bodyShapeIn('const check = test.extend({ subject: 1 });\ncheck("a behaviour", () => {});'),
    ).toBe("ArrowFunctionExpression");
  });

  test("a block handed no callback hands over no body", () => {
    expect(bodyShapeIn('it("names a behaviour");')).toBe(null);
  });

  test("a block without a spelled title hands over no body", () => {
    expect(bodyShapeIn("it(() => {});")).toBe(null);
  });

  test("a call that declares no test block hands over no body", () => {
    expect(bodyShapeIn('describe("names a group", () => {});')).toBe(null);
  });
});
