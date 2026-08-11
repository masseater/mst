import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { canonicalTextOf, placeholdersIn, referencedTypeNamesIn } from "./canonical-text.ts";

const firstStatementIn = (source: string): unknown =>
  parseSync("source.ts", source).program.body[0];

const canonicalOf = (source: string): string => {
  const statement = firstStatementIn(source);
  return canonicalTextOf(statement, placeholdersIn(statement));
};

describe("canonicalTextOf", () => {
  test("members written in a different order read as the same structure", () => {
    expect(canonicalOf("export type Shape = { readonly a: string; readonly b: number };")).toBe(
      canonicalOf("export type Shape = { readonly b: number; readonly a: string };"),
    );
  });

  test("union arms written in a different order read as the same structure", () => {
    expect(canonicalOf(`export type Mode = "read" | "write";`)).toBe(
      canonicalOf(`export type Mode = "write" | "read";`),
    );
  });

  test("intersection parts written in a different order read as the same structure", () => {
    expect(canonicalOf("export type Both = Left & Right;")).toBe(
      canonicalOf("export type Both = Right & Left;"),
    );
  });

  test("a member marked readonly reads apart from the same member without it", () => {
    expect(canonicalOf("export type Shape = { readonly a: string };")).not.toBe(
      canonicalOf("export type Shape = { a: string };"),
    );
  });

  test("a member marked optional reads apart from the same member without it", () => {
    expect(canonicalOf("export type Shape = { a?: string };")).not.toBe(
      canonicalOf("export type Shape = { a: string };"),
    );
  });

  test("type parameters renamed throughout read as the same structure", () => {
    expect(canonicalOf("export type Held<T> = { readonly held: T; readonly next: Held<T> };")).toBe(
      canonicalOf("export type Held<U> = { readonly held: U; readonly next: Held<U> };"),
    );
  });

  test("a type parameter renamed inside a member signature reads as the same structure", () => {
    expect(canonicalOf("export type Held = { readonly map: <T>(held: T) => T };")).toBe(
      canonicalOf("export type Held = { readonly map: <U>(held: U) => U };"),
    );
  });

  test("a type parameter constraint is part of the structure", () => {
    expect(canonicalOf("export type Held<T extends string> = { readonly held: T };")).not.toBe(
      canonicalOf("export type Held<T extends number> = { readonly held: T };"),
    );
  });

  test("a type parameter default is part of the structure", () => {
    expect(canonicalOf("export type Held<T = string> = { readonly held: T };")).not.toBe(
      canonicalOf("export type Held<T> = { readonly held: T };"),
    );
  });

  test("a reference to a named type keeps the name it refers to", () => {
    expect(canonicalOf("export type Shape = { readonly a: Named };")).not.toBe(
      canonicalOf("export type Shape = { readonly a: Other };"),
    );
  });

  test("a reference through a namespace reads apart from a bare reference to the same name", () => {
    expect(canonicalOf("export type Shape = { readonly a: held.Named };")).not.toBe(
      canonicalOf("export type Shape = { readonly a: Named };"),
    );
  });

  test("references through two different namespaces read apart from each other", () => {
    expect(canonicalOf("export type Shape = { readonly a: held.Named };")).not.toBe(
      canonicalOf("export type Shape = { readonly a: other.Named };"),
    );
  });

  test("type arguments are part of a reference", () => {
    expect(canonicalOf("export type Shape = { readonly a: Named<string> };")).not.toBe(
      canonicalOf("export type Shape = { readonly a: Named<number> };"),
    );
  });
});

describe("placeholdersIn", () => {
  test("every declared type parameter is bound to the position it was declared at", () => {
    expect([
      ...placeholdersIn(
        firstStatementIn("export type Pair<Left, Right> = readonly [Left, Right];"),
      ).entries(),
    ]).toStrictEqual([
      ["Left", "#0"],
      ["Right", "#1"],
    ]);
  });

  test("a declaration without type parameters binds nothing", () => {
    expect(placeholdersIn(firstStatementIn("export type Held = string;")).size).toBe(0);
  });
});

describe("referencedTypeNamesIn", () => {
  test("every bare name a declaration refers to is collected in the order it appears", () => {
    expect(
      referencedTypeNamesIn(
        firstStatementIn("export type Shape = { readonly a: Named; readonly b: Other<Third> };"),
      ),
    ).toStrictEqual(["Named", "Other", "Third"]);
  });

  test("a name reached through a namespace is not collected as a bare name", () => {
    expect(
      referencedTypeNamesIn(firstStatementIn("export type Shape = { readonly a: held.Named };")),
    ).toStrictEqual([]);
  });
});
