import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import { bodyCarriesNoWork } from "./catch-clause-bodies.ts";

import type { ESTree } from "@oxlint/plugins";

const it = test
  .extend("readingOfABodyWithNothingBetweenTheBraces", () =>
    bodyCarriesNoWork(
      (
        parseSync("spec.ts", "try { run(); } catch (failure) {}").program
          .body[0] as ESTree.TryStatement
      ).handler as ESTree.CatchClause,
    ))
  .extend("readingOfABodyHoldingOnlyASemicolon", () =>
    bodyCarriesNoWork(
      (
        parseSync("spec.ts", "try { run(); } catch (failure) { ; }").program
          .body[0] as ESTree.TryStatement
      ).handler as ESTree.CatchClause,
    ),
  )
  .extend("readingOfABodyHoldingOnlyAnEmptyBlock", () =>
    bodyCarriesNoWork(
      (
        parseSync("spec.ts", "try { run(); } catch (failure) { {} }").program
          .body[0] as ESTree.TryStatement
      ).handler as ESTree.CatchClause,
    ),
  )
  .extend("readingOfABodyHoldingABlockOfSemicolons", () =>
    bodyCarriesNoWork(
      (
        parseSync("spec.ts", "try { run(); } catch (failure) { { ; ; } }").program
          .body[0] as ESTree.TryStatement
      ).handler as ESTree.CatchClause,
    ),
  )
  .extend("readingOfABodyHoldingAStatement", () =>
    bodyCarriesNoWork(
      (
        parseSync("spec.ts", "try { run(); } catch (failure) { report(failure); }").program
          .body[0] as ESTree.TryStatement
      ).handler as ESTree.CatchClause,
    ),
  )
  .extend("readingOfABodyHoldingABlockAroundAStatement", () =>
    bodyCarriesNoWork(
      (
        parseSync("spec.ts", "try { run(); } catch (failure) { { report(failure); } }").program
          .body[0] as ESTree.TryStatement
      ).handler as ESTree.CatchClause,
    ),
  );

describe("catch-clause-bodies", () => {
  it("a body with nothing between the braces carries no work", ({
    readingOfABodyWithNothingBetweenTheBraces,
  }) => {
    expect(readingOfABodyWithNothingBetweenTheBraces).toBe(true);
  });

  it("a body holding only a semicolon carries no work", ({
    readingOfABodyHoldingOnlyASemicolon,
  }) => {
    expect(readingOfABodyHoldingOnlyASemicolon).toBe(true);
  });

  it("a body holding only an empty block carries no work", ({
    readingOfABodyHoldingOnlyAnEmptyBlock,
  }) => {
    expect(readingOfABodyHoldingOnlyAnEmptyBlock).toBe(true);
  });

  it("a body holding a block of semicolons carries no work", ({
    readingOfABodyHoldingABlockOfSemicolons,
  }) => {
    expect(readingOfABodyHoldingABlockOfSemicolons).toBe(true);
  });

  it("a body holding a statement carries work", ({ readingOfABodyHoldingAStatement }) => {
    expect(readingOfABodyHoldingAStatement).toBe(false);
  });

  it("a body holding a block around a statement carries work", ({
    readingOfABodyHoldingABlockAroundAStatement,
  }) => {
    expect(readingOfABodyHoldingABlockAroundAStatement).toBe(false);
  });
});
