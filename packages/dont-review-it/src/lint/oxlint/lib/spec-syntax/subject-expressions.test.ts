import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  argumentsPassedTo,
  asSpecFunction,
  blockBodyOf,
  localConstInitializer,
  memberRootOf,
  returnedExpressionsOf,
  unwrapSubject,
} from "./subject-expressions.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("returnsOfAFunctionWithoutABody", () => {
    const declared = parseSync("spec.ts", "declare function held(): Report;").program
      .body[0] as ESTree.Statement;
    return declared.type !== "TSDeclareFunction" ? null : returnedExpressionsOf(declared);
  })
  .extend("returnsFromBothBranchesOfACondition", () => {
    const statement = parseSync(
      "spec.ts",
      "(() => { if (ok) { return runSut(); } else { return runOther(); } });",
    ).program.body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    return factory === null
      ? null
      : returnedExpressionsOf(factory).map((returned) => returned.type);
  })
  .extend("argumentsHandedToTheHandoffAroundAPlainStatement", () => {
    const statement = parseSync("spec.ts", "((held, use) => { held; use(runSut()); });").program
      .body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    return factory === null ? null : argumentsPassedTo(factory, "use").map((handed) => handed.type);
  })
  .extend("argumentsHandedToAHandoffCallCarryingNothing", () => {
    const statement = parseSync("spec.ts", "((held, use) => { use(); });").program
      .body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    return factory === null ? null : argumentsPassedTo(factory, "use").map((handed) => handed.type);
  })
  .extend("subjectOfAPlainCall", () => {
    const declared = parseSync("spec.ts", "const written = runSut();").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const initializer = declarator?.init ?? null;
    return initializer === null ? null : unwrapSubject(initializer);
  })
  .extend("subjectOfACallInsideATypeAssertion", () => {
    const declared = parseSync("spec.ts", "const written = runSut() as Report;").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const initializer = declarator?.init ?? null;
    return initializer === null ? null : unwrapSubject(initializer);
  })
  .extend("subjectOfACallInsideANonNullAssertion", () => {
    const declared = parseSync("spec.ts", "const written = runSut()!;").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const initializer = declarator?.init ?? null;
    return initializer === null ? null : unwrapSubject(initializer);
  })
  .extend("unwrappedReturnSpellingsOfAnAwaitedSubject", () => {
    const statement = parseSync("spec.ts", "(async () => await runSut());").program
      .body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    return factory === null
      ? null
      : returnedExpressionsOf(factory).map((returned) => unwrapSubject(returned).type);
  })
  .extend("returnSpellingsOfAConciseArrow", () => {
    const statement = parseSync("spec.ts", "(() => ({ status: 200 }));").program
      .body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    return factory === null
      ? null
      : returnedExpressionsOf(factory).map((returned) => returned.type);
  })
  .extend("returnSpellingsOfABlockBody", () => {
    const statement = parseSync(
      "spec.ts",
      "((flag) => { if (flag) { return runSut(); } return null; });",
    ).program.body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    return factory === null
      ? null
      : returnedExpressionsOf(factory).map((returned) => returned.type);
  })
  .extend("returnSpellingsOfAReturnInsideACatchClause", () => {
    const statement = parseSync(
      "spec.ts",
      "(() => { try { runSut(); } catch (thrown) { return thrown; } return null; });",
    ).program.body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    return factory === null
      ? null
      : returnedExpressionsOf(factory).map((returned) => returned.type);
  })
  .extend("returnSpellingsOfAReturnInsideALoopAroundASwitch", () => {
    const statement = parseSync(
      "spec.ts",
      "((rows) => { for (const row of rows) { switch (row) { case 1: return runSut(); } } return null; });",
    ).program.body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    return factory === null
      ? null
      : returnedExpressionsOf(factory).map((returned) => returned.type);
  })
  .extend("returnSpellingsOfAReturnInsideANestedFunction", () => {
    const statement = parseSync(
      "spec.ts",
      "(() => { const inner = () => { return runSut(); }; return inner; });",
    ).program.body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    return factory === null
      ? null
      : returnedExpressionsOf(factory).map((returned) => returned.type);
  })
  .extend("handoffSpellingsOfAFunctionNamingItsArgument", () => {
    const statement = parseSync(
      "spec.ts",
      "(async ({ port }, use) => { await use(await runSut(port)); });",
    ).program.body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    return factory === null ? null : argumentsPassedTo(factory, "use").map((handed) => handed.type);
  })
  .extend("handoffSpellingsOfAHandoffInsideATryBlock", () => {
    const statement = parseSync(
      "spec.ts",
      "(async ({}, use) => { try { await use(runSut()); } finally { close(); } });",
    ).program.body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    return factory === null ? null : argumentsPassedTo(factory, "use").map((handed) => handed.type);
  })
  .extend("handoffSpellingsOfACallToADifferentName", () => {
    const statement = parseSync("spec.ts", "(async ({}, use) => { await report(runSut()); });")
      .program.body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    return factory === null ? null : argumentsPassedTo(factory, "use").map((handed) => handed.type);
  })
  .extend("handoffSpellingsOfAHandoffInsideANestedCallback", () => {
    const statement = parseSync(
      "spec.ts",
      "(async ({}, use) => { rows.forEach(() => { use(runSut()); }); });",
    ).program.body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    return factory === null ? null : argumentsPassedTo(factory, "use").map((handed) => handed.type);
  })
  .extend("initializerOfASingleConstInTheBody", () => {
    const statement = parseSync("spec.ts", "(() => { const caught = runSut(); return caught; });")
      .program.body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    const body = factory === null ? null : blockBodyOf(factory);
    return body === null ? null : localConstInitializer(body, "caught");
  })
  .extend("initializerOfANameDeclaredWithLet", () => {
    const statement = parseSync("spec.ts", "(() => { let caught = runSut(); return caught; });")
      .program.body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    const body = factory === null ? null : blockBodyOf(factory);
    return body === null ? null : localConstInitializer(body, "caught");
  })
  .extend("initializerOfANameDeclaredByDestructuring", () => {
    const statement = parseSync(
      "spec.ts",
      "(() => { const { caught } = runSut(); return caught; });",
    ).program.body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    const body = factory === null ? null : blockBodyOf(factory);
    return body === null ? null : localConstInitializer(body, "caught");
  })
  .extend("initializerOfANameNoConstInTheBodyDeclares", () => {
    const statement = parseSync("spec.ts", "(() => { const caught = runSut(); return caught; });")
      .program.body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    const body = factory === null ? null : blockBodyOf(factory);
    return body === null ? null : localConstInitializer(body, "other");
  })
  .extend("blockBodyOfAConciseArrow", () => {
    const statement = parseSync("spec.ts", "(() => runSut());").program
      .body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    return factory === null ? null : blockBodyOf(factory);
  })
  .extend("unwrappedReturnSpellingsOfAParenthesisedSubject", () => {
    const statement = parseSync("spec.ts", "(() => ({ status: 200 }));").program
      .body[0] as ESTree.ExpressionStatement;
    const factory = asSpecFunction(statement.expression);
    return factory === null
      ? null
      : returnedExpressionsOf(factory).map((returned) => unwrapSubject(returned).type);
  })
  .extend("memberRootOfABareName", () => {
    const declared = parseSync("spec.ts", "const written = caught;").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const initializer = declarator?.init ?? null;
    return initializer === null ? null : memberRootOf(initializer);
  })
  .extend("memberRootOfAChainOfMemberReads", () => {
    const declared = parseSync("spec.ts", "const written = caught.result!.stdout;").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const initializer = declarator?.init ?? null;
    return initializer === null ? null : memberRootOf(initializer);
  })
  .extend("memberRootOfAMemberReadTakenOffACall", () => {
    const declared = parseSync("spec.ts", "const written = runSut().stdout;").program
      .body[0] as ESTree.VariableDeclaration;
    const [declarator] = declared.declarations;
    const initializer = declarator?.init ?? null;
    return initializer === null ? null : memberRootOf(initializer);
  });

