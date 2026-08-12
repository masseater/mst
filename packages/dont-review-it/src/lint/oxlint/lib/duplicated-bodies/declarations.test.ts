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

const it = test
  .extend("declarationsOfAnArrowNamedTwice", () =>
    declarationsIn("const twice = (value: number) => value * 2;"))
  .extend("declarationsOfTheSameArrowNamedDoubled", () =>
    declarationsIn("const doubled = (value: number) => value * 2;"),
  )
  .extend("declarationsOfTheSameArrowCarryingComments", () =>
    declarationsIn("/* doubles it */ const twice = (value: number) => /* here */ value * 2;"),
  )
  .extend("declarationsOfTheSameArrowWrappedOverLines", () =>
    declarationsIn("const twice = (\n  value: number,\n) =>\n  value * 2;"),
  )
  .extend("declarationsOfAnArrowCallingStatSync", () =>
    declarationsIn("const read = (path: string) => statSync(path);"),
  )
  .extend("declarationsOfAnArrowCallingReadFileSync", () =>
    declarationsIn("const read = (path: string) => readFileSync(path);"),
  )
  .extend("declarationsOfAnArrowTakingAmount", () =>
    declarationsIn("const twice = (amount: number) => amount * 2;"),
  )
  .extend("declarationsOfAnArrowReportingDraft", () =>
    declarationsIn('const label = () => report("draft");'),
  )
  .extend("declarationsOfAnArrowReportingPublished", () =>
    declarationsIn('const label = () => report("published");'),
  )
  .extend("declarationsOfAParserAnnotatedAsUnknown", () =>
    declarationsIn("const parse: (text: string) => unknown = JSON.parse;"),
  )
  .extend("declarationsOfAParserAnnotatedAsString", () =>
    declarationsIn("const parse: (text: string) => string = JSON.parse;"),
  )
  .extend("declarationsOfAFunctionNamedTwice", () =>
    declarationsIn("function twice(value: number) {\n  return value * 2;\n}"),
  )
  .extend("declarationsOfAnExportedArrowNamedTwice", () =>
    declarationsIn("export const twice = (value: number) => value * 2;"),
  )
  .extend("declarationsOfAnArrowHoldingANestedBinding", () =>
    declarationsIn("const outer = () => {\n  const inner = 1;\n  return inner;\n};"),
  )
  .extend("declarationsOfAnAnonymousFunctionAtACallSite", () =>
    declarationsIn("register(function () { return 1; });"),
  )
  .extend("declarationsOfADestructuredBinding", () =>
    declarationsIn("const { first, second } = readPair();"),
  )
  .extend("declarationsOfTwoBindingsSeparatedByABlankLine", () =>
    declarationsIn("const first = 1;\n\nconst second = 2;"),
  )
  .extend("declarationsOfAnAliasNamedDraft", () =>
    declarationsIn("type Draft = { readonly title: string };"),
  )
  .extend("declarationsOfTheSameAliasNamedPublished", () =>
    declarationsIn("type Published = { readonly title: string };"),
  )
  .extend("declarationsOfAnExportedAliasNamedDraft", () =>
    declarationsIn("export type Draft = { readonly title: string };"),
  )
  .extend("declarationsOfAnInterfaceNamedDraft", () =>
    declarationsIn("interface Draft {\n  readonly title: string;\n}"),
  )
  .extend("declarationsOfAnAliasTitledWithANumber", () =>
    declarationsIn("type Draft = { readonly title: number };"),
  )
  .extend("declarationsOfAParameterisedAliasNamedBoxed", () =>
    declarationsIn("type Boxed<Held> = { readonly held: Held };"),
  )
  .extend("declarationsOfThePlainAliasNamedBoxed", () =>
    declarationsIn("type Boxed = { readonly held: Held };"),
  )
  .extend("declarationsOfAnAnnotatedArrowNamedTwice", () =>
    declarationsIn("const twice = (value: number): number => value * 2;"),
  )
  .extend("declarationsOfABindingHoldingOneLiteral", () => declarationsIn("const one = 1;"));

