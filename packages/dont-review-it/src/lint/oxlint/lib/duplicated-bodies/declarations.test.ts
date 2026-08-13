import { describe, expect, test } from "vite-plus/test";

import { declarationsIn } from "./declarations.ts";

const ARROW_DOUBLING_STRUCTURE =
  '{typeAnnotation:null,init:{type:"ArrowFunctionExpression",expression:true,async:false,typeParameters:null,params:[{type:"Identifier",decorators:[],name:"value",optional:false,typeAnnotation:{type:"TSTypeAnnotation",typeAnnotation:{type:"TSNumberKeyword"}}}],returnType:null,body:{type:"BinaryExpression",left:{type:"Identifier",decorators:[],name:"value",optional:false,typeAnnotation:null},operator:"*",right:{type:"Literal",value:2,raw:"2"}},id:null,generator:false}}';

const ANNOTATED_ARROW_DOUBLING_STRUCTURE =
  '{typeAnnotation:null,init:{type:"ArrowFunctionExpression",expression:true,async:false,typeParameters:null,params:[{type:"Identifier",decorators:[],name:"value",optional:false,typeAnnotation:{type:"TSTypeAnnotation",typeAnnotation:{type:"TSNumberKeyword"}}}],returnType:{type:"TSTypeAnnotation",typeAnnotation:{type:"TSNumberKeyword"}},body:{type:"BinaryExpression",left:{type:"Identifier",decorators:[],name:"value",optional:false,typeAnnotation:null},operator:"*",right:{type:"Literal",value:2,raw:"2"}},id:null,generator:false}}';

const FUNCTION_DOUBLING_STRUCTURE =
  '{typeParameters:null,params:[{type:"Identifier",decorators:[],name:"value",optional:false,typeAnnotation:{type:"TSTypeAnnotation",typeAnnotation:{type:"TSNumberKeyword"}}}],returnType:null,body:{type:"BlockStatement",body:[{type:"ReturnStatement",argument:{type:"BinaryExpression",left:{type:"Identifier",decorators:[],name:"value",optional:false,typeAnnotation:null},operator:"*",right:{type:"Literal",value:2,raw:"2"}}}]},async:false,generator:false}';

const OUTER_ARROW_STRUCTURE =
  '{typeAnnotation:null,init:{type:"ArrowFunctionExpression",expression:false,async:false,typeParameters:null,params:[],returnType:null,body:{type:"BlockStatement",body:[{type:"VariableDeclaration",kind:"const",declarations:[{type:"VariableDeclarator",id:{type:"Identifier",decorators:[],name:"inner",optional:false,typeAnnotation:null},init:{type:"Literal",value:1,raw:"1"},definite:false}],declare:false},{type:"ReturnStatement",argument:{type:"Identifier",decorators:[],name:"inner",optional:false,typeAnnotation:null}}]},id:null,generator:false}}';

const LITERAL_ONE_STRUCTURE = '{typeAnnotation:null,init:{type:"Literal",value:1,raw:"1"}}';

const LITERAL_TWO_STRUCTURE = '{typeAnnotation:null,init:{type:"Literal",value:2,raw:"2"}}';

const TITLE_ALIAS_STRUCTURE =
  '{typeParameters:null,typeAnnotation:{type:"TSTypeLiteral",members:[{type:"TSPropertySignature",computed:false,optional:false,readonly:true,key:{type:"Identifier",decorators:[],name:"title",optional:false,typeAnnotation:null},typeAnnotation:{type:"TSTypeAnnotation",typeAnnotation:{type:"TSStringKeyword"}},accessibility:null,static:false}]}}';

const TITLE_INTERFACE_STRUCTURE =
  '{typeParameters:null,extends:[],body:{type:"TSInterfaceBody",body:[{type:"TSPropertySignature",computed:false,optional:false,readonly:true,key:{type:"Identifier",decorators:[],name:"title",optional:false,typeAnnotation:null},typeAnnotation:{type:"TSTypeAnnotation",typeAnnotation:{type:"TSStringKeyword"}},accessibility:null,static:false}]}}';

