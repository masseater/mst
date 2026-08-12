import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { staticCalleeName, staticMemberName, staticPropertyName } from "./static-names.ts";

import type { ESTree } from "@oxlint/plugins";

const firstStatementIn = (sourceText: string): ESTree.Statement =>
  parseSync("spec.ts", sourceText).program.body[0] as ESTree.Statement;

const memberIn = (sourceText: string): ESTree.MemberExpression =>
  (firstStatementIn(sourceText) as ESTree.ExpressionStatement)
    .expression as ESTree.MemberExpression;

const firstPropertyIn = (objectSource: string): ESTree.ObjectProperty => {
  const declared = firstStatementIn(`const written = ${objectSource};`);
  const [declarator] = (declared as ESTree.VariableDeclaration).declarations;
  if (declarator === undefined) throw new Error(`nothing is declared by: ${objectSource}`);

  const holder = declarator.init as ESTree.ObjectExpression;
  const [property] = holder.properties;
  return property as ESTree.ObjectProperty;
};

const callIn = (sourceText: string): ESTree.CallExpression =>
  (firstStatementIn(sourceText) as ESTree.ExpressionStatement).expression as ESTree.CallExpression;

describe("spec-syntax/static-names", () => {
  test("a member written with a dot spells its name", () => {
    expect(staticMemberName(memberIn("it.skip"))).toBe("skip");
  });

  test("a member written as a string subscript spells the same name", () => {
    expect(staticMemberName(memberIn('it["skip"]'))).toBe("skip");
  });

  test("a member written as a template subscript without a substitution spells the same name", () => {
    expect(staticMemberName(memberIn("it[`skip`]"))).toBe("skip");
  });

  test("a member chosen through a binding spells no name the source can be read for", () => {
    expect(staticMemberName(memberIn("it[modifier]"))).toBe(null);
  });

  test("a member chosen through a template with a substitution spells no readable name", () => {
    expect(staticMemberName(memberIn("it[`ski${tail}`]"))).toBe(null);
  });

  test("a member subscripted by a number spells no name this reading can use", () => {
    expect(staticMemberName(memberIn("rows[0]"))).toBe(null);
  });

  test("a private field stays distinct from a public member of the same spelling", () => {
    const declared = firstStatementIn("class Suite { #skip = 1; read() { return this.#skip; } }");
    const [, method] = (declared as ESTree.Class).body.body;
    const writtenBody = (method as ESTree.MethodDefinition).value.body as ESTree.FunctionBody;
    const [returned] = writtenBody.body;
    const read = (returned as ESTree.ReturnStatement).argument as ESTree.MemberExpression;

    expect(staticMemberName(read)).toBe(null);
  });

  test("a shorthand property spells the name it binds", () => {
    expect(staticPropertyName(firstPropertyIn("{ subject }"))).toBe("subject");
  });

  test("a property key written as a string spells that name", () => {
    expect(staticPropertyName(firstPropertyIn('{ "subject": 1 }'))).toBe("subject");
  });

  test("a property key written as a template without a substitution spells that name", () => {
    expect(staticPropertyName(firstPropertyIn("{ [`subject`]: 1 }"))).toBe("subject");
  });

  test("a property key computed from a binding spells no readable name", () => {
    expect(staticPropertyName(firstPropertyIn("{ [chosen]: 1 }"))).toBe(null);
  });

  test("a property key written as a number spells no name this reading can use", () => {
    expect(staticPropertyName(firstPropertyIn("{ 1: 'first' }"))).toBe(null);
  });

  test("a call on a bare binding spells the name of that binding", () => {
    expect(staticCalleeName(callIn("scopeHandlers(run)"))).toBe("scopeHandlers");
  });

  test("a call on a member spells the name of that member", () => {
    expect(staticCalleeName(callIn("server.boundary(run)"))).toBe("boundary");
  });

  test("a type assertion around the callee is stripped before the name is spelled", () => {
    expect(staticCalleeName(callIn("(server.boundary as Scoping)(run)"))).toBe("boundary");
  });

  test("a call on a member chosen through a binding spells no readable name", () => {
    expect(staticCalleeName(callIn("server[chosen](run)"))).toBe(null);
  });

  test("a call on an expression that is neither a binding nor a member spells no name", () => {
    expect(staticCalleeName(callIn("(() => run)()(run)"))).toBe(null);
  });
});
