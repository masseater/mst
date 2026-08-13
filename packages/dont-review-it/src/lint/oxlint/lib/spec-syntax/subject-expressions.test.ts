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

describe("asSpecFunction", () => {
  describe("an arrow written where a spec body belongs", () => {
    const it = test.extend("specFunctionOfAnArrowWrittenWhereASpecBodyBelongs", () => {
      const declared = parseSync("spec.ts", "const written = () => runSut();").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const initializer = declarator?.init ?? null;
      return initializer !== null && asSpecFunction(initializer) === initializer;
    });

    it("is that spec's function", ({ specFunctionOfAnArrowWrittenWhereASpecBodyBelongs }) => {
      expect(specFunctionOfAnArrowWrittenWhereASpecBodyBelongs).toBe(true);
    });
  });

  describe("a function expression written where a spec body belongs", () => {
    const it = test.extend("specFunctionOfAFunctionExpressionWrittenWhereASpecBodyBelongs", () => {
      const declared = parseSync("spec.ts", "const written = function () { return runSut(); };")
        .program.body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const initializer = declarator?.init ?? null;
      return initializer !== null && asSpecFunction(initializer) === initializer;
    });

    it("is that spec's function", ({
      specFunctionOfAFunctionExpressionWrittenWhereASpecBodyBelongs,
    }) => {
      expect(specFunctionOfAFunctionExpressionWrittenWhereASpecBodyBelongs).toBe(true);
    });
  });

  describe("an annotation around a spec body", () => {
    const it = test.extend("specFunctionOfAnAnnotatedSpecBody", () => {
      const declared = parseSync("spec.ts", "const written = (() => runSut()) as SpecBody;").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const initializer = declarator?.init ?? null;
      return initializer !== null && asSpecFunction(initializer) === unwrapSubject(initializer);
    });

    it("does not change which function it is", ({ specFunctionOfAnAnnotatedSpecBody }) => {
      expect(specFunctionOfAnAnnotatedSpecBody).toBe(true);
    });
  });

  describe("an expression that produces no function", () => {
    const it = test.extend("specFunctionOfAnExpressionProducingNoFunction", () => {
      const declared = parseSync("spec.ts", "const written = runSut();").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const initializer = declarator?.init ?? null;
      return initializer === null ? null : asSpecFunction(initializer);
    });

    it("is not a spec body", ({ specFunctionOfAnExpressionProducingNoFunction }) => {
      expect(specFunctionOfAnExpressionProducingNoFunction).toBe(null);
    });
  });
});

