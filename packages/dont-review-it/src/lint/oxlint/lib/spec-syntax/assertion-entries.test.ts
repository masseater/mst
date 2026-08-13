import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vite-plus/test";

import {
  ASSERTION_ENTRY_NAME,
  assertionEntryCallOf,
  isAssertionCall,
  isAssertionChain,
  isAssertionEntryCall,
  isAssertionEntryReference,
} from "./assertion-entries.ts";

import type { ESTree } from "@oxlint/plugins";

describe("ASSERTION_ENTRY_NAME", () => {
  describe("the name the assertion entry is reached under", () => {
    const it = test.extend("entryName", () => ASSERTION_ENTRY_NAME);

    it("spells the entry the way the runner injects it", ({ entryName }) => {
      expect(entryName).toBe("expect");
    });
  });
});

describe("isAssertionEntryReference", () => {
  describe("the entry standing on its own", () => {
    const it = test.extend("entryReferenceReading", () => {
      const written = parseSync("spec.ts", "expect;").program.body[0] as ESTree.ExpressionStatement;
      return isAssertionEntryReference(written.expression);
    });

    it("is recognised as the entry", ({ entryReferenceReading }) => {
      expect(entryReferenceReading).toBe(true);
    });
  });

  describe("another name standing in the same position", () => {
    const it = test.extend("entryReferenceReading", () => {
      const written = parseSync("spec.ts", "assert;").program.body[0] as ESTree.ExpressionStatement;
      return isAssertionEntryReference(written.expression);
    });

    it("is left where it stands", ({ entryReferenceReading }) => {
      expect(entryReferenceReading).toBe(false);
    });
  });

  describe("a receiver that is not a name at all", () => {
    const it = test.extend("entryReferenceReading", () => {
      const written = parseSync("spec.ts", "makeExpect();").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionEntryReference(written.expression);
    });

    it("is left where it stands", ({ entryReferenceReading }) => {
      expect(entryReferenceReading).toBe(false);
    });
  });
});

describe("isAssertionEntryCall", () => {
  describe("a call on the entry", () => {
    const it = test.extend("entryCallReading", () => {
      const written = parseSync("spec.ts", "expect(subject);").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionEntryCall(written.expression as ESTree.CallExpression);
    });

    it("is read as the opening of an assertion", ({ entryCallReading }) => {
      expect(entryCallReading).toBe(true);
    });
  });

  describe("a call on another name", () => {
    const it = test.extend("entryCallReading", () => {
      const written = parseSync("spec.ts", "assert(subject);").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionEntryCall(written.expression as ESTree.CallExpression);
    });

    it("is left where it stands", ({ entryCallReading }) => {
      expect(entryCallReading).toBe(false);
    });
  });

  describe("the soft receiver", () => {
    const it = test.extend("entryCallReading", () => {
      const written = parseSync("spec.ts", "expect.soft(subject);").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionEntryCall(written.expression as ESTree.CallExpression);
    });

    it("is read as the same opening", ({ entryCallReading }) => {
      expect(entryCallReading).toBe(true);
    });
  });

  describe("the poll receiver", () => {
    const it = test.extend("entryCallReading", () => {
      const written = parseSync("spec.ts", "expect.poll(read);").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionEntryCall(written.expression as ESTree.CallExpression);
    });

    it("is read as the same opening", ({ entryCallReading }) => {
      expect(entryCallReading).toBe(true);
    });
  });

  describe("another member of the entry namespace", () => {
    const it = test.extend("entryCallReading", () => {
      const written = parseSync("spec.ts", "expect.extend(matchers);").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionEntryCall(written.expression as ESTree.CallExpression);
    });

    it("is left where it stands", ({ entryCallReading }) => {
      expect(entryCallReading).toBe(false);
    });
  });

  describe("a derived spelling carried by another receiver", () => {
    const it = test.extend("entryCallReading", () => {
      const written = parseSync("spec.ts", "runner.soft(subject);").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionEntryCall(written.expression as ESTree.CallExpression);
    });

    it("is left where it stands", ({ entryCallReading }) => {
      expect(entryCallReading).toBe(false);
    });
  });

  describe("a member of the entry chosen at run time", () => {
    const it = test.extend("entryCallReading", () => {
      const written = parseSync("spec.ts", "expect[chosen](subject);").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionEntryCall(written.expression as ESTree.CallExpression);
    });

    it("is left where it stands", ({ entryCallReading }) => {
      expect(entryCallReading).toBe(false);
    });
  });

  describe("an entry handed back by another call", () => {
    const it = test.extend("entryCallReading", () => {
      const written = parseSync("spec.ts", "makeExpect()(subject);").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionEntryCall(written.expression as ESTree.CallExpression);
    });

    it("is left where it stands", ({ entryCallReading }) => {
      expect(entryCallReading).toBe(false);
    });
  });
});

