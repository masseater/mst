import { describe, expect, test } from "vite-plus/test";

import { analyzeCanonicalValuesRepository } from "./builder.ts";
import {
  annotateCanonicalValues,
  createCanonicalValuesTestRepository,
  writeCanonicalValuesTestFile,
} from "./canonical-values-test-fixture.ts";

const analyzeMutation = (mutation: string) => {
  const repositoryRoot = createCanonicalValuesTestRepository();
  writeCanonicalValuesTestFile({
    repositoryRoot,
    relativePath: "src/values.ts",
    contents: `${annotateCanonicalValues(
      "order.status",
      'export const VALUES = ["draft", "published"] as const;',
    )}${mutation}`,
  });
  return analyzeCanonicalValuesRepository({ repositoryRoot });
};

describe("canonical owner execution", () => {
  test.each([
    "[0].forEach(() => (VALUES as unknown as string[]).pop());",
    "Array.from([0], () => (VALUES as unknown as string[]).pop());",
    "new Set([0]).forEach(() => (VALUES as unknown as string[]).pop());",
    "Promise.resolve().then(() => (VALUES as unknown as string[]).pop());",
    "queueMicrotask(() => (VALUES as unknown as string[]).pop());",
    "setTimeout(() => (VALUES as unknown as string[]).pop(), 0);",
    "setInterval(() => (VALUES as unknown as string[]).pop(), 0);",
    "const schedule = queueMicrotask; schedule(() => (VALUES as unknown as string[]).pop());",
    "queueMicrotask.call(undefined, () => (VALUES as unknown as string[]).pop());",
    "queueMicrotask.apply(undefined, [() => (VALUES as unknown as string[]).pop()]);",
    "Reflect.apply(queueMicrotask, undefined, [() => (VALUES as unknown as string[]).pop()]);",
    "queueMicrotask.bind(undefined)(() => (VALUES as unknown as string[]).pop());",
    "const schedule = queueMicrotask.bind(undefined, () => (VALUES as unknown as string[]).pop()); schedule();",
    "const promise = Promise.resolve(); promise.then.call(promise, () => (VALUES as unknown as string[]).pop());",
    "const promise = Promise.resolve(); promise.then.apply(promise, [() => (VALUES as unknown as string[]).pop()]);",
    "const promise = Promise.resolve(); Reflect.apply(promise.then, promise, [() => (VALUES as unknown as string[]).pop()]);",
    "const promise = Promise.resolve(); promise.then.bind(promise)(() => (VALUES as unknown as string[]).pop());",
    "const promise = Promise.resolve(); const then = promise.then.bind(promise); then(() => (VALUES as unknown as string[]).pop());",
    'Object.groupBy([0], () => { (VALUES as unknown as string[]).pop(); return "status"; });',
    "Map.groupBy([0], () => { (VALUES as unknown as string[]).pop(); return 0; });",
    '"status".replace("status", () => { (VALUES as unknown as string[]).pop(); return ""; });',
    '"status".replaceAll("status", () => { (VALUES as unknown as string[]).pop(); return ""; });',
    'JSON.parse("{}", () => { (VALUES as unknown as string[]).pop(); return undefined; });',
    "JSON.stringify({ value: 1 }, () => { (VALUES as unknown as string[]).pop(); return undefined; });",
    "const holder = { get values() { (VALUES as unknown as string[]).pop(); return 1; } }; consume(holder.values);",
    "class Mutator { constructor() { (VALUES as unknown as string[]).pop(); } } new Mutator();",
    "function mutate(_parts: TemplateStringsArray) { (VALUES as unknown as string[]).pop(); } mutate`now`;",
    "function* mutate() { (VALUES as unknown as string[]).pop(); } mutate().next();",
    "function run(value = (VALUES as unknown as string[]).pop()) {} run();",
    "function run({ value = (VALUES as unknown as string[]).pop() } = {}) {} run();",
    "class Used { constructor(value = (VALUES as unknown as string[]).pop()) {} } new Used();",
    "function run(value = (VALUES as unknown as string[]).pop()) {} const alias = run; alias();",
    "class Mutator { [(VALUES as unknown as string[]).pop()] = 0; }",
    "class Mutator { static value = (VALUES as unknown as string[]).pop(); }",
    "class Mutator { value = (VALUES as unknown as string[]).pop(); } new Mutator();",
    "const Mutator = class { value = (VALUES as unknown as string[]).pop(); }; new Mutator();",
    "function execute(callback: () => void) { callback(); } execute(() => { (VALUES as unknown as string[]).pop(); });",
    "void new Promise<void>((resolve) => { (VALUES as unknown as string[]).pop(); resolve(); });",
    'const target = new EventTarget(); target.addEventListener("status", () => { (VALUES as unknown as string[]).pop(); }); target.dispatchEvent(new Event("status"));',
    'const holder = {}; Object.defineProperty(holder, "value", { get() { (VALUES as unknown as string[]).pop(); return 1; } }); consume((holder as { value: number }).value);',
    "const proxy = new Proxy({}, { get() { (VALUES as unknown as string[]).pop(); return 1; } }); consume(proxy.value);",
    "const iterable = { [Symbol.iterator]() { (VALUES as unknown as string[]).pop(); return [][Symbol.iterator](); } }; for (const value of iterable) consume(value);",
    'const value = { [Symbol.toPrimitive]() { (VALUES as unknown as string[]).pop(); return "status"; } }; String(value);',
    "{ using resource = { [Symbol.dispose]() { (VALUES as unknown as string[]).pop(); } }; consume(resource); }",
    'const opaque = Symbol() as any; try { opaque + ""; } catch { (VALUES as unknown as string[]).pop(); }',
    'const source = new Proxy({ value: 1 }, { get() { throw new Error("get"); } }); try { const { value } = source; void value; } catch { (VALUES as unknown as string[]).pop(); }',
    'const source = { [Symbol.iterator]: function* () { throw new Error("iterate"); } }; try { const [...values] = source; void values; } catch { (VALUES as unknown as string[]).pop(); }',
    "const holder = { set value(_value: number) { (VALUES as unknown as string[]).pop(); } }; holder.value = 1;",
    'const holder = {}; Object.defineProperty(holder, "value", { set(_value: number) { (VALUES as unknown as string[]).pop(); } }); (holder as { value: number }).value = 1;',
    "const target = {} as { value?: number }; const holder = new Proxy(target, { set() { (VALUES as unknown as string[]).pop(); return true; } }); holder.value = 1;",
    "const iterable = { [Symbol.iterator]() { (VALUES as unknown as string[]).pop(); return [][Symbol.iterator](); } }; void [...iterable];",
    "const iterable = { [Symbol.iterator]() { (VALUES as unknown as string[]).pop(); return [][Symbol.iterator](); } }; const [first] = iterable; void first;",
    "const iterable = { [Symbol.iterator]() { (VALUES as unknown as string[]).pop(); return [][Symbol.iterator](); } }; function* values() { yield* iterable; } values().next();",
    "const iterable = { [Symbol.iterator]() { (VALUES as unknown as string[]).pop(); return [][Symbol.iterator](); } }; Array.from(iterable);",
    "const value = { [Symbol.toPrimitive]() { (VALUES as unknown as string[]).pop(); return 0; } }; void ((value as any) + 1);",
    "const matcher = { [Symbol.hasInstance]() { (VALUES as unknown as string[]).pop(); return false; } }; void ({} instanceof (matcher as any));",
    'const proxy = new Proxy({}, { has() { (VALUES as unknown as string[]).pop(); return false; } }); void ("value" in proxy);',
    'const proxy = new Proxy({}, { deleteProperty() { (VALUES as unknown as string[]).pop(); return true; } }); Reflect.deleteProperty(proxy, "value");',
    "const proxy = new Proxy({}, { ownKeys() { (VALUES as unknown as string[]).pop(); return []; } }); Object.keys(proxy);",
    "const value = { toJSON() { (VALUES as unknown as string[]).pop(); return null; } }; JSON.stringify(value);",
    'const value = { get status() { (VALUES as unknown as string[]).pop(); return "draft"; } }; void { ...value };',
    'const key = { [Symbol.toPrimitive]() { (VALUES as unknown as string[]).pop(); return "status"; } }; void ({} as any)[key as any];',
    'const key = { [Symbol.toPrimitive]() { (VALUES as unknown as string[]).pop(); return "status"; } }; void ({ [key as any]: 1 });',
    'const key = { [Symbol.toPrimitive]() { (VALUES as unknown as string[]).pop(); return "status"; } }; void class { [key as any] = 1 };',
    'const key = { [Symbol.toPrimitive]() { (VALUES as unknown as string[]).pop(); return "status"; } }; void `${key}`;',
    'const key = { [Symbol.toPrimitive]() { (VALUES as unknown as string[]).pop(); return "status"; } }; void +(key as any);',
    'const key = { [Symbol.toPrimitive]() { (VALUES as unknown as string[]).pop(); return "status"; } }; void -(key as any);',
    'const key = { [Symbol.toPrimitive]() { (VALUES as unknown as string[]).pop(); return "status"; } }; void ~(key as any);',
    'const key = { [Symbol.toPrimitive]() { (VALUES as unknown as string[]).pop(); return "status"; } }; void ((key as any) == 1);',
    'const key = { [Symbol.toPrimitive]() { (VALUES as unknown as string[]).pop(); return "status"; } }; Reflect.get({}, key as any);',
    'const key = { [Symbol.toPrimitive]() { (VALUES as unknown as string[]).pop(); return "status"; } }; Object.defineProperty({}, key as any, { value: 1 });',
  ])("an executed implicit context cannot mutate an owner: $0", (mutation) => {
    const analyzed = analyzeMutation(mutation);
    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: 1,
      conceptId: "order.status",
    });
  });

  test.each([
    "if (false) (VALUES as unknown as string[]).pop();",
    "false && (VALUES as unknown as string[]).pop();",
    "if (true) consume(); else (VALUES as unknown as string[]).pop();",
    "while (false) (VALUES as unknown as string[]).pop();",
    "for (; false;) (VALUES as unknown as string[]).pop();",
    'switch ("a") { case "b": (VALUES as unknown as string[]).pop(); }',
    "function remove() { (VALUES as unknown as string[]).pop(); } if (false) remove();",
    "const unused = () => (VALUES as unknown as string[]).pop(); consume(unused);",
    "class Mutator { value = (VALUES as unknown as string[]).pop(); }",
    "const Mutator = class { value = (VALUES as unknown as string[]).pop(); }; consume(Mutator);",
    "function run(value = (VALUES as unknown as string[]).pop()) {} run(1);",
    "function run() { return; (VALUES as unknown as string[]).pop(); } run();",
    "function run() { throw new Error(); (VALUES as unknown as string[]).pop(); } try { run(); } catch {}",
    "try { const value = 1; void value; } catch { (VALUES as unknown as string[]).pop(); }",
    "try { const { value } = { value: 1 }; void value; } catch { (VALUES as unknown as string[]).pop(); }",
    "try { const [value] = [1]; void value; } catch { (VALUES as unknown as string[]).pop(); }",
    "for (; false; (VALUES as unknown as string[]).pop()) {}",
    "for (const value of []) { (VALUES as unknown as string[]).pop(); }",
    'switch ("a") { case "a": break; case "b": (VALUES as unknown as string[]).pop(); }',
    "for (;;) { break; (VALUES as unknown as string[]).pop(); }",
    "[].forEach(() => { (VALUES as unknown as string[]).pop(); });",
    "Array.from([], () => (VALUES as unknown as string[]).pop());",
    "new Set().forEach(() => (VALUES as unknown as string[]).pop());",
    "new Map().forEach(() => (VALUES as unknown as string[]).pop());",
    "new Uint8Array().forEach(() => (VALUES as unknown as string[]).pop());",
    "new URLSearchParams().forEach(() => (VALUES as unknown as string[]).pop());",
    "[, ,].map(() => (VALUES as unknown as string[]).pop());",
    "new Array(0).map(() => (VALUES as unknown as string[]).pop());",
    "Array.of(() => { (VALUES as unknown as string[]).pop(); });",
    "Promise.resolve(() => { (VALUES as unknown as string[]).pop(); });",
    "Promise.resolve().catch(() => { (VALUES as unknown as string[]).pop(); });",
    "function queueMicrotask(_callback: () => void) {} queueMicrotask(() => (VALUES as unknown as string[]).pop());",
    "const schedule = queueMicrotask; const callback = () => (VALUES as unknown as string[]).pop(); void schedule; void callback;",
    "const schedule = queueMicrotask.bind(undefined, () => (VALUES as unknown as string[]).pop()); void schedule;",
    "const schedule: typeof queueMicrotask = (_callback) => {}; schedule(() => (VALUES as unknown as string[]).pop());",
    'Object.groupBy([], () => { (VALUES as unknown as string[]).pop(); return "status"; });',
    '"status".replace("missing", () => { (VALUES as unknown as string[]).pop(); return ""; });',
    'const value = { replace(_search: string, _callback: () => string) { return "status"; } }; value.replace("status", () => { (VALUES as unknown as string[]).pop(); return ""; });',
    "const holder = { set value(_value: number) { (VALUES as unknown as string[]).pop(); } }; consume(holder);",
    "const iterable = { [Symbol.iterator]() { (VALUES as unknown as string[]).pop(); return [][Symbol.iterator](); } }; consume(iterable);",
    "const value = { toJSON() { (VALUES as unknown as string[]).pop(); return null; } }; consume(value);",
    "const proxy = new Proxy({}, { ownKeys() { (VALUES as unknown as string[]).pop(); return []; } }); consume(proxy);",
    'const value = { get status() { (VALUES as unknown as string[]).pop(); return "draft"; } }; consume(value);',
    'const key = { [Symbol.toPrimitive]() { (VALUES as unknown as string[]).pop(); return "status"; } }; consume(key);',
    'const key = { [Symbol.toPrimitive]() { (VALUES as unknown as string[]).pop(); return "status"; } }; void ((key as any) === 1);',
    'const key = { [Symbol.toPrimitive]() { (VALUES as unknown as string[]).pop(); return "status"; } }; void ((key as any) == {});',
    'const key = { [Symbol.toPrimitive]() { (VALUES as unknown as string[]).pop(); return "status"; } }; void ((key as any) == null);',
  ])("a statically unexecuted mutation leaves the owner registered", (mutation) => {
    const analyzed = analyzeMutation(mutation);
    expect(analyzed.problems).toStrictEqual([]);
    expect(analyzed.catalog.entries).toHaveLength(1);
  });

  test("a directly executed mutation rejects the owner", () => {
    const analyzed = analyzeMutation("(VALUES as unknown as string[]).pop();");
    expect(analyzed.catalog.entries).toStrictEqual([]);
    expect(analyzed.problems).toContainEqual({
      kind: "vocabulary-without-values",
      filePath: "src/values.ts",
      line: 1,
      conceptId: "order.status",
    });
  });
});
