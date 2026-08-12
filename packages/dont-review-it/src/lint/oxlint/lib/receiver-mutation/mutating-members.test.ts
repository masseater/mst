import { describe, expect, test } from "vite-plus/test";

import {
  mutatingBuiltinMemberOf,
  MUTATING_BUILTIN_METHOD_NAMES,
  MUTATING_BUILTIN_TYPE_NAMES,
} from "./mutating-members.ts";

const it = test
  .extend("mapWrite", () => mutatingBuiltinMemberOf({ type: "Map", method: "set" }))
  .extend("setWrite", () => mutatingBuiltinMemberOf({ type: "Set", method: "add" }))
  .extend("dateWrite", () => mutatingBuiltinMemberOf({ type: "Date", method: "setUTCHours" }))
  .extend("queryWrite", () => mutatingBuiltinMemberOf({ type: "URLSearchParams", method: "sort" }))
  .extend("viewWrite", () => mutatingBuiltinMemberOf({ type: "DataView", method: "setBigInt64" }))
  .extend("streamWrite", () =>
    mutatingBuiltinMemberOf({ type: "WritableStreamDefaultWriter", method: "write" }),
  )
  .extend("transformWrite", () =>
    mutatingBuiltinMemberOf({ type: "TransformStreamDefaultController", method: "enqueue" }),
  )
  .extend("mapRead", () => mutatingBuiltinMemberOf({ type: "Map", method: "get" }))
  .extend("setRead", () => mutatingBuiltinMemberOf({ type: "Set", method: "has" }))
  .extend("dateRead", () => mutatingBuiltinMemberOf({ type: "Date", method: "getTime" }))
  .extend("foreignTypeWrite", () => mutatingBuiltinMemberOf({ type: "Router", method: "set" }))
  .extend("mapWithSetMethod", () => mutatingBuiltinMemberOf({ type: "Map", method: "add" }))
  .extend("setWithMapMethod", () => mutatingBuiltinMemberOf({ type: "Set", method: "set" }))
  .extend("weakMapListed", () => MUTATING_BUILTIN_TYPE_NAMES.has("WeakMap"))
  .extend("arrayListed", () => MUTATING_BUILTIN_TYPE_NAMES.has("Array"))
  .extend("appendListed", () => MUTATING_BUILTIN_METHOD_NAMES.has("append"))
  .extend("pushListed", () => MUTATING_BUILTIN_METHOD_NAMES.has("push"));

describe("mutating-members", () => {
  it("writing to a map is a member that derives a new value", ({ mapWrite }) => {
    expect(mapWrite).toStrictEqual({
      type: "Map",
      method: "set",
      derivation:
        "Build the map you need in one expression: spread the entries of the old one into a new `Map`, or filter those entries before building it.",
      sink: false,
    });
  });

  it("writing to a set is a member that derives a new value", ({ setWrite }) => {
    expect(setWrite).toStrictEqual({
      type: "Set",
      method: "add",
      derivation:
        "Build the set you need in one expression: spread the members of the old one into a new `Set`, or filter them before building it.",
      sink: false,
    });
  });

  it("moving a date forward is a member that derives a new value", ({ dateWrite }) => {
    expect(dateWrite).toStrictEqual({
      type: "Date",
      method: "setUTCHours",
      derivation:
        "Build the moment you need as a new `Date` rather than moving an existing one forward.",
      sink: false,
    });
  });

  it("reordering a query string is a member that derives a new value", ({ queryWrite }) => {
    expect(queryWrite).toStrictEqual({
      type: "URLSearchParams",
      method: "sort",
      derivation:
        "Build the whole thing at once from the entries it carries, rather than creating it empty and adding to it.",
      sink: false,
    });
  });

  it("writing through a data view is a member that derives a new value", ({ viewWrite }) => {
    expect(viewWrite).toStrictEqual({
      type: "DataView",
      method: "setBigInt64",
      derivation:
        "Build the bytes as a new buffer and read them through a fresh view, rather than writing through this one.",
      sink: false,
    });
  });

  it("writing to a stream writer is a member that leaves the program", ({ streamWrite }) => {
    expect(streamWrite).toStrictEqual({
      type: "WritableStreamDefaultWriter",
      method: "write",
      derivation: "A write to a sink leaves the program, so there is no new value to derive here.",
      sink: true,
    });
  });

  it("enqueueing on a transform controller is a member that leaves the program", ({
    transformWrite,
  }) => {
    expect(transformWrite).toStrictEqual({
      type: "TransformStreamDefaultController",
      method: "enqueue",
      derivation: "A write to a sink leaves the program, so there is no new value to derive here.",
      sink: true,
    });
  });

  it("reading a map is no member of the enumeration", ({ mapRead }) => {
    expect(mapRead).toBe(null);
  });

  it("reading a set is no member of the enumeration", ({ setRead }) => {
    expect(setRead).toBe(null);
  });

  it("reading a date is no member of the enumeration", ({ dateRead }) => {
    expect(dateRead).toBe(null);
  });

  it("a writing method name paired with a type outside the enumeration is no member", ({
    foreignTypeWrite,
  }) => {
    expect(foreignTypeWrite).toBe(null);
  });

  it("a map paired with a method another type carries is no member", ({ mapWithSetMethod }) => {
    expect(mapWithSetMethod).toBe(null);
  });

  it("a set paired with a method another type carries is no member", ({ setWithMapMethod }) => {
    expect(setWithMapMethod).toBe(null);
  });

  it("a type the enumeration carries stands among the type names", ({ weakMapListed }) => {
    expect(weakMapListed).toBe(true);
  });

  it("a type the enumeration leaves out is absent from the type names", ({ arrayListed }) => {
    expect(arrayListed).toBe(false);
  });

  it("a method the enumeration carries stands among the method names", ({ appendListed }) => {
    expect(appendListed).toBe(true);
  });

  it("a method the enumeration leaves out is absent from the method names", ({ pushListed }) => {
    expect(pushListed).toBe(false);
  });
});