describe("returnedExpressionsOf", () => {
  describe("a return written in an else branch", () => {
    const it = test.extend("returnsFromAnElseBranch", () => {
      const statement = parseSync(
        "spec.ts",
        "((flag) => { if (flag) { return runSut(); } else { return null; } });",
      ).program.body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null
        ? null
        : returnedExpressionsOf(factory).map((returned) => returned.type);
    });

    it("is still the function's own return", ({ returnsFromAnElseBranch }) => {
      expect(returnsFromAnElseBranch).toStrictEqual(["CallExpression", "Literal"]);
    });
  });

  describe("a concise arrow", () => {
    const it = test.extend("returnSpellingsOfAConciseArrow", () => {
      const statement = parseSync("spec.ts", "(() => ({ status: 200 }));").program
        .body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null
        ? null
        : returnedExpressionsOf(factory).map((returned) => returned.type);
    });

    it("hands back the expression written as its body", ({ returnSpellingsOfAConciseArrow }) => {
      expect(returnSpellingsOfAConciseArrow).toStrictEqual(["ParenthesizedExpression"]);
    });
  });

  describe("a block body", () => {
    const it = test.extend("returnSpellingsOfABlockBody", () => {
      const statement = parseSync(
        "spec.ts",
        "((flag) => { if (flag) { return runSut(); } return null; });",
      ).program.body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null
        ? null
        : returnedExpressionsOf(factory).map((returned) => returned.type);
    });

    it("hands back what each of its own return statements names", ({
      returnSpellingsOfABlockBody,
    }) => {
      expect(returnSpellingsOfABlockBody).toStrictEqual(["CallExpression", "Literal"]);
    });
  });

  describe("a return written inside a catch clause", () => {
    const it = test.extend("returnSpellingsOfAReturnInsideACatchClause", () => {
      const statement = parseSync(
        "spec.ts",
        "(() => { try { runSut(); } catch (thrown) { return thrown; } return null; });",
      ).program.body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null
        ? null
        : returnedExpressionsOf(factory).map((returned) => returned.type);
    });

    it("is still the function's own return", ({ returnSpellingsOfAReturnInsideACatchClause }) => {
      expect(returnSpellingsOfAReturnInsideACatchClause).toStrictEqual(["Identifier", "Literal"]);
    });
  });

  describe("a return written inside a loop or a switch", () => {
    const it = test.extend("returnSpellingsOfAReturnInsideALoopAroundASwitch", () => {
      const statement = parseSync(
        "spec.ts",
        "((rows) => { for (const row of rows) { switch (row) { case 1: return runSut(); } } return null; });",
      ).program.body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null
        ? null
        : returnedExpressionsOf(factory).map((returned) => returned.type);
    });

    it("is still the function's own return", ({
      returnSpellingsOfAReturnInsideALoopAroundASwitch,
    }) => {
      expect(returnSpellingsOfAReturnInsideALoopAroundASwitch).toStrictEqual([
        "CallExpression",
        "Literal",
      ]);
    });
  });

  describe("a return written inside a nested function", () => {
    const it = test.extend("returnSpellingsOfAReturnInsideANestedFunction", () => {
      const statement = parseSync(
        "spec.ts",
        "(() => { const inner = () => { return runSut(); }; return inner; });",
      ).program.body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null
        ? null
        : returnedExpressionsOf(factory).map((returned) => returned.type);
    });

    it("belongs to that function, not this one", ({
      returnSpellingsOfAReturnInsideANestedFunction,
    }) => {
      expect(returnSpellingsOfAReturnInsideANestedFunction).toStrictEqual(["Identifier"]);
    });
  });

  describe("a function declared without a body", () => {
    const it = test.extend("returnsOfAFunctionWithoutABody", () => {
      const declared = parseSync("spec.ts", "declare function held(): Report;").program
        .body[0] as ESTree.Statement;
      return declared.type !== "TSDeclareFunction" ? null : returnedExpressionsOf(declared);
    });

    it("hands back nothing", ({ returnsOfAFunctionWithoutABody }) => {
      expect(returnsOfAFunctionWithoutABody).toStrictEqual([]);
    });
  });

  describe("a condition written with both branches", () => {
    const it = test.extend("returnsFromBothBranchesOfACondition", () => {
      const statement = parseSync(
        "spec.ts",
        "(() => { if (ok) { return runSut(); } else { return runOther(); } });",
      ).program.body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null
        ? null
        : returnedExpressionsOf(factory).map((returned) => returned.type);
    });

    it("hands back what each branch returns", ({ returnsFromBothBranchesOfACondition }) => {
      expect(returnsFromBothBranchesOfACondition).toStrictEqual([
        "CallExpression",
        "CallExpression",
      ]);
    });
  });
});

