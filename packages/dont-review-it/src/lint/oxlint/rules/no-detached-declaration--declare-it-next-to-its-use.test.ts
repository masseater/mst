import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noDetachedDeclaration } from "./no-detached-declaration--declare-it-next-to-its-use.ts";

describe("dont-review-it/no-detached-declaration--declare-it-next-to-its-use", () => {
  testLintRule(noDetachedDeclaration, {
    valid: [
      {
        name: "a declaration standing right in front of the declaration that uses it passes",
        code: "const limit = 200;\nexport const truncate = (lines: readonly string[]) => lines.slice(0, limit);",
      },
      {
        name: "two declarations the same use site names stand together in front of it",
        code: "const lowest = 1;\nconst highest = 200;\nexport const clamp = (lines: readonly string[]) => lines.slice(lowest, highest);",
      },
      {
        name: "a declaration this file never names is left to the rules that count uses",
        code: "const limit = 200;\nexport const read = () => 1;",
      },
      {
        name: "a type this file names once is left to the rule that inlines it",
        code: "type Draft = { readonly title: string };\nexport const read = () => 1;\nexport const title = (draft: Draft) => draft.title;",
      },
      {
        name: "two declarations that name each other stand together",
        code: "const asks = (depth: number): number => (depth === 0 ? 0 : answers(depth - 1));\nconst answers = (depth: number): number => asks(depth);\nexport const walk = () => asks(2);",
      },
      {
        name: "a declaration a test file separates from its use is left alone",
        code: "const limit = 200;\nexport const read = () => 1;\nexport const truncate = (lines: readonly string[]) => lines.slice(0, limit);",
        filename: "/repo/packages/dont-review-it/src/subject.test.ts",
      },
      {
        name: "values a function body names in the order it declares them pass",
        code: "export const summarize = (paths: readonly string[]) => {\n  const trimmed = paths.map((path) => path.trim());\n  const filled = trimmed.filter((path) => path !== '');\n  return filled.length;\n};",
      },
      {
        name: "a value standing in front of the steps that carry the same statement passes",
        code: "export const summarize = (paths: readonly string[]) => {\n  const separator = '/';\n  const trimmed = paths.map((path) => path.trim());\n  const filled = trimmed.filter((path) => path !== '');\n  return filled.map((path) => path.split(separator).length);\n};",
      },
      {
        name: "a value whose initializer runs where it stands keeps the position the order gives it",
        code: "const settings = readSettings();\nexport const read = () => 1;\nexport const apply = () => settings.limit;",
      },
      {
        name: "a timestamp taken before the work it measures keeps its position",
        code: "export const timed = (paths: readonly string[]) => {\n  const startedAt = performance.now();\n  const trimmed = paths.map((path) => path.trim());\n  return { trimmed, elapsed: performance.now() - startedAt };\n};",
      },
      {
        name: "a value read before a write that clears what it read keeps its position",
        code: "export const wake = (queue: { waiters: readonly (() => void)[] }) => {\n  const woken = queue.waiters;\n  queue.waiters = [];\n  return woken;\n};",
      },
      {
        name: "a type reached through a namespace names no declaration in this file",
        code: "export const read = () => 1;\ntype Draft = catalog.Draft;\nexport const copy = (draft: Draft): Draft => draft;",
      },
      {
        name: "a declaration that binds a pattern names nothing this rule can move",
        code: "const [first, second] = pair;\nexport const read = () => 1;\nexport const walk = () => first + second;",
      },
      {
        name: "an export statement that carries no declaration passes",
        code: "const limit = 200;\nexport { limit };",
      },
      {
        name: "a default export that names nothing declares nothing this rule can move",
        code: "export default function () {\n  return 1;\n}\nexport const read = () => 1;",
      },
      {
        name: "a heritage clause reached through a namespace names no declaration in this file",
        code: "export const read = () => 1;\ninterface Draft extends catalog.Entry {\n  readonly body: string;\n}\nexport const copy = (draft: Draft): Draft => draft;",
      },
      {
        name: "an implements clause reached through a namespace names no declaration in this file",
        code: "class Box implements catalog.Shape {\n  readonly kind = 'box';\n}\nexport const boxed = () => new Box();",
      },
    ],
    invalid: [
      {
        name: "a value separated from its use by a declaration that use does not name is reported",
        code: "const limit = 200;\nexport const read = () => 1;\nexport const truncate = (lines: readonly string[]) => lines.slice(0, limit);",
        output:
          "export const read = () => 1;\nconst limit = 200;\n\nexport const truncate = (lines: readonly string[]) => lines.slice(0, limit);",
        errors: [{ messageId: "detachedDeclaration" }],
      },
      {
        name: "a type two declarations agree on is reported where it stands apart",
        code: "type Draft = { readonly title: string };\nexport const read = () => 1;\nexport const copy = (draft: Draft): Draft => draft;",
        output:
          "export const read = () => 1;\ntype Draft = { readonly title: string };\n\nexport const copy = (draft: Draft): Draft => draft;",
        errors: [{ messageId: "detachedDeclaration" }],
      },
      {
        name: "an exported type named once is reported where it stands apart",
        code: "export type Draft = { readonly title: string };\nexport const read = () => 1;\nexport const title = (draft: Draft) => draft.title;",
        output:
          "export const read = () => 1;\nexport type Draft = { readonly title: string };\n\nexport const title = (draft: Draft) => draft.title;",
        errors: [{ messageId: "detachedDeclaration" }],
      },
      {
        name: "a declaration standing after the declaration that uses it is reported without a fix",
        code: "export const walk = () => step();\nexport const read = () => 1;\nconst step = () => 2;",
        errors: [{ messageId: "detachedDeclaration" }],
      },
      {
        name: "an interface a heritage clause names is reported where it stands apart",
        code: "interface Titled {\n  readonly title: string;\n}\nexport const read = () => 1;\ninterface Draft extends Titled {\n  readonly body: string;\n}\nexport const copy = (titled: Titled): Titled => titled;",
        output:
          "export const read = () => 1;\ninterface Titled {\n  readonly title: string;\n}\n\ninterface Draft extends Titled {\n  readonly body: string;\n}\nexport const copy = (titled: Titled): Titled => titled;",
        errors: [{ messageId: "detachedDeclaration" }],
      },
      {
        name: "an interface an implements clause names is reported where it stands apart",
        code: "interface Shape {\n  readonly kind: string;\n}\nexport const read = () => 1;\nclass Box implements Shape {\n  readonly kind = 'box';\n}\nexport const boxed = (shape: Shape): Shape => shape;",
        output:
          "export const read = () => 1;\ninterface Shape {\n  readonly kind: string;\n}\n\nclass Box implements Shape {\n  readonly kind = 'box';\n}\nexport const boxed = (shape: Shape): Shape => shape;",
        errors: [{ messageId: "detachedDeclaration" }],
      },
      {
        name: "a declaration standing on the same line as the rest of the file is reported",
        code: "const limit = 200; export const read = () => 1; export const truncate = (lines: readonly string[]) => lines.slice(0, limit);",
        output:
          " export const read = () => 1; const limit = 200;\n\nexport const truncate = (lines: readonly string[]) => lines.slice(0, limit);",
        errors: [{ messageId: "detachedDeclaration" }],
      },
      {
        name: "an enum standing apart from the declaration that reads it is reported",
        code: "enum Kind {\n  first = 'first',\n}\nexport const read = () => 1;\nexport const pick = () => Kind.first;",
        output:
          "export const read = () => 1;\nenum Kind {\n  first = 'first',\n}\n\nexport const pick = () => Kind.first;",
        errors: [{ messageId: "detachedDeclaration" }],
      },
      {
        name: "a declaration without an initializer is reported where it stands apart",
        code: "declare const limit: number;\nexport const read = () => 1;\nexport const truncate = (lines: readonly string[]) => lines.slice(0, limit);",
        output:
          "export const read = () => 1;\ndeclare const limit: number;\n\nexport const truncate = (lines: readonly string[]) => lines.slice(0, limit);",
        errors: [{ messageId: "detachedDeclaration" }],
      },
      {
        name: "a function declaration standing apart from its call is reported",
        code: "function helper() {\n  return 1;\n}\nexport const read = () => 1;\nexport const walk = () => helper();",
        output:
          "export const read = () => 1;\nfunction helper() {\n  return 1;\n}\n\nexport const walk = () => helper();",
        errors: [{ messageId: "detachedDeclaration" }],
      },
      {
        name: "a declaration carrying a comment moves with the comment",
        code: "/** @canonical-values limits */\nconst limit = 200;\nexport const read = () => 1;\nexport const truncate = (lines: readonly string[]) => lines.slice(0, limit);",
        output:
          "export const read = () => 1;\n/** @canonical-values limits */\nconst limit = 200;\n\nexport const truncate = (lines: readonly string[]) => lines.slice(0, limit);",
        errors: [{ messageId: "detachedDeclaration" }],
      },
      {
        name: "a value a function body declares in front of a step that runs nothing is reported",
        code: "export const summarize = () => {\n  const separator = '/';\n  const limit = 200;\n  const head = separator + 'a';\n  return { head, limit };\n};",
        output:
          "export const summarize = () => {\n  const limit = 200;\n  const separator = '/';\n  const head = separator + 'a';\n  return { head, limit };\n};",
        errors: [{ messageId: "detachedDeclaration" }],
      },
    ],
  });
});
