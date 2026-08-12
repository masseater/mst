import { describe, expect, test } from "vite-plus/test";

import { typeDeclarationsIn } from "./type-declarations.ts";

describe("typeDeclarationsIn", () => {
  test("an exported type alias over an object literal is read as a member list", () => {
    const [declaration] = typeDeclarationsIn(
      "export type Shape = { readonly a: string; readonly b: number };",
    );

    expect(declaration?.structure.members.length).toBe(2);
  });

  test("an exported type alias over an object literal holds no separate annotation", () => {
    const [declaration] = typeDeclarationsIn("export type Shape = { readonly a: string };");

    expect(declaration?.structure.annotation).toStrictEqual([]);
  });

  test("an exported type alias over anything else is read as one annotation", () => {
    const [declaration] = typeDeclarationsIn(`export type Mode = "read" | "write";`);

    expect(declaration?.structure.annotation.length).toBe(1);
  });

  test("an exported type alias over anything else carries no members", () => {
    const [declaration] = typeDeclarationsIn(`export type Mode = "read" | "write";`);

    expect(declaration?.structure.members).toStrictEqual([]);
  });

  test("an exported interface is read as a member list", () => {
    const [declaration] = typeDeclarationsIn("export interface Shape { readonly a: string }");

    expect(declaration?.structure.members.length).toBe(1);
  });

  test("what an exported interface extends is read as its heritage", () => {
    const [declaration] = typeDeclarationsIn(
      "export interface Shape extends Base { readonly a: string }",
    );

    expect(declaration?.structure.heritage.length).toBe(1);
  });

  test("an exported interface carries the interface kind", () => {
    const [declaration] = typeDeclarationsIn("export interface Shape { readonly a: string }");

    expect(declaration?.kind).toBe("TSInterfaceDeclaration");
  });

  test("an exported type alias carries the type alias kind", () => {
    const [declaration] = typeDeclarationsIn("export type Shape = { readonly a: string };");

    expect(declaration?.kind).toBe("TSTypeAliasDeclaration");
  });

  test("a declaration is placed at the line its own keyword stands on", () => {
    const [declaration] = typeDeclarationsIn(
      "const held = 1;\n\nexport type Shape = { readonly a: string };\n",
    );

    expect(declaration?.line).toBe(3);
  });

  test("declared type parameters are part of the structure", () => {
    const [declaration] = typeDeclarationsIn("export type Held<T> = { readonly held: T };");

    expect(declaration?.structure.parameters.length).toBe(1);
  });

  test("a declaration without type parameters carries none", () => {
    const [declaration] = typeDeclarationsIn("export type Held = { readonly held: string };");

    expect(declaration?.structure.parameters).toStrictEqual([]);
  });

  test("a member annotated with a named type is recorded as reaching one", () => {
    const [declaration] = typeDeclarationsIn("export type Shape = { readonly a: Named };");

    expect(declaration?.referencesNamedType).toBe(true);
  });

  test("a member annotated with a primitive alone is not recorded as reaching a named type", () => {
    const [declaration] = typeDeclarationsIn("export type Shape = { readonly a: string };");

    expect(declaration?.referencesNamedType).toBe(false);
  });

  test("a member annotated with the declaration's own type parameter reaches no named type", () => {
    const [declaration] = typeDeclarationsIn("export type Held<T> = { readonly held: T };");

    expect(declaration?.referencesNamedType).toBe(false);
  });

  test("the names a declaration refers to are collected without its own type parameters", () => {
    const [declaration] = typeDeclarationsIn(
      "export type Held<T> = { readonly held: T; readonly named: Named };",
    );

    expect(declaration?.referencedNames).toStrictEqual(["Named"]);
  });

  test("a type that is not exported is left out", () => {
    expect(typeDeclarationsIn("type Shape = { readonly a: string };")).toStrictEqual([]);
  });

  test("an export statement that carries no declaration is left out", () => {
    expect(typeDeclarationsIn("const held = 1;\nexport { held };\n")).toStrictEqual([]);
  });

  test("an exported binding that declares no type is left out", () => {
    expect(typeDeclarationsIn("export const held = 1;\n")).toStrictEqual([]);
  });

  test("a type exported from inside a module augmentation is left out", () => {
    expect(
      typeDeclarationsIn(`declare module "held" { export interface Shape { readonly a: string } }`),
    ).toStrictEqual([]);
  });

  test("two declarations of one interface name are read one by one", () => {
    expect(
      typeDeclarationsIn(
        "export interface Shape { readonly a: string }\nexport interface Shape { readonly b: number }\n",
      ).map((declaration) => declaration.name),
    ).toStrictEqual(["Shape", "Shape"]);
  });
});
