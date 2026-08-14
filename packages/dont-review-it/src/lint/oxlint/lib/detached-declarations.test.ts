import { describe, expect, test } from "vite-plus/test";

import { detachedDeclarations } from "./detached-declarations.ts";

describe("detachedDeclarations", () => {
  describe("a declaration standing right in front of the statement that uses it", () => {
    const it = test.extend("found", () =>
      detachedDeclarations([
        { held: "limit", usedAt: [1], reportable: true, carriesEffect: false },
        { held: "truncate", usedAt: [], reportable: true, carriesEffect: false },
      ]));

    it("is left alone", ({ found }) => {
      expect(found).toStrictEqual([]);
    });
  });

  describe("a declaration separated from its use by a statement that use does not name", () => {
    const it = test.extend("found", () =>
      detachedDeclarations([
        { held: "limit", usedAt: [2], reportable: true, carriesEffect: false },
        { held: "read", usedAt: [], reportable: true, carriesEffect: false },
        { held: "truncate", usedAt: [], reportable: true, carriesEffect: false },
      ]));

    it("is reported with the statement it belongs in front of", ({ found }) => {
      expect(found).toStrictEqual([{ held: "limit", firstUse: "truncate" }]);
    });
  });

  describe("declarations the same statement uses standing together in front of it", () => {
    const it = test.extend("found", () =>
      detachedDeclarations([
        { held: "lowest", usedAt: [2], reportable: true, carriesEffect: false },
        { held: "highest", usedAt: [2], reportable: true, carriesEffect: false },
        { held: "clamp", usedAt: [], reportable: true, carriesEffect: false },
      ]));

    it("are left alone", ({ found }) => {
      expect(found).toStrictEqual([]);
    });
  });

  describe("a declaration separated from its use by one that reaches that use through another", () => {
    const it = test.extend("found", () =>
      detachedDeclarations([
        { held: "separator", usedAt: [3], reportable: true, carriesEffect: false },
        { held: "trimmed", usedAt: [2], reportable: true, carriesEffect: false },
        { held: "filled", usedAt: [3], reportable: true, carriesEffect: false },
        { held: "summary", usedAt: [], reportable: true, carriesEffect: false },
      ]));

    it("is left alone because the statement between it feeds the same use", ({ found }) => {
      expect(found).toStrictEqual([]);
    });
  });

  describe("a declaration separated from its use by a statement that writes state", () => {
    const it = test.extend("found", () =>
      detachedDeclarations([
        { held: "counted", usedAt: [2], reportable: true, carriesEffect: false },
        { held: "cleared", usedAt: [], reportable: true, carriesEffect: true },
        { held: "report", usedAt: [], reportable: true, carriesEffect: false },
      ]));

    it("is left alone because moving it past the write changes what it reads", ({ found }) => {
      expect(found).toStrictEqual([]);
    });
  });

  describe("a declaration standing after a statement that writes state and uses it", () => {
    const it = test.extend("found", () =>
      detachedDeclarations([
        { held: "walk", usedAt: [], reportable: true, carriesEffect: true },
        { held: "step", usedAt: [0], reportable: true, carriesEffect: false },
      ]));

    it("is left alone because it cannot move in front of the write", ({ found }) => {
      expect(found).toStrictEqual([]);
    });
  });

  describe("a declaration nothing in the list uses", () => {
    const it = test.extend("found", () =>
      detachedDeclarations([
        { held: "limit", usedAt: [], reportable: true, carriesEffect: false },
        { held: "read", usedAt: [], reportable: true, carriesEffect: false },
      ]));

    it("is left to the rules that count uses", ({ found }) => {
      expect(found).toStrictEqual([]);
    });
  });

  describe("a statement the caller marks as not reportable", () => {
    const it = test.extend("found", () =>
      detachedDeclarations([
        { held: "settings", usedAt: [2], reportable: false, carriesEffect: false },
        { held: "read", usedAt: [], reportable: true, carriesEffect: false },
        { held: "apply", usedAt: [], reportable: true, carriesEffect: false },
      ]));

    it("is left alone however far it stands", ({ found }) => {
      expect(found).toStrictEqual([]);
    });
  });

  describe("a declaration standing after the statement that uses it", () => {
    const it = test.extend("found", () =>
      detachedDeclarations([
        { held: "walk", usedAt: [], reportable: true, carriesEffect: false },
        { held: "read", usedAt: [], reportable: true, carriesEffect: false },
        { held: "step", usedAt: [0], reportable: true, carriesEffect: false },
      ]));

    it("is reported so it moves in front of that statement", ({ found }) => {
      expect(found).toStrictEqual([{ held: "step", firstUse: "walk" }]);
    });
  });

  describe("two declarations that name each other standing together", () => {
    const it = test.extend("found", () =>
      detachedDeclarations([
        { held: "asks", usedAt: [1], reportable: true, carriesEffect: false },
        { held: "answers", usedAt: [0], reportable: true, carriesEffect: false },
      ]));

    it("are left alone because neither can stand in front of the other", ({ found }) => {
      expect(found).toStrictEqual([]);
    });
  });

  describe("two declarations that name each other standing apart", () => {
    const it = test.extend("found", () =>
      detachedDeclarations([
        { held: "asks", usedAt: [2], reportable: true, carriesEffect: false },
        { held: "read", usedAt: [], reportable: true, carriesEffect: false },
        { held: "answers", usedAt: [0], reportable: true, carriesEffect: false },
      ]));

    it("are left alone because no order puts each in front of the other", ({ found }) => {
      expect(found).toStrictEqual([]);
    });
  });

  describe("three declarations that name each other around a ring", () => {
    const it = test.extend("found", () =>
      detachedDeclarations([
        { held: "asks", usedAt: [1], reportable: true, carriesEffect: false },
        { held: "answers", usedAt: [2], reportable: true, carriesEffect: false },
        { held: "repeats", usedAt: [0], reportable: true, carriesEffect: false },
      ]));

    it("are left alone because the ring has no first member", ({ found }) => {
      expect(found).toStrictEqual([]);
    });
  });

  describe("a declaration standing in front of a ring it is not part of", () => {
    const it = test.extend("found", () =>
      detachedDeclarations([
        { held: "limit", usedAt: [3], reportable: true, carriesEffect: false },
        { held: "asks", usedAt: [2], reportable: true, carriesEffect: false },
        { held: "answers", usedAt: [1], reportable: true, carriesEffect: false },
        { held: "truncate", usedAt: [], reportable: true, carriesEffect: false },
      ]));

    it("is still reported", ({ found }) => {
      expect(found).toStrictEqual([{ held: "limit", firstUse: "truncate" }]);
    });
  });
});