describe("declarationsIn", () => {
  it("reads an arrow binding under the name it was declared with", ({
    declarationsOfAnArrowNamedTwice,
  }) => {
    expect(declarationsOfAnArrowNamedTwice).toStrictEqual([
      { name: "twice", line: 1, structure: ARROW_DOUBLING_STRUCTURE, nodeCount: 7 },
    ]);
  });

  it("gives two bindings that differ only in name the same structure", ({
    declarationsOfTheSameArrowNamedDoubled,
  }) => {
    expect(declarationsOfTheSameArrowNamedDoubled).toStrictEqual([
      { name: "doubled", line: 1, structure: ARROW_DOUBLING_STRUCTURE, nodeCount: 7 },
    ]);
  });

  it("gives two bindings that differ only in comments the same structure", ({
    declarationsOfTheSameArrowCarryingComments,
    declarationsOfAnArrowNamedTwice,
  }) => {
    expect(declarationsOfTheSameArrowCarryingComments).toStrictEqual(
      declarationsOfAnArrowNamedTwice,
    );
  });

  it("gives two bindings that differ only in formatting the same structure", ({
    declarationsOfTheSameArrowWrappedOverLines,
    declarationsOfAnArrowNamedTwice,
  }) => {
    expect(declarationsOfTheSameArrowWrappedOverLines).toStrictEqual(
      declarationsOfAnArrowNamedTwice,
    );
  });

  it("keeps two bindings apart when the body calls a different name", ({
    declarationsOfAnArrowCallingStatSync,
    declarationsOfAnArrowCallingReadFileSync,
  }) => {
    expect(declarationsOfAnArrowCallingStatSync).not.toStrictEqual(
      declarationsOfAnArrowCallingReadFileSync,
    );
  });

  it("keeps two bindings apart when a parameter is named differently", ({
    declarationsOfAnArrowTakingAmount,
    declarationsOfAnArrowNamedTwice,
  }) => {
    expect(declarationsOfAnArrowTakingAmount).not.toStrictEqual(declarationsOfAnArrowNamedTwice);
  });

  it("keeps two bindings apart when only a string literal differs", ({
    declarationsOfAnArrowReportingDraft,
    declarationsOfAnArrowReportingPublished,
  }) => {
    expect(declarationsOfAnArrowReportingDraft).not.toStrictEqual(
      declarationsOfAnArrowReportingPublished,
    );
  });

  it("keeps the type annotation of a binding inside the structure", ({
    declarationsOfAParserAnnotatedAsUnknown,
    declarationsOfAParserAnnotatedAsString,
  }) => {
    expect(declarationsOfAParserAnnotatedAsUnknown).not.toStrictEqual(
      declarationsOfAParserAnnotatedAsString,
    );
  });

  it("reads a function declaration under the name it was declared with", ({
    declarationsOfAFunctionNamedTwice,
  }) => {
    expect(declarationsOfAFunctionNamedTwice).toStrictEqual([
      { name: "twice", line: 1, structure: FUNCTION_DOUBLING_STRUCTURE, nodeCount: 8 },
    ]);
  });

  it("reads an exported binding", ({
    declarationsOfAnExportedArrowNamedTwice,
    declarationsOfAnArrowNamedTwice,
  }) => {
    expect(declarationsOfAnExportedArrowNamedTwice).toStrictEqual(declarationsOfAnArrowNamedTwice);
  });

  it("leaves a declaration nested inside another declaration out", ({
    declarationsOfAnArrowHoldingANestedBinding,
  }) => {
    expect(declarationsOfAnArrowHoldingANestedBinding).toStrictEqual([
      { name: "outer", line: 1, structure: OUTER_ARROW_STRUCTURE, nodeCount: 8 },
    ]);
  });

  it("leaves an anonymous function written at a call site out", ({
    declarationsOfAnAnonymousFunctionAtACallSite,
  }) => {
    expect(declarationsOfAnAnonymousFunctionAtACallSite).toStrictEqual([]);
  });

  it("leaves a destructured binding out because it declares no single name", ({
    declarationsOfADestructuredBinding,
  }) => {
    expect(declarationsOfADestructuredBinding).toStrictEqual([]);
  });

  it("records the line the declaration starts on", ({
    declarationsOfTwoBindingsSeparatedByABlankLine,
  }) => {
    expect(declarationsOfTwoBindingsSeparatedByABlankLine).toStrictEqual([
      { name: "first", line: 1, structure: LITERAL_ONE_STRUCTURE, nodeCount: 1 },
      { name: "second", line: 3, structure: LITERAL_TWO_STRUCTURE, nodeCount: 1 },
    ]);
  });

  it("reads a type alias under the name it was declared with", ({
    declarationsOfAnAliasNamedDraft,
  }) => {
    expect(declarationsOfAnAliasNamedDraft).toStrictEqual([
      { name: "Draft", line: 1, structure: TITLE_ALIAS_STRUCTURE, nodeCount: 5 },
    ]);
  });

  it("reads an interface under the name it was declared with", ({
    declarationsOfAnInterfaceNamedDraft,
  }) => {
    expect(declarationsOfAnInterfaceNamedDraft).toStrictEqual([
      { name: "Draft", line: 1, structure: TITLE_INTERFACE_STRUCTURE, nodeCount: 5 },
    ]);
  });

  it("reads an exported type alias", ({
    declarationsOfAnExportedAliasNamedDraft,
    declarationsOfAnAliasNamedDraft,
  }) => {
    expect(declarationsOfAnExportedAliasNamedDraft).toStrictEqual(declarationsOfAnAliasNamedDraft);
  });

  it("gives two type aliases that differ only in name the same structure", ({
    declarationsOfTheSameAliasNamedPublished,
  }) => {
    expect(declarationsOfTheSameAliasNamedPublished).toStrictEqual([
      { name: "Published", line: 1, structure: TITLE_ALIAS_STRUCTURE, nodeCount: 5 },
    ]);
  });

  it("keeps two type aliases apart when a member differs", ({
    declarationsOfAnAliasTitledWithANumber,
    declarationsOfAnAliasNamedDraft,
  }) => {
    expect(declarationsOfAnAliasTitledWithANumber).not.toStrictEqual(
      declarationsOfAnAliasNamedDraft,
    );
  });

  it("keeps the type parameters of a type alias inside the structure", ({
    declarationsOfAParameterisedAliasNamedBoxed,
    declarationsOfThePlainAliasNamedBoxed,
  }) => {
    expect(declarationsOfAParameterisedAliasNamedBoxed).not.toStrictEqual(
      declarationsOfThePlainAliasNamedBoxed,
    );
  });

  it("keeps an interface apart from a type alias that spells the same members", ({
    declarationsOfAnInterfaceNamedDraft,
    declarationsOfAnAliasNamedDraft,
  }) => {
    expect(declarationsOfAnInterfaceNamedDraft).not.toStrictEqual(declarationsOfAnAliasNamedDraft);
  });

  it("counts one node for a body written as a single literal", ({
    declarationsOfABindingHoldingOneLiteral,
  }) => {
    expect(declarationsOfABindingHoldingOneLiteral).toStrictEqual([
      { name: "one", line: 1, structure: LITERAL_ONE_STRUCTURE, nodeCount: 1 },
    ]);
  });

  it("counts more nodes for a longer body", ({ declarationsOfAnAnnotatedArrowNamedTwice }) => {
    expect(declarationsOfAnAnnotatedArrowNamedTwice).toStrictEqual([
      { name: "twice", line: 1, structure: ANNOTATED_ARROW_DOUBLING_STRUCTURE, nodeCount: 9 },
    ]);
  });
});