describe("isAssertionChain", () => {
  describe("a chain whose root is the entry call", () => {
    const it = test.extend("chainReading", () => {
      const written = parseSync("spec.ts", "expect(subject);").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionChain(written.expression);
    });

    it("is read as a chain", ({ chainReading }) => {
      expect(chainReading).toBe(true);
    });
  });

  describe("the negation modifier", () => {
    const it = test.extend("chainReading", () => {
      const written = parseSync("spec.ts", "expect(subject).not;").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionChain(written.expression);
    });

    it("is kept inside the chain", ({ chainReading }) => {
      expect(chainReading).toBe(true);
    });
  });

  describe("a run of settlement and negation modifiers", () => {
    const it = test.extend("chainReading", () => {
      const written = parseSync("spec.ts", "expect(pending).resolves.not;").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionChain(written.expression);
    });

    it("is kept inside the chain", ({ chainReading }) => {
      expect(chainReading).toBe(true);
    });
  });

  describe("the rejection modifier", () => {
    const it = test.extend("chainReading", () => {
      const written = parseSync("spec.ts", "expect(pending).rejects;").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionChain(written.expression);
    });

    it("is kept inside the chain", ({ chainReading }) => {
      expect(chainReading).toBe(true);
    });
  });

  describe("a non-null assertion written around the root", () => {
    const it = test.extend("chainReading", () => {
      const written = parseSync("spec.ts", "expect(subject)!;").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionChain(written.expression);
    });

    it("is seen through", ({ chainReading }) => {
      expect(chainReading).toBe(true);
    });
  });

  describe("a type assertion written around the root", () => {
    const it = test.extend("chainReading", () => {
      const written = parseSync("spec.ts", "expect(subject) as Assertion;").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionChain(written.expression);
    });

    it("is seen through", ({ chainReading }) => {
      expect(chainReading).toBe(true);
    });
  });

  describe("a member that is not a modifier", () => {
    const it = test.extend("chainReading", () => {
      const written = parseSync("spec.ts", "expect(subject).value;").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionChain(written.expression);
    });

    it("is left outside the chain", ({ chainReading }) => {
      expect(chainReading).toBe(false);
    });
  });

  describe("a link chosen at run time", () => {
    const it = test.extend("chainReading", () => {
      const written = parseSync("spec.ts", "expect(subject)[modifier];").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionChain(written.expression);
    });

    it("is left outside the chain", ({ chainReading }) => {
      expect(chainReading).toBe(false);
    });
  });

  describe("a bare name", () => {
    const it = test.extend("chainReading", () => {
      const written = parseSync("spec.ts", "checker;").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionChain(written.expression);
    });

    it("is left outside the chain", ({ chainReading }) => {
      expect(chainReading).toBe(false);
    });
  });

  describe("a modifier chain whose root is another name", () => {
    const it = test.extend("chainReading", () => {
      const written = parseSync("spec.ts", "checker.not;").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionChain(written.expression);
    });

    it("is left outside the chain", ({ chainReading }) => {
      expect(chainReading).toBe(false);
    });
  });
});

