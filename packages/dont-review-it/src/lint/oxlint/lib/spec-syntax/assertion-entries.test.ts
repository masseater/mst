import { parseSync } from "oxc-parser";
import { describe, expect, it } from "vite-plus/test";

import {
  ASSERTION_ENTRY_NAME,
  assertionEntryCallOf,
  isAssertionCall,
  isAssertionChain,
  isAssertionEntryCall,
  isAssertionEntryReference,
} from "./assertion-entries.ts";

import type { ESTree } from "@oxlint/plugins";

const expressionIn = (sourceText: string): ESTree.Expression => {
  const written = parseSync("spec.ts", `${sourceText};`).program.body[0] as ESTree.Statement;
  return (written as ESTree.ExpressionStatement).expression;
};

const callIn = (sourceText: string): ESTree.CallExpression =>
  expressionIn(sourceText) as ESTree.CallExpression;

describe("ASSERTION_ENTRY_NAME", () => {
  it("spells the entry the way the runner injects it", () => {
    expect(ASSERTION_ENTRY_NAME).toBe("expect");
  });
});

describe("isAssertionEntryReference", () => {
  it("recognises the entry standing on its own", () => {
    expect(isAssertionEntryReference(expressionIn("expect"))).toBe(true);
  });

  it("leaves another name standing in the same position", () => {
    expect(isAssertionEntryReference(expressionIn("assert"))).toBe(false);
  });

  it("leaves a receiver that is not a name at all", () => {
    expect(isAssertionEntryReference(expressionIn("makeExpect()"))).toBe(false);
  });
});

describe("isAssertionEntryCall", () => {
  it("reads a call on the entry as the opening of an assertion", () => {
    expect(isAssertionEntryCall(callIn("expect(subject)"))).toBe(true);
  });

  it("leaves a call on another name", () => {
    expect(isAssertionEntryCall(callIn("assert(subject)"))).toBe(false);
  });

  it("reads the derived entry points as the same opening", () => {
    expect(isAssertionEntryCall(callIn("expect.soft(subject)"))).toBe(true);
    expect(isAssertionEntryCall(callIn("expect.poll(read)"))).toBe(true);
  });

  it("leaves another member of the entry namespace", () => {
    expect(isAssertionEntryCall(callIn("expect.extend(matchers)"))).toBe(false);
  });

  it("leaves a derived spelling carried by another receiver", () => {
    expect(isAssertionEntryCall(callIn("runner.soft(subject)"))).toBe(false);
  });

  it("leaves a member of the entry chosen at run time", () => {
    expect(isAssertionEntryCall(callIn("expect[chosen](subject)"))).toBe(false);
  });

  it("leaves an entry handed back by another call", () => {
    expect(isAssertionEntryCall(callIn("makeExpect()(subject)"))).toBe(false);
  });
});

describe("isAssertionChain", () => {
  it("reads a chain whose root is the entry call", () => {
    expect(isAssertionChain(expressionIn("expect(subject)"))).toBe(true);
  });

  it("keeps the modifiers written in front of a matcher inside the chain", () => {
    expect(isAssertionChain(expressionIn("expect(subject).not"))).toBe(true);
    expect(isAssertionChain(expressionIn("expect(pending).resolves.not"))).toBe(true);
    expect(isAssertionChain(expressionIn("expect(pending).rejects"))).toBe(true);
  });

  it("sees through the wrappers written around the root", () => {
    expect(isAssertionChain(expressionIn("expect(subject)!"))).toBe(true);
    expect(isAssertionChain(expressionIn("expect(subject) as Assertion"))).toBe(true);
  });

  it("leaves a member that is not a modifier", () => {
    expect(isAssertionChain(expressionIn("expect(subject).value"))).toBe(false);
  });

  it("leaves a link chosen at run time", () => {
    expect(isAssertionChain(expressionIn("expect(subject)[modifier]"))).toBe(false);
  });

  it("leaves a bare name", () => {
    expect(isAssertionChain(expressionIn("checker"))).toBe(false);
  });

  it("leaves a modifier chain whose root is another name", () => {
    expect(isAssertionChain(expressionIn("checker.not"))).toBe(false);
  });
});

describe("isAssertionCall", () => {
  it("counts a chain that reached a matcher as one assertion", () => {
    expect(isAssertionCall(callIn("expect(subject).toStrictEqual(expected)"))).toBe(true);
  });

  it("counts a chain that reached a matcher behind a modifier as one assertion", () => {
    expect(isAssertionCall(callIn("expect(pending).rejects.toThrow(failure)"))).toBe(true);
  });

  it("counts a matcher chosen at run time as one assertion", () => {
    expect(isAssertionCall(callIn("expect(subject)[chosen](expected)"))).toBe(true);
  });

  it("leaves a chain that stopped before a matcher", () => {
    expect(isAssertionCall(callIn("expect(subject)"))).toBe(false);
  });

  it("leaves a utility of the entry namespace", () => {
    expect(isAssertionCall(callIn("expect.assertions(1)"))).toBe(false);
  });

  it("leaves a matcher carried by another receiver", () => {
    expect(isAssertionCall(callIn("checker.toBe(expected)"))).toBe(false);
  });
});

describe("assertionEntryCallOf", () => {
  it("hands back the entry call a bare chain stands on", () => {
    const reached = assertionEntryCallOf(expressionIn("expect(subject)"));
    expect(reached === null ? null : reached.arguments.length).toBe(1);
  });

  it("hands back the entry call standing under a run of modifiers", () => {
    const reached = assertionEntryCallOf(expressionIn("expect(pending).resolves.not"));
    expect(reached?.type).toBe("CallExpression");
  });

  it("hands back nothing for a chain rooted in another name", () => {
    expect(assertionEntryCallOf(expressionIn("checker.not"))).toBe(null);
  });

  it("hands back nothing for a member that is not a modifier", () => {
    expect(assertionEntryCallOf(expressionIn("expect(subject).value"))).toBe(null);
  });
});
