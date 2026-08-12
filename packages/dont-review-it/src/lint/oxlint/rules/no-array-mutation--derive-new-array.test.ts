import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noArrayMutation } from "./no-array-mutation--derive-new-array.ts";

describe("dont-review-it/no-array-mutation--derive-new-array", () => {
  testLintRule(noArrayMutation, {
    valid: [
      {
        name: "a navigation client named push is not an array",
        code: "const router = useRouter();\nrouter.push('/home');",
      },
      {
        name: "a private method named push is not an array method",
        code: "class Bag {\n  #push(entry) {\n    return entry;\n  }\n  add(entry) {\n    return this.#push(entry);\n  }\n}",
      },
      {
        name: "a member reached through a number names no method",
        code: "const rows = [];\nrows[0](1);",
      },
      {
        name: "a factory reached through a template with a substitution names no factory method",
        code: "Array[`from${suffix}`]([]).push('a');",
      },
      {
        name: "a member reached through a chain that may stop short is not a tracked binding",
        code: "const holder = { items: [] };\n(holder?.items).push('a');",
      },
      {
        name: "a member reached through a template with a substitution names no method",
        code: "const rows = [];\nrows[`push${suffix}`](1);",
      },
      {
        name: "a member reached through a template without a substitution names the method it spells",
        code: "const router = useRouter();\nrouter[`push`]('/home');",
      },
      {
        name: "a type reached through a namespace is not read as an array type",
        code: "const collect = (rows: catalog.Rows) => rows.push(1);",
      },
      {
        name: "a type parameter constrained by one that leads back to it is not an array type",
        code: "const collect = <A extends B, B extends A>(rows: A) => rows.push(1);",
      },
      {
        name: "an undeclared global named push is not an array",
        code: "git.push();",
      },
      {
        name: "a stack class of one's own is not an array",
        code: "class Stack {\n  push(entry: string) {\n    return entry;\n  }\n}\nconst stack = new Stack();\nstack.push('a');",
      },
      {
        name: "a parameter whose annotation only carries a push method is not an array",
        code: "const items: string[] = [];\nconst publish = (items: { push: (entry: string) => void }) => items.push('a');",
      },
      {
        name: "a non-destructive derivation on an array is the accepted form",
        code: "const items: string[] = [];\nconst shouted = items.map((entry) => entry.toUpperCase());",
      },
      {
        name: "a set mutation is outside both this rule and the reassignment rule",
        code: "const seen = new Set<string>();\nseen.add('a');",
      },
      {
        name: "an associative collection mutation is outside both this rule and the reassignment rule",
        code: "const counts = new Map<string, number>();\ncounts.set('a', 1);",
      },
      {
        name: "an index assignment never takes the call form this rule watches",
        code: "const items: string[] = [];\nitems[0] = 'a';",
      },
      {
        name: "a length assignment never takes the call form this rule watches",
        code: "const items: string[] = [];\nitems.length = 0;",
      },
      {
        name: "a key that is only known at runtime hides the method name",
        code: "const key = 'sort';\nconst items: string[] = [];\nitems[key]();",
      },
      {
        name: "a method taken as a binding and called later is not a member call",
        code: "const items: string[] = [];\nconst append = items.push;\nappend('a');",
      },
      {
        name: "call forwarding moves the array out of the receiver position",
        code: "const items: string[] = [];\nArray.prototype.sort.call(items);",
      },
      {
        name: "a receiver reached through a property is out of syntactic reach",
        code: "const board: { items: string[] } = { items: [] };\nboard.items.push('a');",
      },
      {
        name: "an imported binding carries no local declaration to read",
        code: "import { names } from './names.ts';\nnames.push('a');",
      },
      {
        name: "a function call in receiver position carries no annotation to read",
        code: "const loadNames = (): string[] => [];\nloadNames().sort();",
      },
      {
        name: "an alias standing for an array type is not resolved",
        code: "type Names = string[];\nconst publish = (names: Names) => names.push('a');",
      },
      {
        name: "an unannotated parameter is out of syntactic reach",
        code: "const publish = (queue) => queue.push('a');",
      },
      {
        name: "an element taken out of an array by a pattern is not the array itself",
        code: "const publish = (sinks: { push: (entry: string) => void }[]) => {\n  const [first] = sinks;\n  first.push('a');\n};",
      },
      {
        name: "a loop binding over an array is not the array itself",
        code: "const publish = (sinks: { push: (entry: string) => void }[]) => {\n  for (const sink of sinks) {\n    sink.push('a');\n  }\n};",
      },
      {
        name: "a keyof operator over an array type is not itself an array",
        code: "const publish = (keys: keyof string[]) => keys.toString();",
      },
      {
        name: "ordering through the copy-by-change method is an accepted derivation",
        code: "const publish = (items: readonly string[]) => items.toSorted();",
      },
      {
        name: "reversing through the copy-by-change method is an accepted derivation",
        code: "const publish = (items: ReadonlyArray<string>) => items.toReversed();",
      },
      {
        name: "splicing through the copy-by-change method is an accepted derivation",
        code: "const publish = (items: string[]) => items.toSpliced(0, 1);",
      },
      {
        name: "replacing one element through the copy-by-change method is an accepted derivation",
        code: "const publish = (items: string[]) => items.with(0, 'a');",
      },
    ],
    invalid: [
      {
        name: "retrieving from a sliced temporary uses direct element access",
        code: "const items: string[] = [];\nitems.slice(-1).pop();\nitems.slice(-1).shift();",
        errors: [
          { messageId: "slicedTemporaryElementAccess" },
          { messageId: "slicedTemporaryElementAccess" },
        ],
      },
      {
        name: "pushing onto an annotated array is an in-place change",
        code: "const items: string[] = [];\nitems.push('a');",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "a type written in parentheses is read as the array type it wraps",
        code: "const collect = (rows: (number[])) => rows.push(1);",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "an array reached through a wrapper is still that array",
        code: "const items: string[] = [];\nitems!.push('a');",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "an array reached through an optional chain is still that array",
        code: "const items: string[] = [];\nitems?.push('a');",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "a tuple is an array",
        code: "const pair: [string, string] = ['a', 'b'];\npair.push('c');",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "a type that is an array among other things is an array",
        code: "const items: string[] & Tagged = [];\nitems.push('a');",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "an expression checked against an array type where it is written is an array",
        code: "([] satisfies string[]).push('a');",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "an expression asserted with the older syntax where it is written is an array",
        code: "(<string[]>[]).push('a');",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "an expression asserted where it is written is an array",
        code: "([] as string[]).push('a');",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "popping from an annotated array is an in-place change",
        code: "const items: string[] = [];\nitems.pop();",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "splicing an annotated array is an in-place change",
        code: "const items: string[] = [];\nitems.splice(0, 1);",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "sorting a binding initialised with an array literal is an in-place change",
        code: "const items = [3, 1, 2];\nitems.sort();",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "a copy made by spreading gets no exemption from where it came from",
        code: "const items: string[] = [];\nconst ordered = [...items].sort();",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "a copy made by slicing gets no exemption from where it came from",
        code: "const items: string[] = [];\nconst ordered = items.slice().sort();",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "an array built by the Array factory is still an array",
        code: "const input = 'abc';\nArray.from(input).reverse();",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "an array built by the Array constructor is still an array",
        code: "new Array(3).fill(0);",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "a parameter annotated as an array is an array",
        code: "const publish = (items: string[]) => items.unshift('a');",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "a tuple annotation is an array annotation",
        code: "const publish = (pair: [string, number]) => pair.reverse();",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "a union whose member is an array is treated as an array",
        code: "const publish = (items: string[] | undefined) => items?.sort();",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "the generic Array type reference is an array annotation",
        code: "const publish = (items: Array<string>) => items.copyWithin(0, 1);",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "a string literal subscript resolves to the same method name",
        code: "const items: string[] = [];\nitems['sort']();",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "a template literal subscript without substitution resolves to the same method name",
        code: "const items: string[] = [];\nitems[`reverse`]();",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "an assertion to a non-array type does not hide a locally declared array",
        code: "type Sink = { push: (entry: string) => void };\nconst items: string[] = [];\n(items as Sink).push('a');",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "an assertion to an array type makes the receiver an array",
        code: "const publish = (input: unknown) => (input as string[]).push('a');",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "each call in a chain is reported on its own",
        code: "const items: string[] = [];\nitems.sort().reverse();",
        errors: [{ messageId: "inPlaceArrayMutation" }, { messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "a readonly array annotation still makes the receiver an array",
        code: "const publish = (items: readonly string[]) => items.sort();",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "the ReadonlyArray type reference still makes the receiver an array",
        code: "const publish = (items: ReadonlyArray<string>) => items.reverse();",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
      {
        name: "a type parameter constrained to an array is followed to its constraint",
        code: "const publish = <Entries extends readonly string[]>(items: Entries) => items.splice(0, 1);",
        errors: [{ messageId: "inPlaceArrayMutation" }],
      },
    ],
  });
});
