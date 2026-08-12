import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import {
  withOwner,
  withThreeValueOwner,
  withoutCatalog,
} from "./canonical-value-rule-test-fixture.ts";

describe("no-local asynchronous callback execution", () => {
  testLintRule(withThreeValueOwner, {
    valid: [
      {
        name: "a fulfilled Promise does not execute its catch callback",
        code: 'Promise.resolve().catch(() => z.enum(["draft", "published"]));',
      },
      {
        name: "a rejected Promise does not execute its fulfillment callback",
        code: 'Promise.reject(0).then(() => z.enum(["draft", "published"]));',
      },
      {
        name: "a shadowed queueMicrotask function does not implicitly execute its callback",
        code: 'function queueMicrotask(_callback: () => void) {}\nqueueMicrotask(() => z.enum(["draft", "published"]));',
      },
      {
        name: "an unrelated then method does not implicitly execute its callback",
        code: 'const task = { then(_callback: () => void) {} };\ntask.then(() => z.enum(["draft", "published"]));',
      },
    ],
    invalid: [
      {
        name: "a fulfilled Promise executes its then callback",
        code: 'Promise.resolve().then(() => z.enum(["draft", "published"]));',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "a rejected Promise executes its catch callback",
        code: 'Promise.reject(0).catch(() => z.enum(["draft", "published"]));',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "a settled Promise executes its finally callback",
        code: 'Promise.resolve().finally(() => z.enum(["draft", "published"]));',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "a Promise continuation observes an earlier continuation mutation",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst values = [...WORKFLOW_STATUSES];\nPromise.resolve().then(() => { values.pop(); }).then(() => z.enum(values));',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Promise then call executes its callback",
        code: 'const promise = Promise.resolve(); promise.then.call(promise, () => z.enum(["draft", "published"]));',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Promise then apply executes its callback",
        code: 'const promise = Promise.resolve(); promise.then.apply(promise, [() => z.enum(["draft", "published"])]);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "Promise then Reflect apply executes its callback",
        code: 'const promise = Promise.resolve(); Reflect.apply(promise.then, promise, [() => z.enum(["draft", "published"])]);',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "a bound Promise then executes its callback",
        code: 'const promise = Promise.resolve(); promise.then.bind(promise)(() => z.enum(["draft", "published"]));',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "queueMicrotask executes its callback",
        code: 'queueMicrotask(() => z.enum(["draft", "published"]));',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
      {
        name: "a later microtask observes an earlier microtask mutation",
        code: 'import { WORKFLOW_STATUSES } from "@mst/workflow-vocabulary";\nconst values = [...WORKFLOW_STATUSES];\nqueueMicrotask(() => { values.pop(); });\nqueueMicrotask(() => z.enum(values));',
        errors: [{ messageId: "localFiniteValueSetWithoutOwner" }],
      },
    ],
  });
});

describe("no-local Promise continuation values", () => {
  testLintRule(withoutCatalog, {
    valid: [],
    invalid: [
      {
        name: "a dynamic import supplies its module to a then callback",
        code: 'import("./shadow.ts").then((module) => z.enum(module.SHADOW_STATUSES));',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a dynamic import supplies destructured members to a then callback",
        code: 'import("./shadow.ts").then(({ SHADOW_STATUSES }) => z.enum(SHADOW_STATUSES));',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
      {
        name: "a Promise callback return supplies the next continuation parameter",
        code: 'import("./shadow.ts").then((module) => module.SHADOW_STATUSES).then((values) => z.enum(values));',
        errors: [{ messageId: "unregisteredCanonicalValuesImportRoute" }],
      },
    ],
  });
});

describe("no-local asynchronous result domains", () => {
  testLintRule(withOwner, {
    valid: [
      {
        name: "a shadowed Promise constructor does not execute its executor callback",
        code: 'function Promise(_executor: () => void) {}\nnew Promise(() => z.enum(["draft", "published"]));',
      },
      {
        name: "an uncalled nested settlement function leaves a Promise pending",
        code: 'new Promise((resolve) => { function settle() { resolve(["draft", "published"] as const); } }).then((values) => z.enum(values));',
      },
      {
        name: "creating a generator without consuming it leaves its yields unexecuted",
        code: 'function* statuses() { yield "draft"; yield "published"; }\nconst iterator = statuses();\nconsume(iterator);',
      },
    ],
    invalid: [
      {
        name: "Promise.all supplies resolved elements to its continuation",
        code: 'export const schema = Promise.all([Promise.resolve("draft"), Promise.resolve("published")]).then((values) => z.enum(values));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "await exposes a local async function return",
        code: 'async function statuses() { return ["draft", "published"] as const; }\nexport const schema = z.enum(await statuses());',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "await exposes a Promise.resolve value",
        code: 'export const schema = z.enum(await Promise.resolve(["draft", "published"] as const));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Array.fromAsync exposes direct iterable elements",
        code: 'export const schema = z.enum(await Array.fromAsync(["draft", "published"] as const));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Array.fromAsync exposes async generator yields",
        code: 'async function* statuses() { yield "draft"; yield "published"; }\nexport const schema = z.enum(await Array.fromAsync(statuses()));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a Promise executor supplies its resolved value to a continuation",
        code: 'export const schema = new Promise((resolve) => resolve(["draft", "published"] as const)).then((values) => z.enum(values));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a Promise executor resolve call supplies its value to a continuation",
        code: 'export const schema = new Promise((resolve) => resolve.call(null, ["draft", "published"] as const)).then((values) => z.enum(values));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a Promise executor Reflect apply supplies its value to a continuation",
        code: 'export const schema = new Promise((resolve) => Reflect.apply(resolve, null, [["draft", "published"] as const])).then((values) => z.enum(values));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an aliased Promise executor resolve supplies its value to a continuation",
        code: 'export const schema = new Promise((resolve) => { const settle = resolve; settle(["draft", "published"] as const); }).then((values) => z.enum(values));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "a bound Promise executor resolve supplies its value to a continuation",
        code: 'export const schema = new Promise((resolve) => { const settle = resolve.bind(null); settle(["draft", "published"] as const); }).then((values) => z.enum(values));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "an invoked nested settlement function supplies its value to a continuation",
        code: 'export const schema = new Promise((resolve) => { function settle() { resolve(["draft", "published"] as const); } settle(); }).then((values) => z.enum(values));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "array spread exposes generator yields",
        code: 'function* statuses() { yield "draft"; yield "published"; }\nexport const schema = z.enum([...statuses()]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Array.from exposes generator yields",
        code: 'function* statuses() { yield "draft"; yield "published"; }\nexport const schema = z.enum(Array.from(statuses()));',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "Set construction exposes generator yields",
        code: 'function* statuses() { yield "draft"; yield "published"; }\nexport const schema = z.enum([...new Set(statuses())]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "iterator next results expose generator yields",
        code: 'function* statuses() { yield "draft"; yield "published"; }\nconst iterator = statuses();\nexport const schema = z.enum([iterator.next().value, iterator.next().value]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "custom iterable spread exposes generator yields",
        code: 'const iterable = { *[Symbol.iterator]() { yield "draft"; yield "published"; } };\nexport const schema = z.enum([...iterable]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
      {
        name: "delegated yield exposes nested iterable values",
        code: 'function* statuses() { yield* ["draft", "published"] as const; }\nexport const schema = z.enum([...statuses()]);',
        errors: [{ messageId: "localFiniteValueSetWithOwner" }],
      },
    ],
  });
});
