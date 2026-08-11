import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  argumentsPassedTo,
  blockBodyOf,
  localConstInitializer,
  memberRootOf,
  returnedExpressionsOf,
  unwrapSubject,
  type SpecFunction,
} from "./subject-expressions.ts";

import type { ESTree } from "@oxlint/plugins";

const firstDeclaredInitializer = (initializerSource: string): ESTree.Expression => {
  const declared = parseSync("spec.ts", `const written = ${initializerSource};`).program
    .body[0] as ESTree.Statement;
  const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
  if (declarator === undefined) throw new Error(`nothing is declared by: ${initializerSource}`);

  return declarator.init as ESTree.Expression;
};

const functionIn = (functionSource: string): SpecFunction =>
  firstDeclaredInitializer(functionSource) as SpecFunction;

const spellingOf = (node: ESTree.Expression): string => node.type;

describe("subject-expressions", () => {
  test("a plain expression is already the expression that produced the subject", () => {
    expect(spellingOf(unwrapSubject(firstDeclaredInitializer("runSut()")))).toBe("CallExpression");
  });

  test("a type assertion around a subject does not change what produced it", () => {
    expect(spellingOf(unwrapSubject(firstDeclaredInitializer("runSut() as Report")))).toBe(
      "CallExpression",
    );
  });

  test("a non-null assertion around a subject does not change what produced it", () => {
    expect(spellingOf(unwrapSubject(firstDeclaredInitializer("runSut()!")))).toBe("CallExpression");
  });

  test("awaiting a subject does not change what produced it", () => {
    const returns = returnedExpressionsOf(functionIn("async () => await runSut()"));

    expect(returns.map((returned) => spellingOf(unwrapSubject(returned)))).toStrictEqual([
      "CallExpression",
    ]);
  });

  test("a concise arrow hands back the expression written as its body", () => {
    const returns = returnedExpressionsOf(functionIn("() => ({ status: 200 })"));

    expect(returns.map(spellingOf)).toStrictEqual(["ParenthesizedExpression"]);
  });

  test("a block body hands back what each of its own return statements names", () => {
    const returns = returnedExpressionsOf(
      functionIn("(flag) => { if (flag) { return runSut(); } return null; }"),
    );

    expect(returns.map(spellingOf)).toStrictEqual(["CallExpression", "Literal"]);
  });

  test("a return written inside a catch clause is still the function's own return", () => {
    const returns = returnedExpressionsOf(
      functionIn("() => { try { runSut(); } catch (thrown) { return thrown; } return null; }"),
    );

    expect(returns.map(spellingOf)).toStrictEqual(["Identifier", "Literal"]);
  });

  test("a return written inside a loop or a switch is still the function's own return", () => {
    const returns = returnedExpressionsOf(
      functionIn(
        "(rows) => { for (const row of rows) { switch (row) { case 1: return runSut(); } } return null; }",
      ),
    );

    expect(returns.map(spellingOf)).toStrictEqual(["CallExpression", "Literal"]);
  });

  test("a return written inside a nested function belongs to that function, not this one", () => {
    const returns = returnedExpressionsOf(
      functionIn("() => { const inner = () => { return runSut(); }; return inner; }"),
    );

    expect(returns.map(spellingOf)).toStrictEqual(["Identifier"]);
  });

  test("a function that hands its subject to a named callback names that argument", () => {
    const handed = argumentsPassedTo(
      functionIn("async ({ port }, use) => { await use(await runSut(port)); }"),
      "use",
    );

    expect(handed.map(spellingOf)).toStrictEqual(["AwaitExpression"]);
  });

  test("a handoff written inside a try block is still a handoff", () => {
    const handed = argumentsPassedTo(
      functionIn("async ({}, use) => { try { await use(runSut()); } finally { close(); } }"),
      "use",
    );

    expect(handed.map(spellingOf)).toStrictEqual(["CallExpression"]);
  });

  test("a call to a different name is not a handoff", () => {
    const handed = argumentsPassedTo(
      functionIn("async ({}, use) => { await report(runSut()); }"),
      "use",
    );

    expect(handed).toStrictEqual([]);
  });

  test("a handoff written inside a nested callback belongs to that callback", () => {
    const handed = argumentsPassedTo(
      functionIn("async ({}, use) => { rows.forEach(() => { use(runSut()); }); }"),
      "use",
    );

    expect(handed).toStrictEqual([]);
  });

  test("a single const in the body is the initializer that name stands for", () => {
    const body = blockBodyOf(functionIn("() => { const caught = runSut(); return caught; }"));
    const initializer = localConstInitializer(body as ESTree.FunctionBody, "caught");

    expect(spellingOf(initializer as ESTree.Expression)).toBe("CallExpression");
  });

  test("a name declared with let is not a name this reading resolves", () => {
    const body = blockBodyOf(functionIn("() => { let caught = runSut(); return caught; }"));

    expect(localConstInitializer(body as ESTree.FunctionBody, "caught")).toBe(null);
  });

  test("a name declared by destructuring is not a name this reading resolves", () => {
    const body = blockBodyOf(functionIn("() => { const { caught } = runSut(); return caught; }"));

    expect(localConstInitializer(body as ESTree.FunctionBody, "caught")).toBe(null);
  });

  test("a name that no const in the body declares stands for nothing here", () => {
    const body = blockBodyOf(functionIn("() => { const caught = runSut(); return caught; }"));

    expect(localConstInitializer(body as ESTree.FunctionBody, "other")).toBe(null);
  });

  test("a concise arrow has no block body to read names out of", () => {
    expect(blockBodyOf(functionIn("() => runSut()"))).toBe(null);
  });

  test("parentheses around a subject do not change what produced it", () => {
    const returns = returnedExpressionsOf(functionIn("() => ({ status: 200 })"));

    expect(returns.map((returned) => spellingOf(unwrapSubject(returned)))).toStrictEqual([
      "ObjectExpression",
    ]);
  });

  test("a bare name is the root its own reading starts from", () => {
    const root = memberRootOf(firstDeclaredInitializer("caught"));

    expect(root?.name).toBe("caught");
  });

  test("a chain of member reads is rooted at the name it starts from", () => {
    const root = memberRootOf(firstDeclaredInitializer("caught.result!.stdout"));

    expect(root?.name).toBe("caught");
  });

  test("a member read taken straight off a call has no name at its root", () => {
    expect(memberRootOf(firstDeclaredInitializer("runSut().stdout"))).toBe(null);
  });
});
