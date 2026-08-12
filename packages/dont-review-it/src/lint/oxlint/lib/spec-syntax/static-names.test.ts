import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { staticCalleeName, staticMemberName, staticPropertyName } from "./static-names.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("nameOfDottedMember", () => {
    const written = parseSync("spec.ts", "it.skip").program.body[0] as ESTree.ExpressionStatement;
    return staticMemberName(written.expression as ESTree.MemberExpression);
  })
  .extend("nameOfStringSubscriptedMember", () => {
    const written = parseSync("spec.ts", 'it["skip"]').program
      .body[0] as ESTree.ExpressionStatement;
    return staticMemberName(written.expression as ESTree.MemberExpression);
  })
  .extend("nameOfTemplateSubscriptedMember", () => {
    const written = parseSync("spec.ts", "it[`skip`]").program
      .body[0] as ESTree.ExpressionStatement;
    return staticMemberName(written.expression as ESTree.MemberExpression);
  })
  .extend("nameOfMemberChosenThroughABinding", () => {
    const written = parseSync("spec.ts", "it[modifier]").program
      .body[0] as ESTree.ExpressionStatement;
    return staticMemberName(written.expression as ESTree.MemberExpression);
  })
  .extend("nameOfMemberChosenThroughASubstitution", () => {
    const written = parseSync("spec.ts", "it[`ski${tail}`]").program
      .body[0] as ESTree.ExpressionStatement;
    return staticMemberName(written.expression as ESTree.MemberExpression);
  })
  .extend("nameOfNumberSubscriptedMember", () => {
    const written = parseSync("spec.ts", "rows[0]").program.body[0] as ESTree.ExpressionStatement;
    return staticMemberName(written.expression as ESTree.MemberExpression);
  })
  .extend("nameOfPrivateField", () => {
    const declared = parseSync(
      "spec.ts",
      "class Suite { #skip = 1; read() { return this.#skip; } }",
    ).program.body[0] as ESTree.Class;
    const [, method] = declared.body.body;
    const body = (method as ESTree.MethodDefinition).value.body as ESTree.FunctionBody;
    const [returned] = body.body;
    const read = (returned as ESTree.ReturnStatement).argument as ESTree.MemberExpression;
    return staticMemberName(read);
  })
  .extend("nameOfShorthandProperty", () => {
    const declared = parseSync("spec.ts", "const written = { subject };").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    const object = declarator.init as ESTree.ObjectExpression;
    return staticPropertyName(object.properties[0] as ESTree.ObjectProperty);
  })
  .extend("nameOfStringKeyedProperty", () => {
    const declared = parseSync("spec.ts", 'const written = { "subject": 1 };').program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    const object = declarator.init as ESTree.ObjectExpression;
    return staticPropertyName(object.properties[0] as ESTree.ObjectProperty);
  })
  .extend("nameOfTemplateKeyedProperty", () => {
    const declared = parseSync("spec.ts", "const written = { [`subject`]: 1 };").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    const object = declarator.init as ESTree.ObjectExpression;
    return staticPropertyName(object.properties[0] as ESTree.ObjectProperty);
  })
  .extend("nameOfComputedKeyedProperty", () => {
    const declared = parseSync("spec.ts", "const written = { [chosen]: 1 };").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    const object = declarator.init as ESTree.ObjectExpression;
    return staticPropertyName(object.properties[0] as ESTree.ObjectProperty);
  })
  .extend("nameOfNumberKeyedProperty", () => {
    const declared = parseSync("spec.ts", "const written = { 1: 'first' };").program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declared.declarations[0] as ESTree.VariableDeclarator;
    const object = declarator.init as ESTree.ObjectExpression;
    return staticPropertyName(object.properties[0] as ESTree.ObjectProperty);
  })
  .extend("nameOfCallOnABareBinding", () => {
    const written = parseSync("spec.ts", "scopeHandlers(run)").program
      .body[0] as ESTree.ExpressionStatement;
    return staticCalleeName(written.expression as ESTree.CallExpression);
  })
  .extend("nameOfCallOnAMember", () => {
    const written = parseSync("spec.ts", "server.boundary(run)").program
      .body[0] as ESTree.ExpressionStatement;
    return staticCalleeName(written.expression as ESTree.CallExpression);
  })
  .extend("nameOfCallUnderATypeAssertion", () => {
    const written = parseSync("spec.ts", "(server.boundary as Scoping)(run)").program
      .body[0] as ESTree.ExpressionStatement;
    return staticCalleeName(written.expression as ESTree.CallExpression);
  })
  .extend("nameOfCallOnASubscriptedMember", () => {
    const written = parseSync("spec.ts", "server[chosen](run)").program
      .body[0] as ESTree.ExpressionStatement;
    return staticCalleeName(written.expression as ESTree.CallExpression);
  })
  .extend("nameOfCallOnAReturnedFunction", () => {
    const written = parseSync("spec.ts", "(() => run)()(run)").program
      .body[0] as ESTree.ExpressionStatement;
    return staticCalleeName(written.expression as ESTree.CallExpression);
  });

