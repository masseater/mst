import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { destructuredBindingsOf } from "./destructured-bindings.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("readingOfWholeParameter", () => {
    const declaration = parseSync("spec.ts", `const held = (context) => context;`).program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
    const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
      .params[0] as ESTree.ParamPattern;
    return destructuredBindingsOf(pattern).map((binding) => ({
      name: binding.name.name,
      depth: binding.depth,
    }));
  })
  .extend("readingOfObjectKey", () => {
    const declaration = parseSync("spec.ts", `const held = ({ report }) => report;`).program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
    const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
      .params[0] as ESTree.ParamPattern;
    return destructuredBindingsOf(pattern).map((binding) => ({
      name: binding.name.name,
      depth: binding.depth,
    }));
  })
  .extend("readingOfRenamedKey", () => {
    const declaration = parseSync("spec.ts", `const held = ({ report: summary }) => summary;`)
      .program.body[0] as ESTree.VariableDeclaration;
    const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
    const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
      .params[0] as ESTree.ParamPattern;
    return destructuredBindingsOf(pattern).map((binding) => ({
      name: binding.name.name,
      depth: binding.depth,
    }));
  })
  .extend("readingOfNestedKey", () => {
    const declaration = parseSync("spec.ts", `const held = ({ report: { total } }) => total;`)
      .program.body[0] as ESTree.VariableDeclaration;
    const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
    const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
      .params[0] as ESTree.ParamPattern;
    return destructuredBindingsOf(pattern).map((binding) => ({
      name: binding.name.name,
      depth: binding.depth,
    }));
  })
  .extend("readingOfKeyCarryingADefault", () => {
    const declaration = parseSync("spec.ts", `const held = ({ report = fallback }) => report;`)
      .program.body[0] as ESTree.VariableDeclaration;
    const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
    const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
      .params[0] as ESTree.ParamPattern;
    return destructuredBindingsOf(pattern).map((binding) => ({
      name: binding.name.name,
      depth: binding.depth,
    }));
  })
  .extend("readingOfParameterCarryingADefault", () => {
    const declaration = parseSync("spec.ts", `const held = ({ report } = empty) => report;`).program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
    const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
      .params[0] as ESTree.ParamPattern;
    return destructuredBindingsOf(pattern).map((binding) => ({
      name: binding.name.name,
      depth: binding.depth,
    }));
  })
  .extend("readingOfObjectRest", () => {
    const declaration = parseSync("spec.ts", `const held = ({ report, ...rest }) => rest;`).program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
    const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
      .params[0] as ESTree.ParamPattern;
    return destructuredBindingsOf(pattern).map((binding) => ({
      name: binding.name.name,
      depth: binding.depth,
    }));
  })
  .extend("readingOfArrayElements", () => {
    const declaration = parseSync("spec.ts", `const held = ({ rows: [first, second] }) => first;`)
      .program.body[0] as ESTree.VariableDeclaration;
    const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
    const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
      .params[0] as ESTree.ParamPattern;
    return destructuredBindingsOf(pattern).map((binding) => ({
      name: binding.name.name,
      depth: binding.depth,
    }));
  })
  .extend("readingOfArrayHole", () => {
    const declaration = parseSync("spec.ts", `const held = ([, second]) => second;`).program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
    const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
      .params[0] as ESTree.ParamPattern;
    return destructuredBindingsOf(pattern).map((binding) => ({
      name: binding.name.name,
      depth: binding.depth,
    }));
  })
  .extend("readingOfArrayRest", () => {
    const declaration = parseSync("spec.ts", `const held = ([first, ...rest]) => rest;`).program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
    const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
      .params[0] as ESTree.ParamPattern;
    return destructuredBindingsOf(pattern).map((binding) => ({
      name: binding.name.name,
      depth: binding.depth,
    }));
  })
  .extend("readingOfRestParameter", () => {
    const declaration = parseSync("spec.ts", `const held = (...handed) => handed;`).program
      .body[0] as ESTree.VariableDeclaration;
    const declarator = declaration.declarations[0] as ESTree.VariableDeclarator;
    const pattern = (declarator.init as ESTree.ArrowFunctionExpression)
      .params[0] as ESTree.ParamPattern;
    return destructuredBindingsOf(pattern).map((binding) => ({
      name: binding.name.name,
      depth: binding.depth,
    }));
  })
  .extend("readingOfDeclaredPattern", () => {
    const declaration = parseSync("spec.ts", `const { report: { total } } = context;`).program
      .body[0] as ESTree.VariableDeclaration;
    const pattern = (declaration.declarations[0] as ESTree.VariableDeclarator).id;
    return destructuredBindingsOf(pattern).map((binding) => ({
      name: binding.name.name,
      depth: binding.depth,
    }));
  })
  .extend("readingOfParameterProperty", () => {
    const declared = parseSync("spec.ts", "class Held { constructor(readonly seen: number) {} }")
      .program.body[0] as ESTree.Class;
    const member = declared.body.body[0] as ESTree.MethodDefinition;
    const pattern = member.value.params[0] as ESTree.ParamPattern;
    return destructuredBindingsOf(pattern).map((binding) => ({
      name: binding.name.name,
      depth: binding.depth,
    }));
  });

