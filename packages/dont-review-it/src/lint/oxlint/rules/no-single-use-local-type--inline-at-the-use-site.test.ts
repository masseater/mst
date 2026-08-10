import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noSingleUseLocalType } from "./no-single-use-local-type--inline-at-the-use-site.ts";

describe("dont-review-it/no-single-use-local-type--inline-at-the-use-site", () => {
  testLintRule(noSingleUseLocalType, {
    valid: [
      {
        name: "a type two declarations agree on passes",
        code: "type Draft = { readonly title: string };\nconst read = (draft: Draft): Draft => draft;",
      },
      {
        name: "a type reached through a namespace names no local declaration",
        code: "type Draft = catalog.Draft;\nconst read = (draft: Draft): Draft => draft;",
      },
      {
        name: "a heritage clause reached through a namespace names no local declaration",
        code: "interface Draft extends catalog.Entry {}\nconst read = (draft: Draft): Draft => draft;",
      },
      {
        name: "an implements clause reached through a namespace names no local declaration",
        code: "class Draft implements catalog.Entry {}\nclass Copy implements Draft {}",
      },
      {
        name: "an exported type is left to the module that imports it",
        code: "export type Draft = { readonly title: string };\nexport const read = (draft: Draft) => draft.title;",
      },
      {
        name: "an interface two declarations agree on passes",
        code: "interface Draft {\n  readonly title: string;\n}\nconst read = (draft: Draft): Draft => draft;",
      },
      {
        name: "a type that refers to itself counts that reference, so one use site is enough",
        code: "type Branch = { readonly children: readonly Branch[] };\nconst read = (branch: Branch) => branch.children;",
      },
      {
        name: "a type declared inside a function is not a top level declaration",
        code: "export const read = () => {\n  type Draft = { readonly title: string };\n  const draft: Draft = { title: '' };\n  return draft;\n};",
      },
      {
        name: "a type a test file declares is left alone",
        code: "type Draft = { readonly title: string };\nconst read = (draft: Draft) => draft.title;",
        filename: "packages/dont-review-it/src/subject.test.ts",
      },
    ],
    invalid: [
      {
        name: "a type one declaration names is reported",
        code: "type Draft = { readonly title: string };\nconst read = (draft: Draft) => draft.title;",
        errors: [{ messageId: "singleUseLocalType" }],
      },
      {
        name: "a type nothing refers to is reported",
        code: "type Draft = { readonly title: string };\nexport const read = () => 1;",
        errors: [{ messageId: "singleUseLocalType" }],
      },
      {
        name: "an interface one declaration names is reported",
        code: "interface Draft {\n  readonly title: string;\n}\nconst read = (draft: Draft) => draft.title;",
        errors: [{ messageId: "singleUseLocalType" }],
      },
      {
        name: "a type another type declaration names once is reported",
        code: "type Title = { readonly text: string };\ntype Draft = { readonly title: Title };\nconst read = (draft: Draft): Draft => draft;",
        errors: [{ messageId: "singleUseLocalType" }],
      },
      {
        name: "a type carrying a type parameter is reported so the argument is substituted at the use site",
        code: "type Boxed<Held> = { readonly held: Held };\nconst read = (boxed: Boxed<string>) => boxed.held;",
        errors: [{ messageId: "singleUseLocalType" }],
      },
      {
        name: "an interface named once by an extends clause is reported",
        code: "interface Titled {\n  readonly title: string;\n}\ninterface Draft extends Titled {\n  readonly body: string;\n}\nconst read = (draft: Draft): Draft => draft;",
        errors: [{ messageId: "singleUseLocalType" }],
      },
    ],
  });
});
