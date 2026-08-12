import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  astFieldsOf,
  constantSpecifiersIn,
  couplingEdgeOf,
  couplingEdgesUnder,
  nodeTypeOf,
  requestedSpecifierOf,
  statementsOf,
} from "./coupling-edges.ts";

const it = test
  .extend("typeOfAValueCarryingNoNodeType", () => nodeTypeOf({}))
  .extend("edgeOfAValueThatIsNotANode", () => couplingEdgeOf(null, new Map()))
  .extend("edgeOfATemplatePartCarryingNoValue", () =>
    couplingEdgeOf(
      {
        type: "ImportExpression",
        source: { type: "TemplateLiteral", quasis: [{}], expressions: [] },
      },
      new Map(),
    ),
  )
  .extend("edgeOfATemplatePartWhoseTextWasNeverCooked", () =>
    couplingEdgeOf(
      {
        type: "ImportExpression",
        source: { type: "TemplateLiteral", quasis: [{ value: {} }], expressions: [] },
      },
      new Map(),
    ),
  )
  .extend("statementsOfAProgramDeclaringAConstant", () => {
    const program = astFieldsOf(parseSync("spec.ts", "const total = 1;").program);
    if (program === null) throw new Error("nothing was parsed");
    return statementsOf(program);
  })
  .extend("specifiersOfAConstantBindingAPattern", () => {
    const program = astFieldsOf(parseSync("spec.ts", "const { picked } = held;").program);
    if (program === null) throw new Error("nothing was parsed");
    const [specifiers] = [program.body].map((body) => constantSpecifiersIn(body));
    if (specifiers === undefined) throw new Error("no specifier was read");
    return specifiers;
  })
  .extend("specifiersOfAConstantExportedWithItsDeclaration", () => {
    const program = astFieldsOf(parseSync("spec.ts", 'export const SETUP = "./held.ts";').program);
    if (program === null) throw new Error("nothing was parsed");
    const [specifiers] = [program.body].map((body) => constantSpecifiersIn(body));
    if (specifiers === undefined) throw new Error("no specifier was read");
    return specifiers;
  })
  .extend("edgesOfATemplateAssembledFromAConstantOfThisFile", () => {
    const program = astFieldsOf(
      parseSync("spec.ts", 'const STEM = "held";\nconst loaded = import(`./${STEM}.ts`);').program,
    );
    if (program === null) throw new Error("nothing was parsed");
    const [constants] = [program.body].map((body) => constantSpecifiersIn(body));
    if (constants === undefined) throw new Error("no constant was read");
    return couplingEdgesUnder(program, constants);
  })
  .extend("edgesOfTwoWrittenOutStringsJoinedTogether", () => {
    const program = astFieldsOf(
      parseSync("spec.ts", 'const loaded = import("./held" + ".ts");').program,
    );
    if (program === null) throw new Error("nothing was parsed");
    const [constants] = [program.body].map((body) => constantSpecifiersIn(body));
    if (constants === undefined) throw new Error("no constant was read");
    return couplingEdgesUnder(program, constants);
  })
  .extend("edgesOfAJoinWhoseSideIsDecidedWhileTheProgramRuns", () => {
    const program = astFieldsOf(
      parseSync("spec.ts", 'const loaded = import("./" + chosen);').program,
    );
    if (program === null) throw new Error("nothing was parsed");
    const [constants] = [program.body].map((body) => constantSpecifiersIn(body));
    if (constants === undefined) throw new Error("no constant was read");
    return couplingEdgesUnder(program, constants);
  })
  .extend("edgesOfAJoinUnderAnOperatorOtherThanConcatenation", () => {
    const program = astFieldsOf(
      parseSync("spec.ts", 'const loaded = import("./held.ts" ?? "./other.ts");').program,
    );
    if (program === null) throw new Error("nothing was parsed");
    const [constants] = [program.body].map((body) => constantSpecifiersIn(body));
    if (constants === undefined) throw new Error("no constant was read");
    return couplingEdgesUnder(program, constants);
  })
  .extend("edgesOfAConstantJoinedFromAConstantDeclaredAboveIt", () => {
    const program = astFieldsOf(
      parseSync(
        "spec.ts",
        'const BASE = "./held";\nconst ENTRY = BASE + ".ts";\nconst held = import(ENTRY);',
      ).program,
    );
    if (program === null) throw new Error("nothing was parsed");
    const [constants] = [program.body].map((body) => constantSpecifiersIn(body));
    if (constants === undefined) throw new Error("no constant was read");
    return couplingEdgesUnder(program, constants);
  })
  .extend("edgesOfAConstantReadingANameDeclaredBelowIt", () => {
    const program = astFieldsOf(
      parseSync(
        "spec.ts",
        'const ENTRY = BASE + ".ts";\nconst BASE = "./held";\nconst held = import(ENTRY);',
      ).program,
    );
    if (program === null) throw new Error("nothing was parsed");
    const [constants] = [program.body].map((body) => constantSpecifiersIn(body));
    if (constants === undefined) throw new Error("no constant was read");
    return couplingEdgesUnder(program, constants);
  })
  .extend("specifierRequestedByACallNamedSomethingElse", () => {
    const program = astFieldsOf(parseSync("spec.ts", 'load("./held.ts");').program);
    if (program === null) throw new Error("nothing was parsed");
    const [statement] = statementsOf(program);
    const called = statement === undefined ? null : astFieldsOf(statement.expression);
    if (called === null) throw new Error("nothing is called");
    return requestedSpecifierOf(called);
  })
  .extend("specifierRequestedByARequireCall", () => {
    const program = astFieldsOf(parseSync("spec.ts", 'require("./held.ts");').program);
    if (program === null) throw new Error("nothing was parsed");
    const [statement] = statementsOf(program);
    const called = statement === undefined ? null : astFieldsOf(statement.expression);
    if (called === null) throw new Error("nothing is called");
    return requestedSpecifierOf(called);
  })
  .extend("specifierRequestedByARequireCallHandedNothing", () => {
    const program = astFieldsOf(parseSync("spec.ts", "require();").program);
    if (program === null) throw new Error("nothing was parsed");
    const [statement] = statementsOf(program);
    const called = statement === undefined ? null : astFieldsOf(statement.expression);
    if (called === null) throw new Error("nothing is called");
    return requestedSpecifierOf(called);
  })
  .extend("specifierRequestedThroughAMemberOfAnObject", () => {
    const program = astFieldsOf(parseSync("spec.ts", 'loader.require("./held.ts");').program);
    if (program === null) throw new Error("nothing was parsed");
    const [statement] = statementsOf(program);
    const called = statement === undefined ? null : astFieldsOf(statement.expression);
    if (called === null) throw new Error("nothing is called");
    return requestedSpecifierOf(called);
  })
  .extend("edgeOfAJoinUnderAnOperatorThatDoesNotConcatenate", () =>
    couplingEdgeOf(
      {
        type: "ImportExpression",
        source: {
          type: "BinaryExpression",
          operator: "-",
          left: { type: "Literal", value: "./held" },
          right: { type: "Literal", value: ".ts" },
        },
      },
      new Map(),
    ),
  )
  .extend("edgeOfAJoinWhoseSideIsNotANode", () =>
    couplingEdgeOf(
      {
        type: "ImportExpression",
        source: {
          type: "BinaryExpression",
          operator: "+",
          left: "./held",
          right: { type: "Literal", value: ".ts" },
        },
      },
      new Map(),
    ),
  )
  .extend("specifierRequestedByAValueThatIsNotANode", () => requestedSpecifierOf(null));

