import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { withoutCatalog } from "./canonical-value-rule-test-fixture.ts";

const error = { messageId: "localFiniteValueSetWithoutOwner" } as const;

describe("canonical value primitive type domains", () => {
  testLintRule(withoutCatalog, {
    valid: [
      {
        name: "a broad string union is not a finite vocabulary",
        code: 'export type Status = "draft" | "published" | string;',
      },
      {
        name: "a single literal alias is not a vocabulary",
        code: 'export type Status = "draft";',
      },
      {
        name: "a two-valued boolean alias is not a vocabulary",
        code: "export type Enabled = true | false;",
      },
      {
        name: "a broad mapped key domain is not a finite vocabulary",
        code: "export type Status = keyof { [K in string]: 0 };",
      },
      {
        name: "a lexical Extract alias shadows the standard utility",
        code: 'type Extract<T, U> = string; export type Status = Extract<"draft" | "published", string>;',
      },
      {
        name: "a lexical Exclude alias shadows the standard utility",
        code: 'type Exclude<T, U> = string; export type Status = Exclude<"draft" | "published", null>;',
      },
      {
        name: "a lexical ReturnType alias shadows the standard utility",
        code: 'type ReturnType<T> = string; export type Status = ReturnType<() => "draft" | "published">;',
      },
      {
        name: "a lexical Awaited alias shadows the standard utility",
        code: 'type Awaited<T> = string; export type Status = Awaited<Promise<"draft" | "published">>;',
      },
      {
        name: "a lexical NonNullable alias shadows the standard utility",
        code: 'type NonNullable<T> = string; export type Status = NonNullable<"draft" | "published" | null>;',
      },
      {
        name: "a lexical Lowercase alias shadows the standard utility",
        code: 'type Lowercase<T> = string; export type Status = Lowercase<"DRAFT" | "PUBLISHED">;',
      },
      {
        name: "a lexical Parameters alias shadows the standard utility",
        code: 'type Parameters<T> = [string]; export type Status = Parameters<(value: "draft" | "published") => void>[0];',
      },
    ],
    invalid: [
      {
        name: "a string enum defines a local finite vocabulary",
        code: 'export enum Status { Draft = "draft", Published = "published" }',
        errors: [error],
      },
      {
        name: "a const string enum defines a local finite vocabulary",
        code: 'export const enum Status { Draft = "draft", Published = "published" }',
        errors: [error],
      },
      {
        name: "an automatic numeric enum defines a local finite vocabulary",
        code: "export enum Retry { Never, Once, Twice }",
        errors: [error],
      },
      {
        name: "a finite template literal type defines a local vocabulary",
        code: 'export type Status = `order-${"draft" | "published"}`;',
        errors: [error],
      },
      {
        name: "a generic identity cannot hide a local literal union",
        code: 'type Identity<T> = T; export type Status = Identity<"draft" | "published">;',
        errors: [error],
      },
      {
        name: "an intersection cannot hide a local literal union",
        code: 'export type Status = ("draft" | "published") & string;',
        errors: [error],
      },
      {
        name: "a conditional type cannot hide a local literal union",
        code: 'export type Status<T extends boolean> = T extends true ? "draft" : "published";',
        errors: [error],
      },
      {
        name: "a statically true conditional excludes its broad false branch",
        code: 'export type Status = "x" extends string ? "draft" | "published" : string;',
        errors: [error],
      },
      {
        name: "a statically false conditional excludes its broad true branch",
        code: 'export type Status = 1 extends string ? string : "draft" | "published";',
        errors: [error],
      },
      {
        name: "Extract cannot hide a local literal union",
        code: 'export type Status = Extract<"draft" | "published" | 0, string>;',
        errors: [error],
      },
      {
        name: "Exclude cannot hide a local literal union",
        code: 'export type Status = Exclude<"draft" | "published" | null, null>;',
        errors: [error],
      },
      {
        name: "Extract resolves an aliased filter",
        code: 'type Allowed = string; export type Status = Extract<"draft" | "published" | 0, Allowed>;',
        errors: [error],
      },
      {
        name: "Exclude resolves an aliased filter",
        code: 'type Excluded = null; export type Status = Exclude<"draft" | "published" | null, Excluded>;',
        errors: [error],
      },
      {
        name: "ReturnType cannot hide a local literal union",
        code: 'export type Status = ReturnType<() => "draft" | "published">;',
        errors: [error],
      },
      {
        name: "ReturnType resolves a function declaration query",
        code: 'declare function status(): "draft" | "published"; export type Status = ReturnType<typeof status>;',
        errors: [error],
      },
      {
        name: "ReturnType resolves a named callable alias",
        code: 'type Factory = () => "draft" | "published"; export type Status = ReturnType<Factory>;',
        errors: [error],
      },
      {
        name: "an indexed Parameters result cannot hide a local literal union",
        code: 'export type Status = Parameters<(value: "draft" | "published") => void>[0];',
        errors: [error],
      },
      {
        name: "Parameters resolves a function declaration query",
        code: 'declare function consume(status: "draft" | "published"): void; export type Status = Parameters<typeof consume>[0];',
        errors: [error],
      },
      {
        name: "Awaited cannot hide a local literal union",
        code: 'export type Status = Awaited<Promise<"draft" | "published">>;',
        errors: [error],
      },
      {
        name: "Awaited distributes over promise union members",
        code: 'export type Status = Awaited<Promise<"draft"> | Promise<"published">>;',
        errors: [error],
      },
      {
        name: "NonNullable cannot hide a local literal union",
        code: 'export type Status = NonNullable<"draft" | "published" | null>;',
        errors: [error],
      },
      {
        name: "a direct indexed type cannot hide a local literal union",
        code: 'export type Status = { status: "draft" | "published" }["status"];',
        errors: [error],
      },
      {
        name: "an indexed named object alias cannot hide a local literal union",
        code: 'type Box = { status: "draft" | "published" }; export type Status = Box["status"];',
        errors: [error],
      },
      {
        name: "an indexed interface cannot hide a local literal union",
        code: 'interface Box { status: "draft" | "published" } export type Status = Box["status"];',
        errors: [error],
      },
      {
        name: "an inferred conditional alias cannot hide a local literal union",
        code: 'type Unwrap<T> = T extends Promise<infer U> ? U : never; export type Status = Unwrap<Promise<"draft" | "published">>;',
        errors: [error],
      },
      {
        name: "Lowercase cannot hide a local literal union",
        code: 'export type Status = Lowercase<"DRAFT" | "PUBLISHED">;',
        errors: [error],
      },
      {
        name: "a mapped keyof type cannot hide a local literal union",
        code: 'export type Status = keyof { [K in "draft" | "published"]: 0 };',
        errors: [error],
      },
      {
        name: "a named mapped keyof type cannot hide a local literal union",
        code: 'type Map = { [K in "draft" | "published"]: 0 }; export type Status = keyof Map;',
        errors: [error],
      },
    ],
  });
});