describe("subject-expressions", () => {
  it("a plain expression is already the expression that produced the subject", ({
    subjectOfAPlainCall,
  }) => {
    expect(subjectOfAPlainCall).toStrictEqual({
      type: "CallExpression",
      start: 16,
      end: 24,
      callee: {
        type: "Identifier",
        start: 16,
        end: 22,
        decorators: [],
        name: "runSut",
        optional: false,
        typeAnnotation: null,
      },
      typeArguments: null,
      arguments: [],
      optional: false,
    });
  });

  it("a type assertion around a subject does not change what produced it", ({
    subjectOfACallInsideATypeAssertion,
    subjectOfAPlainCall,
  }) => {
    expect(subjectOfACallInsideATypeAssertion).toStrictEqual(subjectOfAPlainCall);
  });

  it("a non-null assertion around a subject does not change what produced it", ({
    subjectOfACallInsideANonNullAssertion,
    subjectOfAPlainCall,
  }) => {
    expect(subjectOfACallInsideANonNullAssertion).toStrictEqual(subjectOfAPlainCall);
  });

  it("awaiting a subject does not change what produced it", ({
    unwrappedReturnSpellingsOfAnAwaitedSubject,
  }) => {
    expect(unwrappedReturnSpellingsOfAnAwaitedSubject).toStrictEqual(["CallExpression"]);
  });

  it("a concise arrow hands back the expression written as its body", ({
    returnSpellingsOfAConciseArrow,
  }) => {
    expect(returnSpellingsOfAConciseArrow).toStrictEqual(["ParenthesizedExpression"]);
  });

  it("a block body hands back what each of its own return statements names", ({
    returnSpellingsOfABlockBody,
  }) => {
    expect(returnSpellingsOfABlockBody).toStrictEqual(["CallExpression", "Literal"]);
  });

  it("a return written inside a catch clause is still the function's own return", ({
    returnSpellingsOfAReturnInsideACatchClause,
  }) => {
    expect(returnSpellingsOfAReturnInsideACatchClause).toStrictEqual(["Identifier", "Literal"]);
  });

  it("a return written inside a loop or a switch is still the function's own return", ({
    returnSpellingsOfAReturnInsideALoopAroundASwitch,
  }) => {
    expect(returnSpellingsOfAReturnInsideALoopAroundASwitch).toStrictEqual([
      "CallExpression",
      "Literal",
    ]);
  });

  it("a return written inside a nested function belongs to that function, not this one", ({
    returnSpellingsOfAReturnInsideANestedFunction,
  }) => {
    expect(returnSpellingsOfAReturnInsideANestedFunction).toStrictEqual(["Identifier"]);
  });

  it("a function that hands its subject to a named callback names that argument", ({
    handoffSpellingsOfAFunctionNamingItsArgument,
  }) => {
    expect(handoffSpellingsOfAFunctionNamingItsArgument).toStrictEqual(["AwaitExpression"]);
  });

  it("a handoff written inside a try block is still a handoff", ({
    handoffSpellingsOfAHandoffInsideATryBlock,
  }) => {
    expect(handoffSpellingsOfAHandoffInsideATryBlock).toStrictEqual(["CallExpression"]);
  });

  it("a call to a different name is not a handoff", ({
    handoffSpellingsOfACallToADifferentName,
  }) => {
    expect(handoffSpellingsOfACallToADifferentName).toStrictEqual([]);
  });

  it("a handoff written inside a nested callback belongs to that callback", ({
    handoffSpellingsOfAHandoffInsideANestedCallback,
  }) => {
    expect(handoffSpellingsOfAHandoffInsideANestedCallback).toStrictEqual([]);
  });

  it("a single const in the body is the initializer that name stands for", ({
    initializerOfASingleConstInTheBody,
  }) => {
    expect(initializerOfASingleConstInTheBody).toStrictEqual({
      type: "CallExpression",
      start: 24,
      end: 32,
      callee: {
        type: "Identifier",
        start: 24,
        end: 30,
        decorators: [],
        name: "runSut",
        optional: false,
        typeAnnotation: null,
      },
      typeArguments: null,
      arguments: [],
      optional: false,
    });
  });

  it("a name declared with let is not a name this reading resolves", ({
    initializerOfANameDeclaredWithLet,
  }) => {
    expect(initializerOfANameDeclaredWithLet).toBe(null);
  });

  it("a name declared by destructuring is not a name this reading resolves", ({
    initializerOfANameDeclaredByDestructuring,
  }) => {
    expect(initializerOfANameDeclaredByDestructuring).toBe(null);
  });

  it("a name that no const in the body declares stands for nothing here", ({
    initializerOfANameNoConstInTheBodyDeclares,
  }) => {
    expect(initializerOfANameNoConstInTheBodyDeclares).toBe(null);
  });

  it("a concise arrow has no block body to read names out of", ({ blockBodyOfAConciseArrow }) => {
    expect(blockBodyOfAConciseArrow).toBe(null);
  });

  it("parentheses around a subject do not change what produced it", ({
    unwrappedReturnSpellingsOfAParenthesisedSubject,
  }) => {
    expect(unwrappedReturnSpellingsOfAParenthesisedSubject).toStrictEqual(["ObjectExpression"]);
  });

  it("a bare name is the root its own reading starts from", ({ memberRootOfABareName }) => {
    expect(memberRootOfABareName).toStrictEqual({
      type: "Identifier",
      start: 16,
      end: 22,
      decorators: [],
      name: "caught",
      optional: false,
      typeAnnotation: null,
    });
  });

  it("a chain of member reads is rooted at the name it starts from", ({
    memberRootOfAChainOfMemberReads,
  }) => {
    expect(memberRootOfAChainOfMemberReads).toStrictEqual({
      type: "Identifier",
      start: 16,
      end: 22,
      decorators: [],
      name: "caught",
      optional: false,
      typeAnnotation: null,
    });
  });

  it("a member read taken straight off a call has no name at its root", ({
    memberRootOfAMemberReadTakenOffACall,
  }) => {
    expect(memberRootOfAMemberReadTakenOffACall).toBe(null);
  });

  it("a function declared without a body hands back nothing", ({
    returnsOfAFunctionWithoutABody,
  }) => {
    expect(returnsOfAFunctionWithoutABody).toStrictEqual([]);
  });

  it("a condition written with both branches hands back what each branch returns", ({
    returnsFromBothBranchesOfACondition,
  }) => {
    expect(returnsFromBothBranchesOfACondition).toStrictEqual(["CallExpression", "CallExpression"]);
  });

  it("a statement that calls nothing hands no argument to the handoff", ({
    argumentsHandedToTheHandoffAroundAPlainStatement,
  }) => {
    expect(argumentsHandedToTheHandoffAroundAPlainStatement).toStrictEqual(["CallExpression"]);
  });

  it("a handoff call carrying nothing hands over no argument", ({
    argumentsHandedToAHandoffCallCarryingNothing,
  }) => {
    expect(argumentsHandedToAHandoffCallCarryingNothing).toStrictEqual([]);
  });
});
