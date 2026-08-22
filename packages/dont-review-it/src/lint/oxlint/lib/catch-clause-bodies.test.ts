import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { bodyCarriesNoWork } from "./catch-clause-bodies.ts";

import type { ESTree } from "@oxlint/plugins";

describe("bodyCarriesNoWork", () => {
  describe("a body with nothing between the braces", () => {
    const it = test.extend("carriesNoWork", () =>
      bodyCarriesNoWork(
        (
          parseSync("spec.ts", "try { run(); } catch (failure) {}").program
            .body[0] as ESTree.TryStatement
        ).handler as ESTree.CatchClause,
      ));

    it("carries no work", ({ carriesNoWork }) => {
      expect(carriesNoWork).toBe(true);
    });
  });

  describe("a body holding only a semicolon", () => {
    const it = test.extend("carriesNoWork", () =>
      bodyCarriesNoWork(
        (
          parseSync("spec.ts", "try { run(); } catch (failure) { ; }").program
            .body[0] as ESTree.TryStatement
        ).handler as ESTree.CatchClause,
      ));

    it("carries no work", ({ carriesNoWork }) => {
      expect(carriesNoWork).toBe(true);
    });
  });

  describe("a body holding only an empty block", () => {
    const it = test.extend("carriesNoWork", () =>
      bodyCarriesNoWork(
        (
          parseSync("spec.ts", "try { run(); } catch (failure) { {} }").program
            .body[0] as ESTree.TryStatement
        ).handler as ESTree.CatchClause,
      ));

    it("carries no work", ({ carriesNoWork }) => {
      expect(carriesNoWork).toBe(true);
    });
  });

  describe("a body holding a block of semicolons", () => {
    const it = test.extend("carriesNoWork", () =>
      bodyCarriesNoWork(
        (
          parseSync("spec.ts", "try { run(); } catch (failure) { { ; ; } }").program
            .body[0] as ESTree.TryStatement
        ).handler as ESTree.CatchClause,
      ));

    it("carries no work", ({ carriesNoWork }) => {
      expect(carriesNoWork).toBe(true);
    });
  });

  describe("a body holding a statement", () => {
    const it = test.extend("carriesNoWork", () =>
      bodyCarriesNoWork(
        (
          parseSync("spec.ts", "try { run(); } catch (failure) { report(failure); }").program
            .body[0] as ESTree.TryStatement
        ).handler as ESTree.CatchClause,
      ));

    it("carries work", ({ carriesNoWork }) => {
      expect(carriesNoWork).toBe(false);
    });
  });

  describe("a body holding a block around a statement", () => {
    const it = test.extend("carriesNoWork", () =>
      bodyCarriesNoWork(
        (
          parseSync("spec.ts", "try { run(); } catch (failure) { { report(failure); } }").program
            .body[0] as ESTree.TryStatement
        ).handler as ESTree.CatchClause,
      ));

    it("carries work", ({ carriesNoWork }) => {
      expect(carriesNoWork).toBe(false);
    });
  });
});