describe("argumentsPassedTo", () => {
  describe("a factory written without a block body", () => {
    const it = test.extend("argumentsHandedToAHandoffInAFactoryWithoutABlockBody", () => {
      const statement = parseSync("spec.ts", "((held, use) => use(runSut()));").program
        .body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null
        ? null
        : argumentsPassedTo(factory, "use").map((handed) => handed.type);
    });

    it("has no statement that hands anything over", ({
      argumentsHandedToAHandoffInAFactoryWithoutABlockBody,
    }) => {
      expect(argumentsHandedToAHandoffInAFactoryWithoutABlockBody).toStrictEqual([]);
    });
  });

  describe("a handoff written with a spread", () => {
    const it = test.extend("argumentsHandedToAHandoffWrittenWithASpread", () => {
      const statement = parseSync("spec.ts", "((held, use) => { use(...produced()); });").program
        .body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null
        ? null
        : argumentsPassedTo(factory, "use").map((handed) => handed.type);
    });

    it("hands over nothing this reading can name", ({
      argumentsHandedToAHandoffWrittenWithASpread,
    }) => {
      expect(argumentsHandedToAHandoffWrittenWithASpread).toStrictEqual([]);
    });
  });

  describe("a function that hands its subject to a named callback", () => {
    const it = test.extend("handoffSpellingsOfAFunctionNamingItsArgument", () => {
      const statement = parseSync(
        "spec.ts",
        "(async ({ port }, use) => { await use(await runSut(port)); });",
      ).program.body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null
        ? null
        : argumentsPassedTo(factory, "use").map((handed) => handed.type);
    });

    it("names that argument", ({ handoffSpellingsOfAFunctionNamingItsArgument }) => {
      expect(handoffSpellingsOfAFunctionNamingItsArgument).toStrictEqual(["AwaitExpression"]);
    });
  });

  describe("a handoff written inside a try block", () => {
    const it = test.extend("handoffSpellingsOfAHandoffInsideATryBlock", () => {
      const statement = parseSync(
        "spec.ts",
        "(async ({}, use) => { try { await use(runSut()); } finally { close(); } });",
      ).program.body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null
        ? null
        : argumentsPassedTo(factory, "use").map((handed) => handed.type);
    });

    it("is still a handoff", ({ handoffSpellingsOfAHandoffInsideATryBlock }) => {
      expect(handoffSpellingsOfAHandoffInsideATryBlock).toStrictEqual(["CallExpression"]);
    });
  });

  describe("a call to a different name", () => {
    const it = test.extend("handoffSpellingsOfACallToADifferentName", () => {
      const statement = parseSync("spec.ts", "(async ({}, use) => { await report(runSut()); });")
        .program.body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null
        ? null
        : argumentsPassedTo(factory, "use").map((handed) => handed.type);
    });

    it("is not a handoff", ({ handoffSpellingsOfACallToADifferentName }) => {
      expect(handoffSpellingsOfACallToADifferentName).toStrictEqual([]);
    });
  });

  describe("a handoff written inside a nested callback", () => {
    const it = test.extend("handoffSpellingsOfAHandoffInsideANestedCallback", () => {
      const statement = parseSync(
        "spec.ts",
        "(async ({}, use) => { rows.forEach(() => { use(runSut()); }); });",
      ).program.body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null
        ? null
        : argumentsPassedTo(factory, "use").map((handed) => handed.type);
    });

    it("belongs to that callback", ({ handoffSpellingsOfAHandoffInsideANestedCallback }) => {
      expect(handoffSpellingsOfAHandoffInsideANestedCallback).toStrictEqual([]);
    });
  });

  describe("a statement that calls nothing", () => {
    const it = test.extend("argumentsHandedToTheHandoffAroundAPlainStatement", () => {
      const statement = parseSync("spec.ts", "((held, use) => { held; use(runSut()); });").program
        .body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null
        ? null
        : argumentsPassedTo(factory, "use").map((handed) => handed.type);
    });

    it("hands no argument to the handoff", ({
      argumentsHandedToTheHandoffAroundAPlainStatement,
    }) => {
      expect(argumentsHandedToTheHandoffAroundAPlainStatement).toStrictEqual(["CallExpression"]);
    });
  });

  describe("a handoff call carrying nothing", () => {
    const it = test.extend("argumentsHandedToAHandoffCallCarryingNothing", () => {
      const statement = parseSync("spec.ts", "((held, use) => { use(); });").program
        .body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null
        ? null
        : argumentsPassedTo(factory, "use").map((handed) => handed.type);
    });

    it("hands over no argument", ({ argumentsHandedToAHandoffCallCarryingNothing }) => {
      expect(argumentsHandedToAHandoffCallCarryingNothing).toStrictEqual([]);
    });
  });
});

