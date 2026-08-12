import { describe, expect, test } from "vite-plus/test";

import { typeDeclarationsIn } from "./type-declarations.ts";

const READONLY_A_STRING_MEMBER =
  '{type:"TSPropertySignature",computed:false,optional:false,readonly:true,key:{type:"Identifier",decorators:[],name:"a",optional:false,typeAnnotation:null},typeAnnotation:{type:"TSTypeAnnotation",typeAnnotation:{type:"TSStringKeyword"}},accessibility:null,static:false}';

const READONLY_B_NUMBER_MEMBER =
  '{type:"TSPropertySignature",computed:false,optional:false,readonly:true,key:{type:"Identifier",decorators:[],name:"b",optional:false,typeAnnotation:null},typeAnnotation:{type:"TSTypeAnnotation",typeAnnotation:{type:"TSNumberKeyword"}},accessibility:null,static:false}';

const READONLY_A_NAMED_MEMBER =
  '{type:"TSPropertySignature",computed:false,optional:false,readonly:true,key:{type:"Identifier",decorators:[],name:"a",optional:false,typeAnnotation:null},typeAnnotation:{type:"TSTypeAnnotation",typeAnnotation:ref(Named,null)},accessibility:null,static:false}';

const READONLY_HELD_STRING_MEMBER =
  '{type:"TSPropertySignature",computed:false,optional:false,readonly:true,key:{type:"Identifier",decorators:[],name:"held",optional:false,typeAnnotation:null},typeAnnotation:{type:"TSTypeAnnotation",typeAnnotation:{type:"TSStringKeyword"}},accessibility:null,static:false}';

const READONLY_HELD_PLACEHOLDER_MEMBER =
  '{type:"TSPropertySignature",computed:false,optional:false,readonly:true,key:{type:"Identifier",decorators:[],name:"held",optional:false,typeAnnotation:null},typeAnnotation:{type:"TSTypeAnnotation",typeAnnotation:ref(#0,null)},accessibility:null,static:false}';

const READONLY_NAMED_NAMED_MEMBER =
  '{type:"TSPropertySignature",computed:false,optional:false,readonly:true,key:{type:"Identifier",decorators:[],name:"named",optional:false,typeAnnotation:null},typeAnnotation:{type:"TSTypeAnnotation",typeAnnotation:ref(Named,null)},accessibility:null,static:false}';

const BASE_HERITAGE =
  '{type:"TSInterfaceHeritage",expression:{type:"Identifier",decorators:[],name:"Base",optional:false,typeAnnotation:null},typeArguments:null}';

const READ_OR_WRITE_ANNOTATION =
  'any{{type:"TSLiteralType",literal:{type:"Literal",value:"read",raw:"\\"read\\""}},{type:"TSLiteralType",literal:{type:"Literal",value:"write",raw:"\\"write\\""}}}';

const ONE_TYPE_PARAMETER =
  '{type:"TSTypeParameterDeclaration",params:[param|#0|null|null|[false,false,false]]}';

const it = test
  .extend("declarationsOfAnAliasOverTwoMembers", () =>
    typeDeclarationsIn("export type Shape = { readonly a: string; readonly b: number };"))
  .extend("declarationsOfAnAliasOverOneMember", () =>
    typeDeclarationsIn("export type Shape = { readonly a: string };"),
  )
  .extend("declarationsOfAnAliasOverAUnion", () =>
    typeDeclarationsIn(`export type Mode = "read" | "write";`),
  )
  .extend("declarationsOfAnInterface", () =>
    typeDeclarationsIn("export interface Shape { readonly a: string }"),
  )
  .extend("declarationsOfAnInterfaceExtendingAnother", () =>
    typeDeclarationsIn("export interface Shape extends Base { readonly a: string }"),
  )
  .extend("declarationsOfAnAliasBelowABinding", () =>
    typeDeclarationsIn("const held = 1;\n\nexport type Shape = { readonly a: string };\n"),
  )
  .extend("declarationsOfAnAliasTakingATypeParameter", () =>
    typeDeclarationsIn("export type Held<T> = { readonly held: T };"),
  )
  .extend("declarationsOfAnAliasHoldingAString", () =>
    typeDeclarationsIn("export type Held = { readonly held: string };"),
  )
  .extend("declarationsOfAnAliasReachingANamedType", () =>
    typeDeclarationsIn("export type Shape = { readonly a: Named };"),
  )
  .extend("declarationsOfAnAliasMixingAParameterWithANamedType", () =>
    typeDeclarationsIn("export type Held<T> = { readonly held: T; readonly named: Named };"),
  )
  .extend("declarationsOfAnUnexportedAlias", () =>
    typeDeclarationsIn("type Shape = { readonly a: string };"),
  )
  .extend("declarationsOfAnExportStatement", () =>
    typeDeclarationsIn("const held = 1;\nexport { held };\n"),
  )
  .extend("declarationsOfAnExportedBinding", () => typeDeclarationsIn("export const held = 1;\n"))
  .extend("declarationsOfAModuleAugmentation", () =>
    typeDeclarationsIn(`declare module "held" { export interface Shape { readonly a: string } }`),
  )
  .extend("declarationsOfTwoInterfacesOfOneName", () =>
    typeDeclarationsIn(
      "export interface Shape { readonly a: string }\nexport interface Shape { readonly b: number }\n",
    ),
  );

