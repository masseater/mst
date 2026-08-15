import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noReassign } from "./no-reassign--use-spread-or-iife.ts";

const CLASS_STATE_EXCEPTION = [
  "class Holder {",
  "  count = 0;",
  "  reset = () => {",
  "    this.count = 0;",
  "  };",
  "  accessor clear = () => {",
  "    this.count = 0;",
  "  };",
  "  static registry = 0;",
  "  static {",
  "    this.registry = 1;",
  "  }",
  "  constructor(count: number) {",
  "    this.count = count;",
  "  }",
  "  bump() {",
  "    this.count++;",
  "    this['count'] += 1;",
  "  }",
  "  get current() {",
  "    return this.count;",
  "  }",
  "  set current(next: number) {",
  "    this.count = next;",
  "  }",
  "}",
].join("\n");

describe("dont-review-it/no-reassign--use-spread-or-iife", () => {
  testLintRule(noReassign, {
    valid: [
      {
        name: "a single binding declaration is the shape the rule asks for",
        documented: true,
        code: "const base = load();\nconst first = 1,\n  second = 2;",
      },
      {
        name: "options that list no assign-only target leave the platform list in place",
        code: "const base = load();",
        options: [{}],
      },
      {
        name: "a unary operator other than delete writes nothing",
        code: "const negated = -total;\nconst missing = !present;\nconst kind = typeof base;",
      },
      {
        name: "a pattern used by a new declaration binds each name once",
        code: "const [head, ...tail] = entries;\nconst { count, ...rest } = holder;",
      },
      {
        name: "a disposable declaration binds once as well",
        code: "{\n  using handle = open();\n}",
      },
      {
        name: "a per-iteration head creates a fresh binding each round",
        code: "for (const entry of entries) {\n  use(entry);\n}\nfor (let key in holder) {\n  use(named);\n}",
      },
      {
        name: "an ambient declaration has no runtime binding to fix",
        code: 'declare let pending: number;\ndeclare module "m" {\n  let queued: number;\n}',
      },
      {
        name: "a declaration file declares types only",
        code: "let pending: number;",
        filename: "types.d.ts",
      },
      {
        name: "reading and comparing a property writes nothing",
        code: "const total = base.count + 1;\nconst same = base.count === total;\nconst next = { ...base, count: total };",
      },
      {
        name: "a class writes its own state through a direct this or super target",
        documented: true,
        code: CLASS_STATE_EXCEPTION,
      },
      {
        name: "a subclass writes through a direct super target",
        code: "class Child extends Holder {\n  adopt(next: number) {\n    super.count = next;\n  }\n}",
      },
      {
        name: "a type assertion around the receiver does not move the target away from this",
        code: "class Holder {\n  bump() {\n    (this as never).count = 1;\n    (this!).count = 2;\n  }\n}",
      },
      {
        name: "a call that is not one of the enumerated globals is left to its own shape",
        code: 'helpers.assign(base, patch);\nObject.keys(base);\nObject["assign"](base, patch);\nassign(base, patch);\nglobalThis.Object.assign(base, patch);',
      },
      {
        name: "a private method call is not a property-writing global",
        code: "class Holder {\n  #assign(source: number) {\n    return source;\n  }\n  copy(other: Holder) {\n    return other.#assign(1);\n  }\n}",
      },
      {
        name: "a deletion whose target is not a member expression removes no property",
        code: "const dropped = delete parse(text);\nconst gone = delete pending;",
      },
      {
        name: "the process exit code is set the only way the platform offers",
        code: "process.exitCode = 1;",
      },
      {
        name: "a target named by the configuration joins the platform one",
        code: "RuleTester.describe = describe;",
        options: [{ assignOnlyTargets: ["RuleTester.describe"] }],
      },
      {
        name: "the platform target survives a configuration that names others",
        code: "process.exitCode = 1;",
        options: [{ assignOnlyTargets: ["RuleTester.describe"] }],
      },
    ],
    invalid: [
      {
        name: "a re-bindable declaration is reported whether or not it is written to again",
        documented: true,
        code: "let pending = 1;\nvar queued = 2;",
        errors: [
          { messageId: "reassignableDeclaration", data: { kind: "let" } },
          { messageId: "reassignableDeclaration", data: { kind: "var" } },
        ],
      },
      {
        name: "a function-scoped head is one binding reused by every round",
        code: "for (var entry of entries) {\n  use(entry);\n}",
        errors: [{ messageId: "reassignableDeclaration", data: { kind: "var" } }],
      },
      {
        name: "a nested declaration is reported like a top-level one",
        code: "function run() {\n  let pending = 1;\n  return pending;\n}",
        errors: [{ messageId: "reassignableDeclaration" }],
      },
      {
        name: "a namespace that is not ambient still declares a runtime binding",
        code: "namespace Registry {\n  let pending = 1;\n}",
        errors: [{ messageId: "reassignableDeclaration" }],
      },
      {
        name: "an index-advancing loop declares and writes the cursor",
        code: "for (let index = 0; index < 3; index += 1) {\n  use(index);\n}",
        errors: [{ messageId: "reassignableDeclaration" }, { messageId: "identifierAssignment" }],
      },
      {
        name: "a write to an existing name is reported for every assignment operator",
        code: "pending = 2;\npending += 2;\npending ??= 2;",
        errors: [
          { messageId: "identifierAssignment" },
          { messageId: "identifierAssignment" },
          { messageId: "identifierAssignment" },
        ],
      },
      {
        name: "a parameter is an existing binding as well",
        code: "function run(count: number) {\n  count = 1;\n  return count;\n}",
        errors: [{ messageId: "identifierAssignment" }],
      },
      {
        name: "an increment or decrement of a name is reported on its own message",
        code: "pending++;\n--pending;",
        errors: [{ messageId: "identifierUpdate" }, { messageId: "identifierUpdate" }],
      },
      {
        name: "a property write is reported through every access syntax",
        code: 'base.count = 1;\nbase["count"] = 2;\nitems[0] = 3;\nitems.length = 0;\nbase.count += 1;',
        errors: [
          { messageId: "propertyAssignment", line: 1, column: 0, endColumn: 10 },
          { messageId: "propertyAssignment" },
          { messageId: "propertyAssignment" },
          { messageId: "propertyAssignment" },
          { messageId: "propertyAssignment" },
        ],
      },
      {
        name: "a property increment is reported on its own message",
        code: "base.count++;\n--items[0];",
        errors: [{ messageId: "propertyUpdate" }, { messageId: "propertyUpdate" }],
      },
      {
        name: "wrapping the write target in a type operator or parentheses does not change the write",
        code: "(base.count as never) = 1;\n(base.count satisfies never) = 2;\n(<never>base.count) = 3;\nbase!.count = 4;\n(base as Holder).count = 5;\n(base.count) = 6;\n(pending) = 7;",
        errors: [
          { messageId: "propertyAssignment" },
          { messageId: "propertyAssignment" },
          { messageId: "propertyAssignment" },
          { messageId: "propertyAssignment" },
          { messageId: "propertyAssignment" },
          { messageId: "propertyAssignment" },
          { messageId: "identifierAssignment" },
        ],
      },
      {
        name: "a path deeper than the direct this target is outside the class exception",
        code: "class Holder {\n  bump() {\n    this.inner.count = 1;\n    this.inner.count++;\n  }\n}",
        errors: [{ messageId: "propertyAssignment" }, { messageId: "propertyUpdate" }],
      },
      {
        name: "a plain function inside a class member owns its own this",
        code: "class Holder {\n  bump() {\n    function reset() {\n      this.count = 0;\n    }\n    return reset;\n  }\n}",
        errors: [{ messageId: "propertyAssignment" }],
      },
      {
        name: "an object literal method and a top-level this are outside the class exception",
        code: "const holder = {\n  bump() {\n    this.count = 1;\n  },\n};\nthis.count = 2;",
        errors: [{ messageId: "propertyAssignment" }, { messageId: "propertyAssignment" }],
      },
      {
        name: "a property-writing standard call is reported by its shape",
        documented: true,
        code: 'Object.assign(base, patch);\nObject.defineProperty(base, "count", spec);\nObject.defineProperties(base, specs);\nObject.setPrototypeOf(base, proto);\nReflect.set(base, "count", 1);',
        errors: [
          { messageId: "mutatingCall", data: { callee: "Object.assign" } },
          { messageId: "mutatingCall", data: { callee: "Object.defineProperty" } },
          { messageId: "mutatingCall", data: { callee: "Object.defineProperties" } },
          { messageId: "mutatingCall", data: { callee: "Object.setPrototypeOf" } },
          { messageId: "mutatingCall", data: { callee: "Reflect.set" } },
        ],
      },
      {
        name: "a fresh object as the first argument is still reported by the call shape",
        code: "Object.assign({}, patch);\nObject?.assign(base, patch);",
        errors: [
          { messageId: "mutatingCall", data: { callee: "Object.assign" } },
          { messageId: "mutatingCall", data: { callee: "Object.assign" } },
        ],
      },
      {
        name: "a property deletion is reported and has no class exception",
        code: "delete base.count;\ndelete base?.count;\nclass Holder {\n  drop() {\n    delete this.count;\n  }\n}",
        errors: [
          { messageId: "propertyDeletion", line: 1, column: 0, endColumn: 17 },
          { messageId: "propertyDeletion" },
          { messageId: "propertyDeletion" },
        ],
      },
      {
        name: "a pattern assignment without a declaration re-binds existing names",
        code: "[first, second] = pair;\n({ count } = holder);\n[this.count] = pair;",
        errors: [
          { messageId: "patternAssignment" },
          { messageId: "patternAssignment" },
          { messageId: "patternAssignment" },
        ],
      },
      {
        name: "a loop head without a declaration writes to targets that already exist",
        code: "for (entry of entries) {\n}\nfor (base.count in holder) {\n}\nfor ([first, second] of pairs) {\n}",
        errors: [
          { messageId: "identifierAssignment" },
          { messageId: "propertyAssignment" },
          { messageId: "patternAssignment" },
        ],
      },
      {
        name: "another property of an allowed target's receiver is still a write",
        code: "process.env = {};",
        errors: [{ messageId: "propertyAssignment" }],
      },
      {
        name: "reaching an allowed target through a computed key is still a write",
        code: "process['exitCode'] = 1;",
        errors: [{ messageId: "propertyAssignment" }],
      },
      {
        name: "a target the configuration does not name is written to like any other",
        code: "RuleTester.describe = describe;",
        errors: [{ messageId: "propertyAssignment" }],
      },
    ],
  });
});
