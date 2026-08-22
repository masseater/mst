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

const READ_OR_WRITE_ANNOTATION = String.raw`any{{type:"TSLiteralType",literal:{type:"Literal",value:"read",raw:"\"read\""}},{type:"TSLiteralType",literal:{type:"Literal",value:"write",raw:"\"write\""}}}`;

const ONE_TYPE_PARAMETER =
  '{type:"TSTypeParameterDeclaration",params:[param|#0|null|null|[false,false,false]]}';

describe("typeDeclarationsIn", () => {
  describe("an exported type alias over an object literal of two members", () => {
    const it = test.extend("declarations", () =>
      typeDeclarationsIn("export type Shape = { readonly a: string; readonly b: number };"));

    it("is read as a member list", ({ declarations }) => {
      expect(declarations).toStrictEqual([
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
  });

  describe("an exported type alias over an object literal of one primitive member", () => {
    const it = test.extend("declarations", () =>
      typeDeclarationsIn("export type Shape = { readonly a: string };"));

    it("holds no separate annotation", ({ declarations }) => {
      expect(declarations).toStrictEqual([
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

    it("carries the type alias kind", ({ declarations }) => {
      expect(declarations).toStrictEqual([
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

    it("is not recorded as reaching a named type", ({ declarations }) => {
      expect(declarations).toStrictEqual([
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
  });

  describe("an exported type alias over anything else", () => {
    const it = test.extend("declarations", () =>
      typeDeclarationsIn(`export type Mode = "read" | "write";`));

    it("is read as one annotation", ({ declarations }) => {
      expect(declarations).toStrictEqual([
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

    it("carries no members", ({ declarations }) => {
      expect(declarations).toStrictEqual([
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
  });

  describe("an exported interface", () => {
    const it = test.extend("declarations", () =>
      typeDeclarationsIn("export interface Shape { readonly a: string }"));

    it("is read as a member list", ({ declarations }) => {
      expect(declarations).toStrictEqual([
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

    it("carries the interface kind", ({ declarations }) => {
      expect(declarations).toStrictEqual([
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
  });

  describe("an exported interface extending another", () => {
    const it = test.extend("declarations", () =>
      typeDeclarationsIn("export interface Shape extends Base { readonly a: string }"));

    it("is read with what it extends as its heritage", ({ declarations }) => {
      expect(declarations).toStrictEqual([
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
  });

  describe("an exported type alias standing below a binding", () => {
    const it = test.extend("declarations", () =>
      typeDeclarationsIn("const held = 1;\n\nexport type Shape = { readonly a: string };\n"));

    it("is placed at the line its own keyword stands on", ({ declarations }) => {
      expect(declarations).toStrictEqual([
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
  });

  describe("an exported type alias taking a type parameter", () => {
    const it = test.extend("declarations", () =>
      typeDeclarationsIn("export type Held<T> = { readonly held: T };"));

    it("carries the declared type parameters as part of the structure", ({ declarations }) => {
      expect(declarations).toStrictEqual([
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

    it("reaches no named type through the member annotated with that parameter", ({
      declarations,
    }) => {
      expect(declarations).toStrictEqual([
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
  });

  describe("an exported type alias holding a string", () => {
    const it = test.extend("declarations", () =>
      typeDeclarationsIn("export type Held = { readonly held: string };"));

    it("carries no type parameters", ({ declarations }) => {
      expect(declarations).toStrictEqual([
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
  });

  describe("an exported type alias whose member is annotated with a named type", () => {
    const it = test.extend("declarations", () =>
      typeDeclarationsIn("export type Shape = { readonly a: Named };"));

    it("is recorded as reaching a named type", ({ declarations }) => {
      expect(declarations).toStrictEqual([
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
  });

  describe("an exported type alias mixing a type parameter with a named type", () => {
    const it = test.extend("declarations", () =>
      typeDeclarationsIn("export type Held<T> = { readonly held: T; readonly named: Named };"));

    it("collects the names it refers to without its own type parameters", ({ declarations }) => {
      expect(declarations).toStrictEqual([
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
  });

  describe("a type alias that is not exported", () => {
    const it = test.extend("declarations", () =>
      typeDeclarationsIn("type Shape = { readonly a: string };"));

    it("is left out", ({ declarations }) => {
      expect(declarations).toStrictEqual([]);
    });
  });

  describe("an export statement that carries no declaration", () => {
    const it = test.extend("declarations", () =>
      typeDeclarationsIn("const held = 1;\nexport { held };\n"));

    it("is left out", ({ declarations }) => {
      expect(declarations).toStrictEqual([]);
    });
  });

  describe("an exported binding that declares no type", () => {
    const it = test.extend("declarations", () => typeDeclarationsIn("export const held = 1;\n"));

    it("is left out", ({ declarations }) => {
      expect(declarations).toStrictEqual([]);
    });
  });

  describe("a type exported from inside a module augmentation", () => {
    const it = test.extend("declarations", () =>
      typeDeclarationsIn(
        `declare module "held" { export interface Shape { readonly a: string } }`,
      ));

    it("is left out", ({ declarations }) => {
      expect(declarations).toStrictEqual([]);
    });
  });

  describe("two declarations of one interface name", () => {
    const it = test.extend("declarations", () =>
      typeDeclarationsIn(
        "export interface Shape { readonly a: string }\nexport interface Shape { readonly b: number }\n",
      ));

    it("are read one by one", ({ declarations }) => {
      expect(declarations).toStrictEqual([
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
});
