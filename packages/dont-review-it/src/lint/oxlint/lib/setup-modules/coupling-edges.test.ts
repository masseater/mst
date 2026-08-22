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

describe("nodeTypeOf", () => {
  describe("a value that carries no node type", () => {
    const it = test.extend("typeOfAValueCarryingNoNodeType", () => nodeTypeOf({}));

    it("spells no type at all", ({ typeOfAValueCarryingNoNodeType }) => {
      expect(typeOfAValueCarryingNoNodeType).toBe("");
    });
  });
});

describe("couplingEdgeOf", () => {
  describe("a value that is not a node at all", () => {
    const it = test.extend("edgeOfAValueThatIsNotANode", () => couplingEdgeOf(null, new Map()));

    it("is no coupling", ({ edgeOfAValueThatIsNotANode }) => {
      expect(edgeOfAValueThatIsNotANode).toBe(null);
    });
  });

  describe("a template part carrying no value", () => {
    const it = test.extend("edgeOfATemplatePartCarryingNoValue", () =>
      couplingEdgeOf(
        {
          type: "ImportExpression",
          source: { type: "TemplateLiteral", quasis: [{}], expressions: [] },
        },
        new Map(),
      ));

    it("spells no specifier", ({ edgeOfATemplatePartCarryingNoValue }) => {
      expect(edgeOfATemplatePartCarryingNoValue).toBe(null);
    });
  });

  describe("a template part whose text was never cooked", () => {
    const it = test.extend("edgeOfATemplatePartWhoseTextWasNeverCooked", () =>
      couplingEdgeOf(
        {
          type: "ImportExpression",
          source: { type: "TemplateLiteral", quasis: [{ value: {} }], expressions: [] },
        },
        new Map(),
      ));

    it("spells no specifier", ({ edgeOfATemplatePartWhoseTextWasNeverCooked }) => {
      expect(edgeOfATemplatePartWhoseTextWasNeverCooked).toBe(null);
    });
  });

  describe("a join written under an operator that never concatenates", () => {
    const it = test.extend("edgeOfAJoinUnderAnOperatorThatDoesNotConcatenate", () =>
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
      ));

    it("spells no specifier", ({ edgeOfAJoinUnderAnOperatorThatDoesNotConcatenate }) => {
      expect(edgeOfAJoinUnderAnOperatorThatDoesNotConcatenate).toBe(null);
    });
  });

  describe("a join whose side is not a node at all", () => {
    const it = test.extend("edgeOfAJoinWhoseSideIsNotANode", () =>
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
      ));

    it("spells no specifier", ({ edgeOfAJoinWhoseSideIsNotANode }) => {
      expect(edgeOfAJoinWhoseSideIsNotANode).toBe(null);
    });
  });
});

