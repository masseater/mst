import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { astFieldsOf, statementsOf } from "./setup-modules/coupling-edges.ts";
import {
  namesStaticallyResolvedForm,
  STATICALLY_RESOLVED_FORMS,
} from "./statically-resolved-forms.ts";

describe("namesStaticallyResolvedForm", () => {
  describe("a location built from this module's own address", () => {
    const it = test.extend("verdict", () => {
      const program = astFieldsOf(
        parseSync("spec.ts", 'new URL("./worker.ts", import.meta.url).href;').program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [statement] = statementsOf(program).slice(-1);
      const written = statement === undefined ? null : astFieldsOf(statement.expression);
      if (written === null) throw new Error("nothing is written");
      return namesStaticallyResolvedForm({
        node: written,
        forms: new Set(STATICALLY_RESOLVED_FORMS),
        constants: new Map<string, string>(),
      });
    });

    it("names a registered form", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a resolution asked of this module's own address", () => {
    const it = test.extend("verdict", () => {
      const program = astFieldsOf(
        parseSync("spec.ts", 'import.meta.resolve("./worker.ts");').program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [statement] = statementsOf(program).slice(-1);
      const written = statement === undefined ? null : astFieldsOf(statement.expression);
      if (written === null) throw new Error("nothing is written");
      return namesStaticallyResolvedForm({
        node: written,
        forms: new Set(STATICALLY_RESOLVED_FORMS),
        constants: new Map<string, string>(),
      });
    });

    it("names a registered form", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a registered form handed nothing the source spells out", () => {
    const it = test.extend("verdict", () => {
      const program = astFieldsOf(
        parseSync("spec.ts", "new URL(chosen, import.meta.url).href;").program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [statement] = statementsOf(program).slice(-1);
      const written = statement === undefined ? null : astFieldsOf(statement.expression);
      if (written === null) throw new Error("nothing is written");
      return namesStaticallyResolvedForm({
        node: written,
        forms: new Set(STATICALLY_RESOLVED_FORMS),
        constants: new Map<string, string>(),
      });
    });

    it("names no resolved location", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a registered form handed a constant of this file", () => {
    const it = test.extend("verdict", () => {
      const program = astFieldsOf(
        parseSync("spec.ts", 'const ENTRY = "./worker.ts";\nnew URL(ENTRY, import.meta.url).href;')
          .program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [statement] = statementsOf(program).slice(-1);
      const written = statement === undefined ? null : astFieldsOf(statement.expression);
      if (written === null) throw new Error("nothing is written");
      return namesStaticallyResolvedForm({
        node: written,
        forms: new Set(STATICALLY_RESOLVED_FORMS),
        constants: new Map([["ENTRY", "./worker.ts"]]),
      });
    });

    it("names a resolved location", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a form nobody registered", () => {
    const it = test.extend("verdict", () => {
      const program = astFieldsOf(parseSync("spec.ts", 'resolveEntry("./worker.ts");').program);
      if (program === null) throw new Error("nothing was parsed");
      const [statement] = statementsOf(program).slice(-1);
      const written = statement === undefined ? null : astFieldsOf(statement.expression);
      if (written === null) throw new Error("nothing is written");
      return namesStaticallyResolvedForm({
        node: written,
        forms: new Set(STATICALLY_RESOLVED_FORMS),
        constants: new Map<string, string>(),
      });
    });

    it("names no resolved location", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a form registered under another name", () => {
    const it = test.extend("verdict", () => {
      const program = astFieldsOf(parseSync("spec.ts", 'resolveEntry("./worker.ts");').program);
      if (program === null) throw new Error("nothing was parsed");
      const [statement] = statementsOf(program).slice(-1);
      const written = statement === undefined ? null : astFieldsOf(statement.expression);
      if (written === null) throw new Error("nothing is written");
      return namesStaticallyResolvedForm({
        node: written,
        forms: new Set(["resolveEntry"]),
        constants: new Map<string, string>(),
      });
    });

    it("is read from the list it is given", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });

  describe("a property read off an object", () => {
    const it = test.extend("verdict", () => {
      const program = astFieldsOf(parseSync("spec.ts", "config.entry;").program);
      if (program === null) throw new Error("nothing was parsed");
      const [statement] = statementsOf(program).slice(-1);
      const written = statement === undefined ? null : astFieldsOf(statement.expression);
      if (written === null) throw new Error("nothing is written");
      return namesStaticallyResolvedForm({
        node: written,
        forms: new Set(STATICALLY_RESOLVED_FORMS),
        constants: new Map<string, string>(),
      });
    });

    it("names no form at all", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a name bound to a value", () => {
    const it = test.extend("verdict", () => {
      const program = astFieldsOf(parseSync("spec.ts", "chosen;").program);
      if (program === null) throw new Error("nothing was parsed");
      const [statement] = statementsOf(program).slice(-1);
      const written = statement === undefined ? null : astFieldsOf(statement.expression);
      if (written === null) throw new Error("nothing is written");
      return namesStaticallyResolvedForm({
        node: written,
        forms: new Set(STATICALLY_RESOLVED_FORMS),
        constants: new Map<string, string>(),
      });
    });

    it("names no form at all", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a call reached through a subscript", () => {
    const it = test.extend("verdict", () => {
      const program = astFieldsOf(parseSync("spec.ts", 'loaders[chosen]("./worker.ts");').program);
      if (program === null) throw new Error("nothing was parsed");
      const [statement] = statementsOf(program).slice(-1);
      const written = statement === undefined ? null : astFieldsOf(statement.expression);
      if (written === null) throw new Error("nothing is written");
      return namesStaticallyResolvedForm({
        node: written,
        forms: new Set(STATICALLY_RESOLVED_FORMS),
        constants: new Map<string, string>(),
      });
    });

    it("spells no head this list can hold", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a head carried by a subscript", () => {
    const it = test.extend("verdict", () => {
      const program = astFieldsOf(
        parseSync("spec.ts", 'loaders[chosen].load("./worker.ts");').program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [statement] = statementsOf(program).slice(-1);
      const written = statement === undefined ? null : astFieldsOf(statement.expression);
      if (written === null) throw new Error("nothing is written");
      return namesStaticallyResolvedForm({
        node: written,
        forms: new Set(STATICALLY_RESOLVED_FORMS),
        constants: new Map<string, string>(),
      });
    });

    it("spells no dotted name this list can hold", ({ verdict }) => {
      expect(verdict).toBe(false);
    });
  });

  describe("a form waited on", () => {
    const it = test.extend("verdict", () => {
      const program = astFieldsOf(
        parseSync("spec.ts", 'await import.meta.resolve("./worker.ts");').program,
      );
      if (program === null) throw new Error("nothing was parsed");
      const [statement] = statementsOf(program).slice(-1);
      const written = statement === undefined ? null : astFieldsOf(statement.expression);
      if (written === null) throw new Error("nothing is written");
      return namesStaticallyResolvedForm({
        node: written,
        forms: new Set(STATICALLY_RESOLVED_FORMS),
        constants: new Map<string, string>(),
      });
    });

    it("is read through the wait", ({ verdict }) => {
      expect(verdict).toBe(true);
    });
  });
});
