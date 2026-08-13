import { describe, expect, test } from "vite-plus/test";

import {
  mutatingBuiltinMemberOf,
  MUTATING_BUILTIN_METHOD_NAMES,
  MUTATING_BUILTIN_TYPE_NAMES,
} from "./mutating-members.ts";

describe("mutatingBuiltinMemberOf", () => {
  describe("writing to a map", () => {
    const it = test.extend("mapWrite", () =>
      mutatingBuiltinMemberOf({ type: "Map", method: "set" }));

    it("is a member that derives a new value", ({ mapWrite }) => {
      expect(mapWrite).toStrictEqual({
        type: "Map",
        method: "set",
        derivation:
          "Build the map you need in one expression: spread the entries of the old one into a new `Map`, or filter those entries before building it.",
        sink: false,
      });
    });
  });

  describe("writing to a set", () => {
    const it = test.extend("setWrite", () =>
      mutatingBuiltinMemberOf({ type: "Set", method: "add" }));

    it("is a member that derives a new value", ({ setWrite }) => {
      expect(setWrite).toStrictEqual({
        type: "Set",
        method: "add",
        derivation:
          "Build the set you need in one expression: spread the members of the old one into a new `Set`, or filter them before building it.",
        sink: false,
      });
    });
  });

  describe("moving a date forward", () => {
    const it = test.extend("dateWrite", () =>
      mutatingBuiltinMemberOf({ type: "Date", method: "setUTCHours" }));

    it("is a member that derives a new value", ({ dateWrite }) => {
      expect(dateWrite).toStrictEqual({
        type: "Date",
        method: "setUTCHours",
        derivation:
          "Build the moment you need as a new `Date` rather than moving an existing one forward.",
        sink: false,
      });
    });
  });

  describe("reordering a query string", () => {
    const it = test.extend("queryWrite", () =>
      mutatingBuiltinMemberOf({ type: "URLSearchParams", method: "sort" }));

    it("is a member that derives a new value", ({ queryWrite }) => {
      expect(queryWrite).toStrictEqual({
        type: "URLSearchParams",
        method: "sort",
        derivation:
          "Build the whole thing at once from the entries it carries, rather than creating it empty and adding to it.",
        sink: false,
      });
    });
  });

  describe("writing through a data view", () => {
    const it = test.extend("viewWrite", () =>
      mutatingBuiltinMemberOf({ type: "DataView", method: "setBigInt64" }));

    it("is a member that derives a new value", ({ viewWrite }) => {
      expect(viewWrite).toStrictEqual({
        type: "DataView",
        method: "setBigInt64",
        derivation:
          "Build the bytes as a new buffer and read them through a fresh view, rather than writing through this one.",
        sink: false,
      });
    });
  });

  describe("writing to a stream writer", () => {
    const it = test.extend("streamWrite", () =>
      mutatingBuiltinMemberOf({ type: "WritableStreamDefaultWriter", method: "write" }));

    it("is a member that leaves the program", ({ streamWrite }) => {
      expect(streamWrite).toStrictEqual({
        type: "WritableStreamDefaultWriter",
        method: "write",
        derivation:
          "A write to a sink leaves the program, so there is no new value to derive here.",
        sink: true,
      });
    });
  });

  describe("enqueueing on a transform controller", () => {
    const it = test.extend("transformWrite", () =>
      mutatingBuiltinMemberOf({ type: "TransformStreamDefaultController", method: "enqueue" }));

    it("is a member that leaves the program", ({ transformWrite }) => {
      expect(transformWrite).toStrictEqual({
        type: "TransformStreamDefaultController",
        method: "enqueue",
        derivation:
          "A write to a sink leaves the program, so there is no new value to derive here.",
        sink: true,
      });
    });
  });

  describe("reading a map", () => {
    const it = test.extend("mapRead", () =>
      mutatingBuiltinMemberOf({ type: "Map", method: "get" }));

    it("is no member of the enumeration", ({ mapRead }) => {
      expect(mapRead).toBe(null);
    });
  });

  describe("reading a set", () => {
    const it = test.extend("setRead", () =>
      mutatingBuiltinMemberOf({ type: "Set", method: "has" }));

    it("is no member of the enumeration", ({ setRead }) => {
      expect(setRead).toBe(null);
    });
  });

  describe("reading a date", () => {
    const it = test.extend("dateRead", () =>
      mutatingBuiltinMemberOf({ type: "Date", method: "getTime" }));

    it("is no member of the enumeration", ({ dateRead }) => {
      expect(dateRead).toBe(null);
    });
  });

  describe("a writing method name paired with a type outside the enumeration", () => {
    const it = test.extend("foreignTypeWrite", () =>
      mutatingBuiltinMemberOf({ type: "Router", method: "set" }));

    it("is no member", ({ foreignTypeWrite }) => {
      expect(foreignTypeWrite).toBe(null);
    });
  });

  describe("a map paired with a method another type carries", () => {
    const it = test.extend("mapWithSetMethod", () =>
      mutatingBuiltinMemberOf({ type: "Map", method: "add" }));

    it("is no member", ({ mapWithSetMethod }) => {
      expect(mapWithSetMethod).toBe(null);
    });
  });

  describe("a set paired with a method another type carries", () => {
    const it = test.extend("setWithMapMethod", () =>
      mutatingBuiltinMemberOf({ type: "Set", method: "set" }));

    it("is no member", ({ setWithMapMethod }) => {
      expect(setWithMapMethod).toBe(null);
    });
  });
});

describe("MUTATING_BUILTIN_TYPE_NAMES", () => {
  describe("a type the enumeration carries", () => {
    const it = test.extend("weakMapListed", () => MUTATING_BUILTIN_TYPE_NAMES.has("WeakMap"));

    it("stands among the type names", ({ weakMapListed }) => {
      expect(weakMapListed).toBe(true);
    });
  });

  describe("a type the enumeration leaves out", () => {
    const it = test.extend("arrayListed", () => MUTATING_BUILTIN_TYPE_NAMES.has("Array"));

    it("is absent from the type names", ({ arrayListed }) => {
      expect(arrayListed).toBe(false);
    });
  });
});

describe("MUTATING_BUILTIN_METHOD_NAMES", () => {
  describe("a method the enumeration carries", () => {
    const it = test.extend("appendListed", () => MUTATING_BUILTIN_METHOD_NAMES.has("append"));

    it("stands among the method names", ({ appendListed }) => {
      expect(appendListed).toBe(true);
    });
  });

  describe("a method the enumeration leaves out", () => {
    const it = test.extend("pushListed", () => MUTATING_BUILTIN_METHOD_NAMES.has("push"));

    it("is absent from the method names", ({ pushListed }) => {
      expect(pushListed).toBe(false);
    });
  });
});