describe("setup-modules/coupling-edges", () => {
  it("a value that carries no node type spells no type at all", ({
    typeOfAValueCarryingNoNodeType,
  }) => {
    expect(typeOfAValueCarryingNoNodeType).toBe("");
  });

  it("a value that is not a node at all is no coupling", ({ edgeOfAValueThatIsNotANode }) => {
    expect(edgeOfAValueThatIsNotANode).toBe(null);
  });

  it("a template part carrying no value spells no specifier", ({
    edgeOfATemplatePartCarryingNoValue,
  }) => {
    expect(edgeOfATemplatePartCarryingNoValue).toBe(null);
  });

  it("a template part whose text was never cooked spells no specifier", ({
    edgeOfATemplatePartWhoseTextWasNeverCooked,
  }) => {
    expect(edgeOfATemplatePartWhoseTextWasNeverCooked).toBe(null);
  });

  it("the statements of a program are read as nodes", ({
    statementsOfAProgramDeclaringAConstant,
  }) => {
    expect(statementsOfAProgramDeclaringAConstant).toStrictEqual([
      {
        type: "VariableDeclaration",
        kind: "const",
        declarations: [
          {
            type: "VariableDeclarator",
            id: {
              type: "Identifier",
              decorators: [],
              name: "total",
              optional: false,
              typeAnnotation: null,
              start: 6,
              end: 11,
            },
            init: { type: "Literal", value: 1, raw: "1", start: 14, end: 15 },
            definite: false,
            start: 6,
            end: 15,
          },
        ],
        declare: false,
        start: 0,
        end: 16,
      },
    ]);
  });

  it("a constant that binds a pattern rather than a name specifies nothing", ({
    specifiersOfAConstantBindingAPattern,
  }) => {
    expect(specifiersOfAConstantBindingAPattern).toStrictEqual(new Map());
  });

  it("a constant exported with its declaration still spells its specifier", ({
    specifiersOfAConstantExportedWithItsDeclaration,
  }) => {
    expect(specifiersOfAConstantExportedWithItsDeclaration).toStrictEqual(
      new Map([["SETUP", "./held.ts"]]),
    );
  });

  it("a template assembled from a constant of this file resolves to one specifier", ({
    edgesOfATemplateAssembledFromAConstantOfThisFile,
  }) => {
    expect(edgesOfATemplateAssembledFromAConstantOfThisFile).toStrictEqual([
      { specifier: "./held.ts", carriesValues: true },
    ]);
  });

  it("two written-out strings joined together resolve to one specifier", ({
    edgesOfTwoWrittenOutStringsJoinedTogether,
  }) => {
    expect(edgesOfTwoWrittenOutStringsJoinedTogether).toStrictEqual([
      { specifier: "./held.ts", carriesValues: true },
    ]);
  });

  it("a join whose side is decided while the program runs resolves to no specifier", ({
    edgesOfAJoinWhoseSideIsDecidedWhileTheProgramRuns,
  }) => {
    expect(edgesOfAJoinWhoseSideIsDecidedWhileTheProgramRuns).toStrictEqual([]);
  });

  it("a join under an operator other than concatenation resolves to no specifier", ({
    edgesOfAJoinUnderAnOperatorOtherThanConcatenation,
  }) => {
    expect(edgesOfAJoinUnderAnOperatorOtherThanConcatenation).toStrictEqual([]);
  });

  it("a constant joined from a constant declared above it resolves to one specifier", ({
    edgesOfAConstantJoinedFromAConstantDeclaredAboveIt,
  }) => {
    expect(edgesOfAConstantJoinedFromAConstantDeclaredAboveIt).toStrictEqual([
      { specifier: "./held.ts", carriesValues: true },
    ]);
  });

  it("a constant that reads a name declared below it resolves to no specifier", ({
    edgesOfAConstantReadingANameDeclaredBelowIt,
  }) => {
    expect(edgesOfAConstantReadingANameDeclaredBelowIt).toStrictEqual([]);
  });

  it("the specifier a call requests is read only from a call named require", ({
    specifierRequestedByACallNamedSomethingElse,
  }) => {
    expect(specifierRequestedByACallNamedSomethingElse).toBe(null);
  });

  it("the specifier a require call requests is the argument it is handed", ({
    specifierRequestedByARequireCall,
  }) => {
    expect(specifierRequestedByARequireCall).toStrictEqual({
      type: "Literal",
      value: "./held.ts",
      raw: '"./held.ts"',
      start: 8,
      end: 19,
    });
  });

  it("a require call handed nothing requests no specifier", ({
    specifierRequestedByARequireCallHandedNothing,
  }) => {
    expect(specifierRequestedByARequireCallHandedNothing).toBe(null);
  });

  it("a call through a member of an object requests no specifier", ({
    specifierRequestedThroughAMemberOfAnObject,
  }) => {
    expect(specifierRequestedThroughAMemberOfAnObject).toBe(null);
  });

  it("a join written under an operator that never concatenates spells no specifier", ({
    edgeOfAJoinUnderAnOperatorThatDoesNotConcatenate,
  }) => {
    expect(edgeOfAJoinUnderAnOperatorThatDoesNotConcatenate).toBe(null);
  });

  it("a join whose side is not a node at all spells no specifier", ({
    edgeOfAJoinWhoseSideIsNotANode,
  }) => {
    expect(edgeOfAJoinWhoseSideIsNotANode).toBe(null);
  });

  it("a value that is not a node requests no specifier", ({
    specifierRequestedByAValueThatIsNotANode,
  }) => {
    expect(specifierRequestedByAValueThatIsNotANode).toBe(null);
  });
});