describe("typeDeclarationsIn", () => {
  it("an exported type alias over an object literal is read as a member list", ({
    declarationsOfAnAliasOverTwoMembers,
  }) => {
    expect(declarationsOfAnAliasOverTwoMembers).toStrictEqual([
      {
        name: "Shape",
        line: 1,
        kind: "TSTypeAliasDeclaration",
        structure: {
          parameters: [],
          heritage: [],
          members: [READONLY_A_STRING_MEMBER, READONLY_B_NUMBER_MEMBER],
          annotation: [],
        },
        referencesNamedType: false,
        referencedNames: [],
      },
    ]);
  });

  it("an exported type alias over an object literal holds no separate annotation", ({
    declarationsOfAnAliasOverOneMember,
  }) => {
    expect(declarationsOfAnAliasOverOneMember).toStrictEqual([
      {
        name: "Shape",
        line: 1,
        kind: "TSTypeAliasDeclaration",
        structure: {
          parameters: [],
          heritage: [],
          members: [READONLY_A_STRING_MEMBER],
          annotation: [],
        },
        referencesNamedType: false,
        referencedNames: [],
      },
    ]);
  });

  it("an exported type alias over anything else is read as one annotation", ({
    declarationsOfAnAliasOverAUnion,
  }) => {
    expect(declarationsOfAnAliasOverAUnion).toStrictEqual([
      {
        name: "Mode",
        line: 1,
        kind: "TSTypeAliasDeclaration",
        structure: {
          parameters: [],
          heritage: [],
          members: [],
          annotation: [READ_OR_WRITE_ANNOTATION],
        },
        referencesNamedType: false,
        referencedNames: [],
      },
    ]);
  });

  it("an exported type alias over anything else carries no members", ({
    declarationsOfAnAliasOverAUnion,
  }) => {
    expect(declarationsOfAnAliasOverAUnion).toStrictEqual([
      {
        name: "Mode",
        line: 1,
        kind: "TSTypeAliasDeclaration",
        structure: {
          parameters: [],
          heritage: [],
          members: [],
          annotation: [READ_OR_WRITE_ANNOTATION],
        },
        referencesNamedType: false,
        referencedNames: [],
      },
    ]);
  });

  it("an exported interface is read as a member list", ({ declarationsOfAnInterface }) => {
    expect(declarationsOfAnInterface).toStrictEqual([
      {
        name: "Shape",
        line: 1,
        kind: "TSInterfaceDeclaration",
        structure: {
          parameters: [],
          heritage: [],
          members: [READONLY_A_STRING_MEMBER],
          annotation: [],
        },
        referencesNamedType: false,
        referencedNames: [],
      },
    ]);
  });

  it("what an exported interface extends is read as its heritage", ({
    declarationsOfAnInterfaceExtendingAnother,
  }) => {
    expect(declarationsOfAnInterfaceExtendingAnother).toStrictEqual([
      {
        name: "Shape",
        line: 1,
        kind: "TSInterfaceDeclaration",
        structure: {
          parameters: [],
          heritage: [BASE_HERITAGE],
          members: [READONLY_A_STRING_MEMBER],
          annotation: [],
        },
        referencesNamedType: false,
        referencedNames: [],
      },
    ]);
  });

  it("an exported interface carries the interface kind", ({ declarationsOfAnInterface }) => {
    expect(declarationsOfAnInterface).toStrictEqual([
      {
        name: "Shape",
        line: 1,
        kind: "TSInterfaceDeclaration",
        structure: {
          parameters: [],
          heritage: [],
          members: [READONLY_A_STRING_MEMBER],
          annotation: [],
        },
        referencesNamedType: false,
        referencedNames: [],
      },
    ]);
  });

  it("an exported type alias carries the type alias kind", ({
    declarationsOfAnAliasOverOneMember,
  }) => {
    expect(declarationsOfAnAliasOverOneMember).toStrictEqual([
      {
        name: "Shape",
        line: 1,
        kind: "TSTypeAliasDeclaration",
        structure: {
          parameters: [],
          heritage: [],
          members: [READONLY_A_STRING_MEMBER],
          annotation: [],
        },
        referencesNamedType: false,
        referencedNames: [],
      },
    ]);
  });

  it("a declaration is placed at the line its own keyword stands on", ({
    declarationsOfAnAliasBelowABinding,
  }) => {
    expect(declarationsOfAnAliasBelowABinding).toStrictEqual([
      {
        name: "Shape",
        line: 3,
        kind: "TSTypeAliasDeclaration",
        structure: {
          parameters: [],
          heritage: [],
          members: [READONLY_A_STRING_MEMBER],
          annotation: [],
        },
        referencesNamedType: false,
        referencedNames: [],
      },
    ]);
  });

  it("declared type parameters are part of the structure", ({
    declarationsOfAnAliasTakingATypeParameter,
  }) => {
    expect(declarationsOfAnAliasTakingATypeParameter).toStrictEqual([
      {
        name: "Held",
        line: 1,
        kind: "TSTypeAliasDeclaration",
        structure: {
          parameters: [ONE_TYPE_PARAMETER],
          heritage: [],
          members: [READONLY_HELD_PLACEHOLDER_MEMBER],
          annotation: [],
        },
        referencesNamedType: false,
        referencedNames: [],
      },
    ]);
  });

  it("a declaration without type parameters carries none", ({
    declarationsOfAnAliasHoldingAString,
  }) => {
    expect(declarationsOfAnAliasHoldingAString).toStrictEqual([
      {
        name: "Held",
        line: 1,
        kind: "TSTypeAliasDeclaration",
        structure: {
          parameters: [],
          heritage: [],
          members: [READONLY_HELD_STRING_MEMBER],
          annotation: [],
        },
        referencesNamedType: false,
        referencedNames: [],
      },
    ]);
  });

  it("a member annotated with a named type is recorded as reaching one", ({
    declarationsOfAnAliasReachingANamedType,
  }) => {
    expect(declarationsOfAnAliasReachingANamedType).toStrictEqual([
      {
        name: "Shape",
        line: 1,
        kind: "TSTypeAliasDeclaration",
        structure: {
          parameters: [],
          heritage: [],
          members: [READONLY_A_NAMED_MEMBER],
          annotation: [],
        },
        referencesNamedType: true,
        referencedNames: ["Named"],
      },
    ]);
  });

  it("a member annotated with a primitive alone is not recorded as reaching a named type", ({
    declarationsOfAnAliasOverOneMember,
  }) => {
    expect(declarationsOfAnAliasOverOneMember).toStrictEqual([
      {
        name: "Shape",
        line: 1,
        kind: "TSTypeAliasDeclaration",
        structure: {
          parameters: [],
          heritage: [],
          members: [READONLY_A_STRING_MEMBER],
          annotation: [],
        },
        referencesNamedType: false,
        referencedNames: [],
      },
    ]);
  });

  it("a member annotated with the declaration's own type parameter reaches no named type", ({
    declarationsOfAnAliasTakingATypeParameter,
  }) => {
    expect(declarationsOfAnAliasTakingATypeParameter).toStrictEqual([
      {
        name: "Held",
        line: 1,
        kind: "TSTypeAliasDeclaration",
        structure: {
          parameters: [ONE_TYPE_PARAMETER],
          heritage: [],
          members: [READONLY_HELD_PLACEHOLDER_MEMBER],
          annotation: [],
        },
        referencesNamedType: false,
        referencedNames: [],
      },
    ]);
  });

  it("the names a declaration refers to are collected without its own type parameters", ({
    declarationsOfAnAliasMixingAParameterWithANamedType,
  }) => {
    expect(declarationsOfAnAliasMixingAParameterWithANamedType).toStrictEqual([
      {
        name: "Held",
        line: 1,
        kind: "TSTypeAliasDeclaration",
        structure: {
          parameters: [ONE_TYPE_PARAMETER],
          heritage: [],
          members: [READONLY_HELD_PLACEHOLDER_MEMBER, READONLY_NAMED_NAMED_MEMBER],
          annotation: [],
        },
        referencesNamedType: true,
        referencedNames: ["Named"],
      },
    ]);
  });

  it("a type that is not exported is left out", ({ declarationsOfAnUnexportedAlias }) => {
    expect(declarationsOfAnUnexportedAlias).toStrictEqual([]);
  });

  it("an export statement that carries no declaration is left out", ({
    declarationsOfAnExportStatement,
  }) => {
    expect(declarationsOfAnExportStatement).toStrictEqual([]);
  });

  it("an exported binding that declares no type is left out", ({
    declarationsOfAnExportedBinding,
  }) => {
    expect(declarationsOfAnExportedBinding).toStrictEqual([]);
  });

  it("a type exported from inside a module augmentation is left out", ({
    declarationsOfAModuleAugmentation,
  }) => {
    expect(declarationsOfAModuleAugmentation).toStrictEqual([]);
  });

  it("two declarations of one interface name are read one by one", ({
    declarationsOfTwoInterfacesOfOneName,
  }) => {
    expect(declarationsOfTwoInterfacesOfOneName).toStrictEqual([
      {
        name: "Shape",
        line: 1,
        kind: "TSInterfaceDeclaration",
        structure: {
          parameters: [],
          heritage: [],
          members: [READONLY_A_STRING_MEMBER],
          annotation: [],
        },
        referencesNamedType: false,
        referencedNames: [],
      },
      {
        name: "Shape",
        line: 2,
        kind: "TSInterfaceDeclaration",
        structure: {
          parameters: [],
          heritage: [],
          members: [READONLY_B_NUMBER_MEMBER],
          annotation: [],
        },
        referencesNamedType: false,
        referencedNames: [],
      },
    ]);
  });
});
