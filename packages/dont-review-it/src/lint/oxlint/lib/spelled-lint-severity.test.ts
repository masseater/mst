import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { spelledSeverityOf } from "./spelled-lint-severity.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("severitiesOfLowerCaseWord", () =>
    parseSync("severity.ts", `const held = "error";`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((initializer) => spelledSeverityOf(initializer)))
  .extend("severitiesOfUpperCaseWord", () =>
    parseSync("severity.ts", `const held = "OFF";`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((initializer) => spelledSeverityOf(initializer)),
  )
  .extend("severitiesOfSilentDigit", () =>
    parseSync("severity.ts", `const held = 0;`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((initializer) => spelledSeverityOf(initializer)),
  )
  .extend("severitiesOfLoudDigit", () =>
    parseSync("severity.ts", `const held = 2;`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((initializer) => spelledSeverityOf(initializer)),
  )
  .extend("severitiesOfNamedConstant", () =>
    parseSync("severity.ts", `const held = LINT_SEVERITY.OFF;`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((initializer) => spelledSeverityOf(initializer)),
  )
  .extend("severitiesAtHeadOfWrittenList", () =>
    parseSync("severity.ts", `const held = ["warn", { max: 1 }];`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((initializer) => spelledSeverityOf(initializer)),
  )
  .extend("severitiesAtHeadOfConstantList", () =>
    parseSync("severity.ts", `const held = [LINT_SEVERITY.ERROR];`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((initializer) => spelledSeverityOf(initializer)),
  )
  .extend("severitiesOfPlainName", () =>
    parseSync("severity.ts", `const held = chosenSeverity;`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((initializer) => spelledSeverityOf(initializer)),
  )
  .extend("severitiesOfBoolean", () =>
    parseSync("severity.ts", `const held = true;`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((initializer) => spelledSeverityOf(initializer)),
  )
  .extend("severitiesOfEmptyList", () =>
    parseSync("severity.ts", `const held = [];`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((initializer) => spelledSeverityOf(initializer)),
  )
  .extend("severitiesOfSpreadList", () =>
    parseSync("severity.ts", `const held = [...carried];`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((initializer) => spelledSeverityOf(initializer)),
  )
  .extend("severitiesOfHoledList", () =>
    parseSync("severity.ts", `const held = [, 1];`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((initializer) => spelledSeverityOf(initializer)),
  )
  .extend("severitiesOfComputedMember", () =>
    parseSync("severity.ts", `const held = carried[chosen];`)
      .program.body.map((parsed) => parsed as ESTree.Statement)
      .flatMap((declared) => (declared.type === "VariableDeclaration" ? declared.declarations : []))
      .flatMap((binding) => (binding.init === null ? [] : [binding.init]))
      .map((initializer) => spelledSeverityOf(initializer)),
  );

describe("spelled-lint-severity", () => {
  it("a severity written as a word is read in lower case", ({ severitiesOfLowerCaseWord }) => {
    expect(severitiesOfLowerCaseWord).toStrictEqual(["error"]);
  });

  it("a severity shouted in upper case is read in lower case too", ({
    severitiesOfUpperCaseWord,
  }) => {
    expect(severitiesOfUpperCaseWord).toStrictEqual(["off"]);
  });

  it("a severity written as the silent digit is read as that digit", ({
    severitiesOfSilentDigit,
  }) => {
    expect(severitiesOfSilentDigit).toStrictEqual(["0"]);
  });

  it("a severity written as the loud digit is read as that digit", ({ severitiesOfLoudDigit }) => {
    expect(severitiesOfLoudDigit).toStrictEqual(["2"]);
  });

  it("a severity written as a named constant is read by its member name", ({
    severitiesOfNamedConstant,
  }) => {
    expect(severitiesOfNamedConstant).toStrictEqual(["off"]);
  });

  it("the head of a written list is the severity that counts", ({
    severitiesAtHeadOfWrittenList,
  }) => {
    expect(severitiesAtHeadOfWrittenList).toStrictEqual(["warn"]);
  });

  it("the head of a list of constants is the severity that counts", ({
    severitiesAtHeadOfConstantList,
  }) => {
    expect(severitiesAtHeadOfConstantList).toStrictEqual(["error"]);
  });

  it("a name spells no severity", ({ severitiesOfPlainName }) => {
    expect(severitiesOfPlainName).toStrictEqual([null]);
  });

  it("a boolean spells no severity", ({ severitiesOfBoolean }) => {
    expect(severitiesOfBoolean).toStrictEqual([null]);
  });

  it("an empty list spells no severity", ({ severitiesOfEmptyList }) => {
    expect(severitiesOfEmptyList).toStrictEqual([null]);
  });

  it("a list opened by a spread spells no severity", ({ severitiesOfSpreadList }) => {
    expect(severitiesOfSpreadList).toStrictEqual([null]);
  });

  it("a list opened by a hole spells no severity", ({ severitiesOfHoledList }) => {
    expect(severitiesOfHoledList).toStrictEqual([null]);
  });

  it("a member reached through a computed key spells no severity", ({
    severitiesOfComputedMember,
  }) => {
    expect(severitiesOfComputedMember).toStrictEqual([null]);
  });
});