describe("unwrapSubject", () => {
  describe("a call, written plainly and written under an assertion", () => {
    const it = test
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
      });

    it("is already the expression that produced the subject when written plainly", ({
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

    it("is left unchanged by a type assertion around it", ({
      subjectOfACallInsideATypeAssertion,
      subjectOfAPlainCall,
    }) => {
      expect(subjectOfACallInsideATypeAssertion).toStrictEqual(subjectOfAPlainCall);
    });

    it("is left unchanged by a non-null assertion around it", ({
      subjectOfACallInsideANonNullAssertion,
      subjectOfAPlainCall,
    }) => {
      expect(subjectOfACallInsideANonNullAssertion).toStrictEqual(subjectOfAPlainCall);
    });
  });

  describe("an awaited subject", () => {
    const it = test.extend("unwrappedReturnSpellingsOfAnAwaitedSubject", () => {
      const statement = parseSync("spec.ts", "(async () => await runSut());").program
        .body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null
        ? null
        : returnedExpressionsOf(factory).map((returned) => unwrapSubject(returned).type);
    });

    it("is left unchanged by the await around it", ({
      unwrappedReturnSpellingsOfAnAwaitedSubject,
    }) => {
      expect(unwrappedReturnSpellingsOfAnAwaitedSubject).toStrictEqual(["CallExpression"]);
    });
  });

  describe("a parenthesised subject", () => {
    const it = test.extend("unwrappedReturnSpellingsOfAParenthesisedSubject", () => {
      const statement = parseSync("spec.ts", "(() => ({ status: 200 }));").program
        .body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null
        ? null
        : returnedExpressionsOf(factory).map((returned) => unwrapSubject(returned).type);
    });

    it("is left unchanged by the parentheses around it", ({
      unwrappedReturnSpellingsOfAParenthesisedSubject,
    }) => {
      expect(unwrappedReturnSpellingsOfAParenthesisedSubject).toStrictEqual(["ObjectExpression"]);
    });
  });
});

describe("localConstInitializer", () => {
  describe("a single const in the body", () => {
    const it = test.extend("initializerOfASingleConstInTheBody", () => {
      const statement = parseSync("spec.ts", "(() => { const caught = runSut(); return caught; });")
        .program.body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      const body = factory === null ? null : blockBodyOf(factory);
      return body === null ? null : localConstInitializer(body, "caught");
    });

    it("is the initializer that name stands for", ({ initializerOfASingleConstInTheBody }) => {
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
  });

  describe("a name declared with let", () => {
    const it = test.extend("initializerOfANameDeclaredWithLet", () => {
      const statement = parseSync("spec.ts", "(() => { let caught = runSut(); return caught; });")
        .program.body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      const body = factory === null ? null : blockBodyOf(factory);
      return body === null ? null : localConstInitializer(body, "caught");
    });

    it("is not a name this reading resolves", ({ initializerOfANameDeclaredWithLet }) => {
      expect(initializerOfANameDeclaredWithLet).toBe(null);
    });
  });

  describe("a name declared by destructuring", () => {
    const it = test.extend("initializerOfANameDeclaredByDestructuring", () => {
      const statement = parseSync(
        "spec.ts",
        "(() => { const { caught } = runSut(); return caught; });",
      ).program.body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      const body = factory === null ? null : blockBodyOf(factory);
      return body === null ? null : localConstInitializer(body, "caught");
    });

    it("is not a name this reading resolves", ({ initializerOfANameDeclaredByDestructuring }) => {
      expect(initializerOfANameDeclaredByDestructuring).toBe(null);
    });
  });

  describe("a name that no const in the body declares", () => {
    const it = test.extend("initializerOfANameNoConstInTheBodyDeclares", () => {
      const statement = parseSync("spec.ts", "(() => { const caught = runSut(); return caught; });")
        .program.body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      const body = factory === null ? null : blockBodyOf(factory);
      return body === null ? null : localConstInitializer(body, "other");
    });

    it("stands for nothing here", ({ initializerOfANameNoConstInTheBodyDeclares }) => {
      expect(initializerOfANameNoConstInTheBodyDeclares).toBe(null);
    });
  });
});

describe("blockBodyOf", () => {
  describe("a concise arrow", () => {
    const it = test.extend("blockBodyOfAConciseArrow", () => {
      const statement = parseSync("spec.ts", "(() => runSut());").program
        .body[0] as ESTree.ExpressionStatement;
      const factory = asSpecFunction(statement.expression);
      return factory === null ? null : blockBodyOf(factory);
    });

    it("has no block body to read names out of", ({ blockBodyOfAConciseArrow }) => {
      expect(blockBodyOfAConciseArrow).toBe(null);
    });
  });
});

describe("memberRootOf", () => {
  describe("a bare name", () => {
    const it = test.extend("memberRootOfABareName", () => {
      const declared = parseSync("spec.ts", "const written = caught;").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const initializer = declarator?.init ?? null;
      return initializer === null ? null : memberRootOf(initializer);
    });

    it("is the root its own reading starts from", ({ memberRootOfABareName }) => {
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
  });

  describe("a chain of member reads", () => {
    const it = test.extend("memberRootOfAChainOfMemberReads", () => {
      const declared = parseSync("spec.ts", "const written = caught.result!.stdout;").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const initializer = declarator?.init ?? null;
      return initializer === null ? null : memberRootOf(initializer);
    });

    it("is rooted at the name it starts from", ({ memberRootOfAChainOfMemberReads }) => {
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
  });

  describe("a chain of optional member reads", () => {
    const it = test.extend("memberRootOfAChainOfOptionalMemberReads", () => {
      const declared = parseSync("spec.ts", "const written = caught?.result.stdout;").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const initializer = declarator?.init ?? null;
      return initializer === null ? null : memberRootOf(initializer)?.name;
    });

    it("is rooted at the name it starts from", ({ memberRootOfAChainOfOptionalMemberReads }) => {
      expect(memberRootOfAChainOfOptionalMemberReads).toBe("caught");
    });
  });

  describe("a member read taken straight off a call", () => {
    const it = test.extend("memberRootOfAMemberReadTakenOffACall", () => {
      const declared = parseSync("spec.ts", "const written = runSut().stdout;").program
        .body[0] as ESTree.VariableDeclaration;
      const [declarator] = declared.declarations;
      const initializer = declarator?.init ?? null;
      return initializer === null ? null : memberRootOf(initializer);
    });

    it("has no name at its root", ({ memberRootOfAMemberReadTakenOffACall }) => {
      expect(memberRootOfAMemberReadTakenOffACall).toBe(null);
    });
  });
});
