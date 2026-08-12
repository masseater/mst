import { describe, expect, test } from "vite-plus/test";

import { createCycleMemo, type CycleMemoKey } from "./cycle-memo.ts";
import { normalizePropertyPath } from "./property-path.ts";

type Identity = { readonly name: string };

type Key = CycleMemoKey<Identity, "binding" | "schema", string>;

const enterableKey = (identity: Identity, overrides: Partial<Key> = {}): Key => ({
  cutoff: 100,
  domain: "binding",
  executionContext: "root",
  identity,
  path: normalizePropertyPath(["values", 0]),
  ...overrides,
});

describe("cycle-memo", () => {
  test("re-entering an active key reports a cycle", () => {
    const memo = createCycleMemo<string, Identity, Key["domain"]>();
    const key = enterableKey({ name: "values" });

    expect(memo.enter(key).kind).toBe("entered");
    expect(memo.enter(key)).toStrictEqual({ kind: "cycle" });
  });

  test("a completed key returns its cached result", () => {
    const memo = createCycleMemo<string, Identity, Key["domain"]>();
    const key = enterableKey({ name: "values" });
    const entry = memo.enter(key);
    expect(entry.kind).toBe("entered");
    if (entry.kind !== "entered") throw new Error("the first entry must be enterable");

    entry.complete("resolved");

    expect(memo.enter(key)).toStrictEqual({ kind: "cached", value: "resolved" });
  });

  test("abandoning an active key makes it enterable again", () => {
    const memo = createCycleMemo<string, Identity, Key["domain"]>();
    const key = enterableKey({ name: "values" });
    const entry = memo.enter(key);
    expect(entry.kind).toBe("entered");
    if (entry.kind !== "entered") throw new Error("the first entry must be enterable");

    entry.abandon();

    expect(memo.enter(key).kind).toBe("entered");
  });

  test("object identity distinguishes otherwise equal variables", () => {
    const memo = createCycleMemo<string, Identity, Key["domain"]>();
    const firstIdentity = { name: "values" };
    const secondIdentity = { name: "values" };

    expect(memo.enter(enterableKey(firstIdentity)).kind).toBe("entered");
    expect(memo.enter(enterableKey(secondIdentity)).kind).toBe("entered");
  });

  test("domains have independent cycle states", () => {
    const memo = createCycleMemo<string, Identity, Key["domain"]>();
    const identity = { name: "values" };

    expect(memo.enter(enterableKey(identity)).kind).toBe("entered");
    expect(memo.enter(enterableKey(identity, { domain: "schema" })).kind).toBe("entered");
  });

  test("paths have independent cycle states", () => {
    const memo = createCycleMemo<string, Identity, Key["domain"]>();
    const identity = { name: "values" };

    expect(memo.enter(enterableKey(identity)).kind).toBe("entered");
    expect(
      memo.enter(enterableKey(identity, { path: normalizePropertyPath(["values", 1]) })).kind,
    ).toBe("entered");
  });

  test("numeric and string path keys share one cycle state", () => {
    const memo = createCycleMemo<string, Identity, Key["domain"]>();
    const identity = { name: "values" };

    expect(
      memo.enter(enterableKey(identity, { path: normalizePropertyPath(["values", 0]) })).kind,
    ).toBe("entered");
    expect(
      memo.enter(enterableKey(identity, { path: normalizePropertyPath(["values", "0"]) })),
    ).toStrictEqual({ kind: "cycle" });
  });

  test("cutoffs have independent cycle states", () => {
    const memo = createCycleMemo<string, Identity, Key["domain"]>();
    const identity = { name: "values" };

    expect(memo.enter(enterableKey(identity)).kind).toBe("entered");
    expect(memo.enter(enterableKey(identity, { cutoff: 101 })).kind).toBe("entered");
  });

  test("execution contexts have independent cycle states", () => {
    const memo = createCycleMemo<string, Identity, Key["domain"]>();
    const identity = { name: "values" };

    expect(memo.enter(enterableKey(identity)).kind).toBe("entered");
    expect(
      memo.enter(enterableKey(identity, { executionContext: "conditional-branch" })).kind,
    ).toBe("entered");
  });

  test("late completion cannot overwrite a replacement after abandonment", () => {
    const memo = createCycleMemo<string, Identity, Key["domain"]>();
    const key = enterableKey({ name: "values" });
    const abandoned = memo.enter(key);
    expect(abandoned.kind).toBe("entered");
    if (abandoned.kind !== "entered") throw new Error("the first entry must be enterable");
    abandoned.abandon();
    const replacement = memo.enter(key);
    expect(replacement.kind).toBe("entered");
    if (replacement.kind !== "entered") throw new Error("the replacement must be enterable");

    abandoned.complete("stale");
    replacement.complete("fresh");

    expect(memo.enter(key)).toStrictEqual({ kind: "cached", value: "fresh" });
  });
});
