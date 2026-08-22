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
        name: "a type exported by a type-only specifier is left to the module that imports it",
        code: "type Draft = { readonly title: string };\nexport type { Draft };",
      },
      {
        name: "a type renamed by a type-only export specifier is still exported",
        code: "type Draft = { readonly title: string };\nexport type { Draft as PublishedDraft };",
      },
      {
        name: "an interface two declarations agree on passes",
        code: "interface Draft {\n  readonly title: string;\n}\nconst read = (draft: Draft): Draft => draft;",
      },
      {
        name: "an interface with one ordinary use is converted by the official type definition rule first",
        code: "interface Draft {\n  readonly title: string;\n}\nconst read = (draft: Draft) => draft.title;",
      },
      {
        name: "an interface with one implementation is converted by the official type definition rule first",
        code: "interface Parser {\n  parse(): void;\n}\nclass JsonParser implements Parser {\n  parse() {}\n}",
      },
      {
        name: "an interface with one heritage use is converted by the official type definition rule first",
        code: "interface Titled {\n  readonly title: string;\n}\ninterface Draft extends Titled {\n  readonly body: string;\n}",
      },
      {
        name: "a recursive interface is converted by the official type definition rule first",
        code: "interface Branch {\n  readonly child: Branch | null;\n}",
      },
      {
        name: "merged interface declarations remain one contract",
        code: "interface Draft {\n  readonly title: string;\n}\ninterface Draft {\n  readonly body: string;\n}\nconst read = (draft: Draft) => draft.title;",
      },
      {
        name: "an interface merged with a class is part of the class contract",
        code: "class User {}\ninterface User {\n  readonly name: string;\n}\nconst user = new User();\nuser.name;",
      },
      {
        name: "an interface implemented by two concrete classes names a shared contract",
        code: "interface Parser {\n  parse(): void;\n}\nclass JsonParser implements Parser {\n  parse() {}\n}\nclass CsvParser implements Parser {\n  parse() {}\n}",
      },
      {
        name: "a type alias implemented by two concrete classes names a shared contract",
        code: "type Parser = { parse(): void };\nclass JsonParser implements Parser {\n  parse() {}\n}\nclass CsvParser implements Parser {\n  parse() {}\n}",
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
        filename: "/repo/packages/dont-review-it/src/subject.test.ts",
      },
      {
        name: "a global declaration interface remains available for ambient merging",
        code: "interface Window {\n  readonly feature: string;\n}",
        filename: "types/globals.d.ts",
      },
      {
        name: "an ambient alias remains available to declared values",
        code: "type FeatureFlag = string;\ndeclare const feature: FeatureFlag;",
        filename: "types/globals.d.ts",
      },
    ],
    invalid: [
      {
        name: "a type one declaration names is reported",
        code: "type Draft = { readonly title: string };\nconst read = (draft: Draft) => draft.title;",
        errors: [{ messageId: "singleUseLocalTypeAlias" }],
      },
      {
        name: "a type nothing refers to is reported",
        code: "type Draft = { readonly title: string };\nexport const read = () => 1;",
        errors: [{ messageId: "unusedLocalType" }],
      },
      {
        name: "a type alias implemented by one concrete class gets the same executable repair",
        code: "type Parser = { parse(): void };\nclass JsonParser implements Parser {\n  parse() {}\n}",
        errors: [{ messageId: "singleImplementationLocalType" }],
      },
      {
        name: "a type another type declaration names once is reported",
        code: "type Title = { readonly text: string };\ntype Draft = { readonly title: Title };\nconst read = (draft: Draft): Draft => draft;",
        errors: [{ messageId: "singleUseLocalTypeAlias" }],
      },
      {
        name: "a type carrying a type parameter is reported so the argument is substituted at the use site",
        code: "type Boxed<Held> = { readonly held: Held };\nconst read = (boxed: Boxed<string>) => boxed.held;",
        errors: [{ messageId: "singleUseLocalTypeAlias" }],
      },
      {
        name: "a free type name shadowed at the use site requires alpha-renaming before inlining",
        code: "import type { Scalar } from './types.ts';\ntype Boxed = { readonly held: Scalar };\nexport const read = <Scalar>(boxed: Boxed) => boxed.held;",
        errors: [{ message: /Alpha-rename every use-site binding/u }],
      },
      {
        name: "a type alias named once by an extends clause gets the same executable repair",
        code: "type Titled = { readonly title: string };\ninterface Draft extends Titled {\n  readonly body: string;\n}\nconst read = (draft: Draft): Draft => draft;",
        errors: [{ messageId: "singleInterfaceHeritageLocalType" }],
      },
      {
        name: "a recursive type reached only from itself is deleted rather than inlined",
        code: "type Branch = { readonly children: readonly Branch[] };",
        errors: [{ messageId: "selfOnlyLocalType" }],
      },
      {
        name: "a generic type parameter with the same name does not count for the top-level alias",
        code: "type Draft = { readonly title: string };\nexport const read = <Draft>(draft: Draft): Draft => draft;",
        errors: [{ messageId: "unusedLocalType" }],
      },
      {
        name: "a nested interface with the same name owns its own references",
        code: "type Draft = { readonly title: string };\nexport const read = () => {\n  interface Draft {\n    readonly count: number;\n  }\n  const draft: Draft = { count: 1 };\n  return draft;\n};",
        errors: [{ messageId: "unusedLocalType" }],
      },
      {
        name: "shadowed generic references do not turn one real top-level use into sharing",
        code: "type Draft = { readonly title: string };\nexport const read = (draft: Draft) => draft.title;\nexport const echo = <Draft>(draft: Draft): Draft => draft;",
        errors: [{ messageId: "singleUseLocalTypeAlias" }],
      },
      {
        name: "an interface type parameter with the same name does not reach the top-level alias",
        code: "type Draft = { readonly title: string };\nexport interface Box<Draft> {\n  readonly held: Draft;\n}",
        errors: [{ messageId: "unusedLocalType" }],
      },
      {
        name: "references to a value binding with the same name do not count as type references",
        code: "type Draft = { readonly title: string };\nconst Draft = { title: 'draft' };\nexport const read = () => Draft.title;",
        errors: [{ messageId: "unusedLocalType" }],
      },
    ],
  });
});