describe("statementsOf", () => {
  describe("a program declaring a constant", () => {
    const it = test.extend("statementsOfAProgramDeclaringAConstant", () => {
      const program = astFieldsOf(parseSync("spec.ts", "const total = 1;").program);
      if (program === null) throw new Error("nothing was parsed");
      return statementsOf(program);
    });

    it("reads its statements as nodes", ({ statementsOfAProgramDeclaringAConstant }) => {
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
  });
});

describe("constantSpecifiersIn", () => {
  describe("a constant that binds a pattern rather than a name", () => {
    const it = test.extend("specifiersOfAConstantBindingAPattern", () => {
      const program = astFieldsOf(parseSync("spec.ts", "const { picked } = held;").program);
      if (program === null) throw new Error("nothing was parsed");
      const [specifiers] = [program.body].map((programStatements) =>
        constantSpecifiersIn(programStatements),
      );
      if (specifiers === undefined) throw new Error("no specifier was read");
      return specifiers;
    });

    it("specifies nothing", ({ specifiersOfAConstantBindingAPattern }) => {
      expect(specifiersOfAConstantBindingAPattern).toStrictEqual(new Map());
    });
  });

  describe("a constant exported with its declaration", () => {
    const it = test.extend("specifiersOfAConstantExportedWithItsDeclaration", () => {
      const program = astFieldsOf(
        parseSync("spec.ts", 'export const SETUP = "./held.ts";').program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [specifiers] = [program.body].map((programStatements) =>
        constantSpecifiersIn(programStatements),
      );
      if (specifiers === undefined) throw new Error("no specifier was read");
      return specifiers;
    });

    it("still spells its specifier", ({ specifiersOfAConstantExportedWithItsDeclaration }) => {
      expect(specifiersOfAConstantExportedWithItsDeclaration).toStrictEqual(
        new Map([["SETUP", "./held.ts"]]),
      );
    });
  });

  describe("a constant re-exported under its own name", () => {
    const it = test.extend("specifiersOfAConstantReExportedUnderItsOwnName", () => {
      const program = astFieldsOf(
        parseSync("spec.ts", 'const HELD = "./held.ts";\nexport { HELD };').program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [specifiers] = [program.body].map((programStatements) =>
        constantSpecifiersIn(programStatements),
      );
      if (specifiers === undefined) throw new Error("no specifier was read");
      return specifiers;
    });

    it("binds no further specifier", ({ specifiersOfAConstantReExportedUnderItsOwnName }) => {
      expect(specifiersOfAConstantReExportedUnderItsOwnName).toStrictEqual(
        new Map([["HELD", "./held.ts"]]),
      );
    });
  });

  describe("a binding that can be written to again", () => {
    const it = test.extend("specifiersOfABindingThatCanBeWrittenToAgain", () => {
      const program = astFieldsOf(parseSync("spec.ts", 'let entry = "./held.ts";').program);
      if (program === null) throw new Error("nothing was parsed");
      const [specifiers] = [program.body].map((programStatements) =>
        constantSpecifiersIn(programStatements),
      );
      if (specifiers === undefined) throw new Error("no specifier was read");
      return specifiers;
    });

    it("spells no constant specifier", ({ specifiersOfABindingThatCanBeWrittenToAgain }) => {
      expect(specifiersOfABindingThatCanBeWrittenToAgain).toStrictEqual(new Map());
    });
  });

  describe("a constant bound to a number", () => {
    const it = test.extend("specifiersOfAConstantBoundToANumber", () => {
      const program = astFieldsOf(parseSync("spec.ts", "const RETRIES = 3;").program);
      if (program === null) throw new Error("nothing was parsed");
      const [specifiers] = [program.body].map((programStatements) =>
        constantSpecifiersIn(programStatements),
      );
      if (specifiers === undefined) throw new Error("no specifier was read");
      return specifiers;
    });

    it("spells no specifier", ({ specifiersOfAConstantBoundToANumber }) => {
      expect(specifiersOfAConstantBoundToANumber).toStrictEqual(new Map());
    });
  });

  describe("a constant that compares two written-out strings", () => {
    const it = test.extend("specifiersOfAConstantComparingTwoWrittenOutStrings", () => {
      const program = astFieldsOf(
        parseSync("spec.ts", 'const ENTRY = "./held.ts";\nconst IS_HELD = ENTRY === "./held.ts";')
          .program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [specifiers] = [program.body].map((programStatements) =>
        constantSpecifiersIn(programStatements),
      );
      if (specifiers === undefined) throw new Error("no specifier was read");
      return specifiers;
    });

    it("spells no specifier", ({ specifiersOfAConstantComparingTwoWrittenOutStrings }) => {
      expect(specifiersOfAConstantComparingTwoWrittenOutStrings).toStrictEqual(
        new Map([["ENTRY", "./held.ts"]]),
      );
    });
  });
});

describe("couplingEdgesUnder", () => {
  describe("an import declaration", () => {
    const it = test.extend("edgesOfAnImportDeclaration", () => {
      const program = astFieldsOf(parseSync("spec.ts", 'import held from "./held.ts";').program);
      if (program === null) throw new Error("nothing was parsed");
      const [constants] = [program.body].map((programStatements) =>
        constantSpecifiersIn(programStatements),
      );
      if (constants === undefined) throw new Error("no constant was read");
      return couplingEdgesUnder(program, constants);
    });

    it("couples this file to a module and carries its values", ({ edgesOfAnImportDeclaration }) => {
      expect(edgesOfAnImportDeclaration).toStrictEqual([
        { specifier: "./held.ts", carriesValues: true },
      ]);
    });
  });

  describe("an import of types alone", () => {
    const it = test.extend("edgesOfAnImportOfTypesAlone", () => {
      const program = astFieldsOf(
        parseSync("spec.ts", 'import type { Held } from "./held.ts";').program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [constants] = [program.body].map((programStatements) =>
        constantSpecifiersIn(programStatements),
      );
      if (constants === undefined) throw new Error("no constant was read");
      return couplingEdgesUnder(program, constants);
    });

    it("couples this file to a module without carrying values", ({
      edgesOfAnImportOfTypesAlone,
    }) => {
      expect(edgesOfAnImportOfTypesAlone).toStrictEqual([
        { specifier: "./held.ts", carriesValues: false },
      ]);
    });
  });

  describe("a named export read from another module", () => {
    const it = test.extend("edgesOfANamedExportReadFromAnotherModule", () => {
      const program = astFieldsOf(
        parseSync("spec.ts", 'export { held } from "./held.ts";').program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [constants] = [program.body].map((programStatements) =>
        constantSpecifiersIn(programStatements),
      );
      if (constants === undefined) throw new Error("no constant was read");
      return couplingEdgesUnder(program, constants);
    });

    it("carries its values", ({ edgesOfANamedExportReadFromAnotherModule }) => {
      expect(edgesOfANamedExportReadFromAnotherModule).toStrictEqual([
        { specifier: "./held.ts", carriesValues: true },
      ]);
    });
  });

  describe("an export of types alone", () => {
    const it = test.extend("edgesOfAnExportOfTypesAlone", () => {
      const program = astFieldsOf(
        parseSync("spec.ts", 'export type { Held } from "./held.ts";').program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [constants] = [program.body].map((programStatements) =>
        constantSpecifiersIn(programStatements),
      );
      if (constants === undefined) throw new Error("no constant was read");
      return couplingEdgesUnder(program, constants);
    });

    it("reaches another module without carrying values", ({ edgesOfAnExportOfTypesAlone }) => {
      expect(edgesOfAnExportOfTypesAlone).toStrictEqual([
        { specifier: "./held.ts", carriesValues: false },
      ]);
    });
  });

  describe("an export of everything another module holds", () => {
    const it = test.extend("edgesOfAnExportOfEverythingAnotherModuleHolds", () => {
      const program = astFieldsOf(parseSync("spec.ts", 'export * from "./held.ts";').program);
      if (program === null) throw new Error("nothing was parsed");
      const [constants] = [program.body].map((programStatements) =>
        constantSpecifiersIn(programStatements),
      );
      if (constants === undefined) throw new Error("no constant was read");
      return couplingEdgesUnder(program, constants);
    });

    it("carries its values", ({ edgesOfAnExportOfEverythingAnotherModuleHolds }) => {
      expect(edgesOfAnExportOfEverythingAnotherModuleHolds).toStrictEqual([
        { specifier: "./held.ts", carriesValues: true },
      ]);
    });
  });

  describe("a template assembled from a constant of this file", () => {
    const it = test.extend("edgesOfATemplateAssembledFromAConstantOfThisFile", () => {
      const program = astFieldsOf(
        parseSync("spec.ts", 'const STEM = "held";\nconst loaded = import(`./${STEM}.ts`);')
          .program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [constants] = [program.body].map((programStatements) =>
        constantSpecifiersIn(programStatements),
      );
      if (constants === undefined) throw new Error("no constant was read");
      return couplingEdgesUnder(program, constants);
    });

    it("resolves to one specifier", ({ edgesOfATemplateAssembledFromAConstantOfThisFile }) => {
      expect(edgesOfATemplateAssembledFromAConstantOfThisFile).toStrictEqual([
        { specifier: "./held.ts", carriesValues: true },
      ]);
    });
  });

  describe("two written-out strings joined together", () => {
    const it = test.extend("edgesOfTwoWrittenOutStringsJoinedTogether", () => {
      const program = astFieldsOf(
        parseSync("spec.ts", 'const loaded = import("./held" + ".ts");').program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [constants] = [program.body].map((programStatements) =>
        constantSpecifiersIn(programStatements),
      );
      if (constants === undefined) throw new Error("no constant was read");
      return couplingEdgesUnder(program, constants);
    });

    it("resolve to one specifier", ({ edgesOfTwoWrittenOutStringsJoinedTogether }) => {
      expect(edgesOfTwoWrittenOutStringsJoinedTogether).toStrictEqual([
        { specifier: "./held.ts", carriesValues: true },
      ]);
    });
  });

  describe("a join whose side is decided while the program runs", () => {
    const it = test.extend("edgesOfAJoinWhoseSideIsDecidedWhileTheProgramRuns", () => {
      const program = astFieldsOf(
        parseSync("spec.ts", 'const loaded = import("./" + chosen);').program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [constants] = [program.body].map((programStatements) =>
        constantSpecifiersIn(programStatements),
      );
      if (constants === undefined) throw new Error("no constant was read");
      return couplingEdgesUnder(program, constants);
    });

    it("resolves to no specifier", ({ edgesOfAJoinWhoseSideIsDecidedWhileTheProgramRuns }) => {
      expect(edgesOfAJoinWhoseSideIsDecidedWhileTheProgramRuns).toStrictEqual([]);
    });
  });

  describe("a join under an operator other than concatenation", () => {
    const it = test.extend("edgesOfAJoinUnderAnOperatorOtherThanConcatenation", () => {
      const program = astFieldsOf(
        parseSync("spec.ts", 'const loaded = import("./held.ts" ?? "./other.ts");').program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [constants] = [program.body].map((programStatements) =>
        constantSpecifiersIn(programStatements),
      );
      if (constants === undefined) throw new Error("no constant was read");
      return couplingEdgesUnder(program, constants);
    });

    it("resolves to no specifier", ({ edgesOfAJoinUnderAnOperatorOtherThanConcatenation }) => {
      expect(edgesOfAJoinUnderAnOperatorOtherThanConcatenation).toStrictEqual([]);
    });
  });

  describe("a constant joined from a constant declared above it", () => {
    const it = test.extend("edgesOfAConstantJoinedFromAConstantDeclaredAboveIt", () => {
      const program = astFieldsOf(
        parseSync(
          "spec.ts",
          'const BASE = "./held";\nconst ENTRY = BASE + ".ts";\nconst held = import(ENTRY);',
        ).program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [constants] = [program.body].map((programStatements) =>
        constantSpecifiersIn(programStatements),
      );
      if (constants === undefined) throw new Error("no constant was read");
      return couplingEdgesUnder(program, constants);
    });

    it("resolves to one specifier", ({ edgesOfAConstantJoinedFromAConstantDeclaredAboveIt }) => {
      expect(edgesOfAConstantJoinedFromAConstantDeclaredAboveIt).toStrictEqual([
        { specifier: "./held.ts", carriesValues: true },
      ]);
    });
  });

  describe("a constant that reads a name declared below it", () => {
    const it = test.extend("edgesOfAConstantReadingANameDeclaredBelowIt", () => {
      const program = astFieldsOf(
        parseSync(
          "spec.ts",
          'const ENTRY = BASE + ".ts";\nconst BASE = "./held";\nconst held = import(ENTRY);',
        ).program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [constants] = [program.body].map((programStatements) =>
        constantSpecifiersIn(programStatements),
      );
      if (constants === undefined) throw new Error("no constant was read");
      return couplingEdgesUnder(program, constants);
    });

    it("resolves to no specifier", ({ edgesOfAConstantReadingANameDeclaredBelowIt }) => {
      expect(edgesOfAConstantReadingANameDeclaredBelowIt).toStrictEqual([]);
    });
  });
});

describe("requestedSpecifierOf", () => {
  describe("a call named something else", () => {
    const it = test.extend("specifierRequestedByACallNamedSomethingElse", () => {
      const program = astFieldsOf(parseSync("spec.ts", 'load("./held.ts");').program);
      if (program === null) throw new Error("nothing was parsed");
      const [statement] = statementsOf(program);
      const called = statement === undefined ? null : astFieldsOf(statement.expression);
      if (called === null) throw new Error("nothing is called");
      return requestedSpecifierOf(called);
    });

    it("requests nothing, since only a call named require is read", ({
      specifierRequestedByACallNamedSomethingElse,
    }) => {
      expect(specifierRequestedByACallNamedSomethingElse).toBe(null);
    });
  });

  describe("a require call", () => {
    const it = test.extend("specifierRequestedByARequireCall", () => {
      const program = astFieldsOf(parseSync("spec.ts", 'require("./held.ts");').program);
      if (program === null) throw new Error("nothing was parsed");
      const [statement] = statementsOf(program);
      const called = statement === undefined ? null : astFieldsOf(statement.expression);
      if (called === null) throw new Error("nothing is called");
      return requestedSpecifierOf(called);
    });

    it("requests the argument it is handed", ({ specifierRequestedByARequireCall }) => {
      expect(specifierRequestedByARequireCall).toStrictEqual({
        type: "Literal",
        value: "./held.ts",
        raw: '"./held.ts"',
        start: 8,
        end: 19,
      });
    });
  });

  describe("a require call handed nothing", () => {
    const it = test.extend("specifierRequestedByARequireCallHandedNothing", () => {
      const program = astFieldsOf(parseSync("spec.ts", "require();").program);
      if (program === null) throw new Error("nothing was parsed");
      const [statement] = statementsOf(program);
      const called = statement === undefined ? null : astFieldsOf(statement.expression);
      if (called === null) throw new Error("nothing is called");
      return requestedSpecifierOf(called);
    });

    it("requests no specifier", ({ specifierRequestedByARequireCallHandedNothing }) => {
      expect(specifierRequestedByARequireCallHandedNothing).toBe(null);
    });
  });

  describe("a call through a member of an object", () => {
    const it = test.extend("specifierRequestedThroughAMemberOfAnObject", () => {
      const program = astFieldsOf(parseSync("spec.ts", 'loader.require("./held.ts");').program);
      if (program === null) throw new Error("nothing was parsed");
      const [statement] = statementsOf(program);
      const called = statement === undefined ? null : astFieldsOf(statement.expression);
      if (called === null) throw new Error("nothing is called");
      return requestedSpecifierOf(called);
    });

    it("requests no specifier", ({ specifierRequestedThroughAMemberOfAnObject }) => {
      expect(specifierRequestedThroughAMemberOfAnObject).toBe(null);
    });
  });

  describe("a value that is not a node", () => {
    const it = test.extend("specifierRequestedByAValueThatIsNotANode", () =>
      requestedSpecifierOf(null));

    it("requests no specifier", ({ specifierRequestedByAValueThatIsNotANode }) => {
      expect(specifierRequestedByAValueThatIsNotANode).toBe(null);
    });
  });
});
