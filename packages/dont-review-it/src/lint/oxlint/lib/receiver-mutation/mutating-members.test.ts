import { describe, expect, test } from "vite-plus/test";

import {
  mutatingBuiltinMemberOf,
  MUTATING_BUILTIN_METHOD_NAMES,
  MUTATING_BUILTIN_TYPE_NAMES,
} from "./mutating-members.ts";

describe("mutating-members", () => {
  test("a pair of a collection type and a writing method is a member that derives a new value", () => {
    expect(mutatingBuiltinMemberOf({ type: "Map", method: "set" })?.sink).toBe(false);
    expect(mutatingBuiltinMemberOf({ type: "Set", method: "add" })?.derivation).toContain(
      "new `Set`",
    );
    expect(mutatingBuiltinMemberOf({ type: "Date", method: "setUTCHours" })?.type).toBe("Date");
    expect(mutatingBuiltinMemberOf({ type: "URLSearchParams", method: "sort" })?.method).toBe(
      "sort",
    );
    expect(mutatingBuiltinMemberOf({ type: "DataView", method: "setBigInt64" })?.type).toBe(
      "DataView",
    );
  });

  test("a pair of a sink type and a writing method is a member that leaves the program", () => {
    expect(
      mutatingBuiltinMemberOf({ type: "WritableStreamDefaultWriter", method: "write" })?.sink,
    ).toBe(true);
    expect(
      mutatingBuiltinMemberOf({ type: "TransformStreamDefaultController", method: "enqueue" })
        ?.sink,
    ).toBe(true);
  });

  test("a method that reads the receiver is no member of the enumeration", () => {
    expect(mutatingBuiltinMemberOf({ type: "Map", method: "get" })).toBe(null);
    expect(mutatingBuiltinMemberOf({ type: "Set", method: "has" })).toBe(null);
    expect(mutatingBuiltinMemberOf({ type: "Date", method: "getTime" })).toBe(null);
  });

  test("a writing method name paired with another type is no member of the enumeration", () => {
    expect(mutatingBuiltinMemberOf({ type: "Router", method: "set" })).toBe(null);
    expect(mutatingBuiltinMemberOf({ type: "Map", method: "add" })).toBe(null);
    expect(mutatingBuiltinMemberOf({ type: "Set", method: "set" })).toBe(null);
  });

  test("the type names and the method names are the two sides of the same enumeration", () => {
    expect(MUTATING_BUILTIN_TYPE_NAMES.has("WeakMap")).toBe(true);
    expect(MUTATING_BUILTIN_TYPE_NAMES.has("Array")).toBe(false);
    expect(MUTATING_BUILTIN_METHOD_NAMES.has("append")).toBe(true);
    expect(MUTATING_BUILTIN_METHOD_NAMES.has("push")).toBe(false);
  });
});