describe("destructured-bindings", () => {
  it("a name bound whole sits at the depth of the value it names", ({
    readingOfWholeParameter,
  }) => {
    expect(readingOfWholeParameter).toStrictEqual([{ name: "context", depth: 0 }]);
  });

  it("a key taken out of an object pattern sits one level under the value", ({
    readingOfObjectKey,
  }) => {
    expect(readingOfObjectKey).toStrictEqual([{ name: "report", depth: 1 }]);
  });

  it("renaming a key leaves the level the name was taken from unchanged", ({
    readingOfRenamedKey,
  }) => {
    expect(readingOfRenamedKey).toStrictEqual([{ name: "summary", depth: 1 }]);
  });

  it("a key taken out of a nested pattern sits one level under the key above it", ({
    readingOfNestedKey,
  }) => {
    expect(readingOfNestedKey).toStrictEqual([{ name: "total", depth: 2 }]);
  });

  it("a default value written on a pattern adds no level of its own", ({
    readingOfKeyCarryingADefault,
  }) => {
    expect(readingOfKeyCarryingADefault).toStrictEqual([{ name: "report", depth: 1 }]);
  });

  it("a parameter carrying a default value is read through to the pattern it holds", ({
    readingOfParameterCarryingADefault,
  }) => {
    expect(readingOfParameterCarryingADefault).toStrictEqual([{ name: "report", depth: 1 }]);
  });

  it("the rest of an object pattern names what is left of the same value", ({
    readingOfObjectRest,
  }) => {
    expect(readingOfObjectRest).toStrictEqual([
      { name: "report", depth: 1 },
      { name: "rest", depth: 0 },
    ]);
  });

  it("an element taken out of an array pattern sits one level under the list", ({
    readingOfArrayElements,
  }) => {
    expect(readingOfArrayElements).toStrictEqual([
      { name: "first", depth: 2 },
      { name: "second", depth: 2 },
    ]);
  });

  it("a hole in an array pattern names nothing", ({ readingOfArrayHole }) => {
    expect(readingOfArrayHole).toStrictEqual([{ name: "second", depth: 1 }]);
  });

  it("the rest of an array pattern names what is left of the same list", ({
    readingOfArrayRest,
  }) => {
    expect(readingOfArrayRest).toStrictEqual([
      { name: "first", depth: 1 },
      { name: "rest", depth: 0 },
    ]);
  });

  it("a rest parameter names what is left of the argument list", ({ readingOfRestParameter }) => {
    expect(readingOfRestParameter).toStrictEqual([{ name: "handed", depth: 0 }]);
  });

  it("a declared pattern is read the same way as a parameter pattern", ({
    readingOfDeclaredPattern,
  }) => {
    expect(readingOfDeclaredPattern).toStrictEqual([{ name: "total", depth: 2 }]);
  });

  it("a parameter property declares a field rather than a destructured binding", ({
    readingOfParameterProperty,
  }) => {
    expect(readingOfParameterProperty).toStrictEqual([]);
  });
});