describe("spec-syntax/static-names", () => {
  it("a member written with a dot spells its name", ({ nameOfDottedMember }) => {
    expect(nameOfDottedMember).toBe("skip");
  });

  it("a member written as a string subscript spells the same name", ({
    nameOfStringSubscriptedMember,
  }) => {
    expect(nameOfStringSubscriptedMember).toBe("skip");
  });

  it("a member written as a template subscript without a substitution spells the same name", ({
    nameOfTemplateSubscriptedMember,
  }) => {
    expect(nameOfTemplateSubscriptedMember).toBe("skip");
  });

  it("a member chosen through a binding spells no name the source can be read for", ({
    nameOfMemberChosenThroughABinding,
  }) => {
    expect(nameOfMemberChosenThroughABinding).toBe(null);
  });

  it("a member chosen through a template with a substitution spells no readable name", ({
    nameOfMemberChosenThroughASubstitution,
  }) => {
    expect(nameOfMemberChosenThroughASubstitution).toBe(null);
  });

  it("a member subscripted by a number spells no name this reading can use", ({
    nameOfNumberSubscriptedMember,
  }) => {
    expect(nameOfNumberSubscriptedMember).toBe(null);
  });

  it("a private field stays distinct from a public member of the same spelling", ({
    nameOfPrivateField,
  }) => {
    expect(nameOfPrivateField).toBe(null);
  });

  it("a shorthand property spells the name it binds", ({ nameOfShorthandProperty }) => {
    expect(nameOfShorthandProperty).toBe("subject");
  });

  it("a property key written as a string spells that name", ({ nameOfStringKeyedProperty }) => {
    expect(nameOfStringKeyedProperty).toBe("subject");
  });

  it("a property key written as a template without a substitution spells that name", ({
    nameOfTemplateKeyedProperty,
  }) => {
    expect(nameOfTemplateKeyedProperty).toBe("subject");
  });

  it("a property key computed from a binding spells no readable name", ({
    nameOfComputedKeyedProperty,
  }) => {
    expect(nameOfComputedKeyedProperty).toBe(null);
  });

  it("a property key written as a number spells no name this reading can use", ({
    nameOfNumberKeyedProperty,
  }) => {
    expect(nameOfNumberKeyedProperty).toBe(null);
  });

  it("a call on a bare binding spells the name of that binding", ({ nameOfCallOnABareBinding }) => {
    expect(nameOfCallOnABareBinding).toBe("scopeHandlers");
  });

  it("a call on a member spells the name of that member", ({ nameOfCallOnAMember }) => {
    expect(nameOfCallOnAMember).toBe("boundary");
  });

  it("a type assertion around the callee is stripped before the name is spelled", ({
    nameOfCallUnderATypeAssertion,
  }) => {
    expect(nameOfCallUnderATypeAssertion).toBe("boundary");
  });

  it("a call on a member chosen through a binding spells no readable name", ({
    nameOfCallOnASubscriptedMember,
  }) => {
    expect(nameOfCallOnASubscriptedMember).toBe(null);
  });

  it("a call on an expression that is neither a binding nor a member spells no name", ({
    nameOfCallOnAReturnedFunction,
  }) => {
    expect(nameOfCallOnAReturnedFunction).toBe(null);
  });
});