const TWICE_ARROW_SOURCE = "const twice = (value: number) => value * 2;";

const DRAFT_ALIAS_SOURCE = "type Draft = { readonly title: string };";

const DRAFT_INTERFACE_SOURCE = "interface Draft {\n  readonly title: string;\n}";

describe("declarationsIn", () => {
  describe("an arrow binding", () => {
    const it = test.extend("declarations", () => declarationsIn(TWICE_ARROW_SOURCE));

    it("is read under the name it was declared with", ({ declarations }) => {
      expect(declarations).toStrictEqual([
        { name: "twice", line: 1, structure: ARROW_DOUBLING_STRUCTURE, nodeCount: 7 },
      ]);
    });
  });

  describe("an arrow binding differing from another only in its name", () => {
    const it = test.extend("declarations", () =>
      declarationsIn("const doubled = (value: number) => value * 2;"));

    it("is read with the structure the other one is read with", ({ declarations }) => {
      expect(declarations).toStrictEqual([
        { name: "doubled", line: 1, structure: ARROW_DOUBLING_STRUCTURE, nodeCount: 7 },
      ]);
    });
  });

  describe("an arrow binding carrying comments", () => {
    const it = test
      .extend("declarationsOfTheCommentedArrow", () =>
        declarationsIn("/* doubles it */ const twice = (value: number) => /* here */ value * 2;"))
      .extend("declarationsOfThePlainArrow", () => declarationsIn(TWICE_ARROW_SOURCE));

    it("is read as the same declaration as the one without them", ({
      declarationsOfTheCommentedArrow,
      declarationsOfThePlainArrow,
    }) => {
      expect(declarationsOfTheCommentedArrow).toStrictEqual(declarationsOfThePlainArrow);
    });
  });

  describe("an arrow binding wrapped over several lines", () => {
    const it = test
      .extend("declarationsOfTheWrappedArrow", () =>
        declarationsIn("const twice = (\n  value: number,\n) =>\n  value * 2;"))
      .extend("declarationsOfTheArrowOnOneLine", () => declarationsIn(TWICE_ARROW_SOURCE));

    it("is read as the same declaration as the one written on one line", ({
      declarationsOfTheWrappedArrow,
      declarationsOfTheArrowOnOneLine,
    }) => {
      expect(declarationsOfTheWrappedArrow).toStrictEqual(declarationsOfTheArrowOnOneLine);
    });
  });

  describe("two arrow bindings whose bodies call a different name", () => {
    const it = test
      .extend("declarationsCallingStatSync", () =>
        declarationsIn("const read = (path: string) => statSync(path);"))
      .extend("declarationsCallingReadFileSync", () =>
        declarationsIn("const read = (path: string) => readFileSync(path);"),
      );

    it("are kept apart", ({ declarationsCallingStatSync, declarationsCallingReadFileSync }) => {
      expect(declarationsCallingStatSync).not.toStrictEqual(declarationsCallingReadFileSync);
    });
  });

  describe("two arrow bindings whose parameter is named differently", () => {
    const it = test
      .extend("declarationsTakingAmount", () =>
        declarationsIn("const twice = (amount: number) => amount * 2;"))
      .extend("declarationsTakingValue", () => declarationsIn(TWICE_ARROW_SOURCE));

    it("are kept apart", ({ declarationsTakingAmount, declarationsTakingValue }) => {
      expect(declarationsTakingAmount).not.toStrictEqual(declarationsTakingValue);
    });
  });

  describe("two arrow bindings differing only in a string literal", () => {
    const it = test
      .extend("declarationsReportingDraft", () =>
        declarationsIn('const label = () => report("draft");'))
      .extend("declarationsReportingPublished", () =>
        declarationsIn('const label = () => report("published");'),
      );

    it("are kept apart", ({ declarationsReportingDraft, declarationsReportingPublished }) => {
      expect(declarationsReportingDraft).not.toStrictEqual(declarationsReportingPublished);
    });
  });

  describe("two bindings differing only in a bigint literal", () => {
    const it = test
      .extend("declarationsHoldingOneBigint", () => declarationsIn("const amount = 1n;"))
      .extend("declarationsHoldingTwoBigint", () => declarationsIn("const amount = 2n;"));

    it("are kept apart because the bigint is written into the structure", ({
      declarationsHoldingOneBigint,
      declarationsHoldingTwoBigint,
    }) => {
      expect(declarationsHoldingOneBigint).not.toStrictEqual(declarationsHoldingTwoBigint);
    });
  });

  describe("two bindings annotated with a different type", () => {
    const it = test
      .extend("declarationsAnnotatedAsUnknown", () =>
        declarationsIn("const parse: (text: string) => unknown = JSON.parse;"))
      .extend("declarationsAnnotatedAsString", () =>
        declarationsIn("const parse: (text: string) => string = JSON.parse;"),
      );

    it("are kept apart because the annotation stands inside the structure", ({
      declarationsAnnotatedAsUnknown,
      declarationsAnnotatedAsString,
    }) => {
      expect(declarationsAnnotatedAsUnknown).not.toStrictEqual(declarationsAnnotatedAsString);
    });
  });

  describe("a function declaration", () => {
    const it = test.extend("declarations", () =>
      declarationsIn("function twice(value: number) {\n  return value * 2;\n}"));

    it("is read under the name it was declared with", ({ declarations }) => {
      expect(declarations).toStrictEqual([
        { name: "twice", line: 1, structure: FUNCTION_DOUBLING_STRUCTURE, nodeCount: 8 },
      ]);
    });
  });

  describe("an exported arrow binding", () => {
    const it = test
      .extend("declarationsOfTheExportedArrow", () =>
        declarationsIn("export const twice = (value: number) => value * 2;"))
      .extend("declarationsOfTheKeptArrow", () => declarationsIn(TWICE_ARROW_SOURCE));

    it("is read as the same declaration as the one kept to its module", ({
      declarationsOfTheExportedArrow,
      declarationsOfTheKeptArrow,
    }) => {
      expect(declarationsOfTheExportedArrow).toStrictEqual(declarationsOfTheKeptArrow);
    });
  });

  describe("an arrow binding holding a binding of its own", () => {
    const it = test.extend("declarations", () =>
      declarationsIn("const outer = () => {\n  const inner = 1;\n  return inner;\n};"));

    it("is read alone, leaving the nested binding out", ({ declarations }) => {
      expect(declarations).toStrictEqual([
        { name: "outer", line: 1, structure: OUTER_ARROW_STRUCTURE, nodeCount: 8 },
      ]);
    });
  });

  describe("an anonymous function written at a call site", () => {
    const it = test.extend("declarations", () =>
      declarationsIn("register(function () { return 1; });"));

    it("is left out because it declares no name", ({ declarations }) => {
      expect(declarations).toStrictEqual([]);
    });
  });

  describe("a destructured binding", () => {
    const it = test.extend("declarations", () =>
      declarationsIn("const { first, second } = readPair();"));

    it("is left out because it declares no single name", ({ declarations }) => {
      expect(declarations).toStrictEqual([]);
    });
  });

  describe("two bindings separated by a blank line", () => {
    const it = test.extend("declarations", () =>
      declarationsIn("const first = 1;\n\nconst second = 2;"));

    it("are each recorded at the line they start on", ({ declarations }) => {
      expect(declarations).toStrictEqual([
        { name: "first", line: 1, structure: LITERAL_ONE_STRUCTURE, nodeCount: 1 },
        { name: "second", line: 3, structure: LITERAL_TWO_STRUCTURE, nodeCount: 1 },
      ]);
    });
  });

  describe("a type alias", () => {
    const it = test.extend("declarations", () => declarationsIn(DRAFT_ALIAS_SOURCE));

    it("is read under the name it was declared with", ({ declarations }) => {
      expect(declarations).toStrictEqual([
        { name: "Draft", line: 1, structure: TITLE_ALIAS_STRUCTURE, nodeCount: 5 },
      ]);
    });
  });

  describe("an interface", () => {
    const it = test.extend("declarations", () => declarationsIn(DRAFT_INTERFACE_SOURCE));

    it("is read under the name it was declared with", ({ declarations }) => {
      expect(declarations).toStrictEqual([
        { name: "Draft", line: 1, structure: TITLE_INTERFACE_STRUCTURE, nodeCount: 5 },
      ]);
    });
  });

  describe("an exported type alias", () => {
    const it = test
      .extend("declarationsOfTheExportedAlias", () =>
        declarationsIn("export type Draft = { readonly title: string };"))
      .extend("declarationsOfTheKeptAlias", () => declarationsIn(DRAFT_ALIAS_SOURCE));

    it("is read as the same declaration as the one kept to its module", ({
      declarationsOfTheExportedAlias,
      declarationsOfTheKeptAlias,
    }) => {
      expect(declarationsOfTheExportedAlias).toStrictEqual(declarationsOfTheKeptAlias);
    });
  });

  describe("a type alias differing from another only in its name", () => {
    const it = test.extend("declarations", () =>
      declarationsIn("type Published = { readonly title: string };"));

    it("is read with the structure the other one is read with", ({ declarations }) => {
      expect(declarations).toStrictEqual([
        { name: "Published", line: 1, structure: TITLE_ALIAS_STRUCTURE, nodeCount: 5 },
      ]);
    });
  });

  describe("two type aliases whose member differs", () => {
    const it = test
      .extend("declarationsTitledWithANumber", () =>
        declarationsIn("type Draft = { readonly title: number };"))
      .extend("declarationsTitledWithAString", () => declarationsIn(DRAFT_ALIAS_SOURCE));

    it("are kept apart", ({ declarationsTitledWithANumber, declarationsTitledWithAString }) => {
      expect(declarationsTitledWithANumber).not.toStrictEqual(declarationsTitledWithAString);
    });
  });

  describe("a parameterised type alias and the plain alias of the same name", () => {
    const it = test
      .extend("declarationsOfTheParameterisedAlias", () =>
        declarationsIn("type Boxed<Held> = { readonly held: Held };"))
      .extend("declarationsOfThePlainAlias", () =>
        declarationsIn("type Boxed = { readonly held: Held };"),
      );

    it("are kept apart because the type parameters stand inside the structure", ({
      declarationsOfTheParameterisedAlias,
      declarationsOfThePlainAlias,
    }) => {
      expect(declarationsOfTheParameterisedAlias).not.toStrictEqual(declarationsOfThePlainAlias);
    });
  });

  describe("an interface and a type alias spelling the same members", () => {
    const it = test
      .extend("declarationsOfTheInterface", () => declarationsIn(DRAFT_INTERFACE_SOURCE))
      .extend("declarationsOfTheAlias", () => declarationsIn(DRAFT_ALIAS_SOURCE));

    it("are kept apart", ({ declarationsOfTheInterface, declarationsOfTheAlias }) => {
      expect(declarationsOfTheInterface).not.toStrictEqual(declarationsOfTheAlias);
    });
  });

  describe("a body written as a single literal", () => {
    const it = test.extend("declarations", () => declarationsIn("const one = 1;"));

    it("is counted as one node", ({ declarations }) => {
      expect(declarations).toStrictEqual([
        { name: "one", line: 1, structure: LITERAL_ONE_STRUCTURE, nodeCount: 1 },
      ]);
    });
  });

  describe("a longer body", () => {
    const it = test.extend("declarations", () =>
      declarationsIn("const twice = (value: number): number => value * 2;"));

    it("is counted as more nodes", ({ declarations }) => {
      expect(declarations).toStrictEqual([
        { name: "twice", line: 1, structure: ANNOTATED_ARROW_DOUBLING_STRUCTURE, nodeCount: 9 },
      ]);
    });
  });
});