describe("isAssertionCall", () => {
  describe("a chain that reached a matcher", () => {
    const it = test.extend("assertionCallReading", () => {
      const written = parseSync("spec.ts", "expect(subject).toStrictEqual(expected);").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionCall(written.expression as ESTree.CallExpression);
    });

    it("counts as one assertion", ({ assertionCallReading }) => {
      expect(assertionCallReading).toBe(true);
    });
  });

  describe("a chain that reached a matcher behind a modifier", () => {
    const it = test.extend("assertionCallReading", () => {
      const written = parseSync("spec.ts", "expect(pending).rejects.toThrow(failure);").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionCall(written.expression as ESTree.CallExpression);
    });

    it("counts as one assertion", ({ assertionCallReading }) => {
      expect(assertionCallReading).toBe(true);
    });
  });

  describe("a matcher chosen at run time", () => {
    const it = test.extend("assertionCallReading", () => {
      const written = parseSync("spec.ts", "expect(subject)[chosen](expected);").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionCall(written.expression as ESTree.CallExpression);
    });

    it("counts as one assertion", ({ assertionCallReading }) => {
      expect(assertionCallReading).toBe(true);
    });
  });

  describe("a chain that stopped before a matcher", () => {
    const it = test.extend("assertionCallReading", () => {
      const written = parseSync("spec.ts", "expect(subject);").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionCall(written.expression as ESTree.CallExpression);
    });

    it("counts as no assertion", ({ assertionCallReading }) => {
      expect(assertionCallReading).toBe(false);
    });
  });

  describe("a utility of the entry namespace", () => {
    const it = test.extend("assertionCallReading", () => {
      const written = parseSync("spec.ts", "expect.assertions(1);").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionCall(written.expression as ESTree.CallExpression);
    });

    it("counts as no assertion", ({ assertionCallReading }) => {
      expect(assertionCallReading).toBe(false);
    });
  });

  describe("a matcher carried by another receiver", () => {
    const it = test.extend("assertionCallReading", () => {
      const written = parseSync("spec.ts", "checker.toBe(expected);").program
        .body[0] as ESTree.ExpressionStatement;
      return isAssertionCall(written.expression as ESTree.CallExpression);
    });

    it("counts as no assertion", ({ assertionCallReading }) => {
      expect(assertionCallReading).toBe(false);
    });
  });
});

describe("assertionEntryCallOf", () => {
  describe("a bare chain", () => {
    const it = test.extend("argumentCountOfTheEntryCall", () => {
      const written = parseSync("spec.ts", "expect(subject);").program
        .body[0] as ESTree.ExpressionStatement;
      return assertionEntryCallOf(written.expression)?.arguments.length ?? null;
    });

    it("hands back the entry call it stands on", ({ argumentCountOfTheEntryCall }) => {
      expect(argumentCountOfTheEntryCall).toBe(1);
    });
  });

  describe("a run of modifiers", () => {
    const it = test.extend("spellingOfTheEntryCall", () => {
      const written = parseSync("spec.ts", "expect(pending).resolves.not;").program
        .body[0] as ESTree.ExpressionStatement;
      return assertionEntryCallOf(written.expression)?.type ?? null;
    });

    it("hands back the entry call standing under it", ({ spellingOfTheEntryCall }) => {
      expect(spellingOfTheEntryCall).toBe("CallExpression");
    });
  });

  describe("a chain rooted in another name", () => {
    const it = test.extend("entryCall", () => {
      const written = parseSync("spec.ts", "checker.not;").program
        .body[0] as ESTree.ExpressionStatement;
      return assertionEntryCallOf(written.expression);
    });

    it("hands back nothing", ({ entryCall }) => {
      expect(entryCall).toBe(null);
    });
  });

  describe("a member that is not a modifier", () => {
    const it = test.extend("entryCall", () => {
      const written = parseSync("spec.ts", "expect(subject).value;").program
        .body[0] as ESTree.ExpressionStatement;
      return assertionEntryCallOf(written.expression);
    });

    it("hands back nothing", ({ entryCall }) => {
      expect(entryCall).toBe(null);
    });
  });
});
