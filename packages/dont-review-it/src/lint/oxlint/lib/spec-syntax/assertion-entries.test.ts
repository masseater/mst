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

const it = test
  .extend("entryReferenceReadingOfTheEntryStandingOnItsOwn", () => {
    const written = parseSync("spec.ts", "expect;").program.body[0] as ESTree.ExpressionStatement;
    return isAssertionEntryReference(written.expression);
  })
  .extend("entryReferenceReadingOfAnotherNameInTheSamePosition", () => {
    const written = parseSync("spec.ts", "assert;").program.body[0] as ESTree.ExpressionStatement;
    return isAssertionEntryReference(written.expression);
  })
  .extend("entryReferenceReadingOfAReceiverThatIsNotAName", () => {
    const written = parseSync("spec.ts", "makeExpect();").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionEntryReference(written.expression);
  })
  .extend("entryCallReadingOfACallOnTheEntry", () => {
    const written = parseSync("spec.ts", "expect(subject);").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionEntryCall(written.expression as ESTree.CallExpression);
  })
  .extend("entryCallReadingOfACallOnAnotherName", () => {
    const written = parseSync("spec.ts", "assert(subject);").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionEntryCall(written.expression as ESTree.CallExpression);
  })
  .extend("entryCallReadingOfTheSoftReceiver", () => {
    const written = parseSync("spec.ts", "expect.soft(subject);").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionEntryCall(written.expression as ESTree.CallExpression);
  })
  .extend("entryCallReadingOfThePollReceiver", () => {
    const written = parseSync("spec.ts", "expect.poll(read);").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionEntryCall(written.expression as ESTree.CallExpression);
  })
  .extend("entryCallReadingOfAnotherMemberOfTheEntryNamespace", () => {
    const written = parseSync("spec.ts", "expect.extend(matchers);").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionEntryCall(written.expression as ESTree.CallExpression);
  })
  .extend("entryCallReadingOfADerivedSpellingCarriedByAnotherReceiver", () => {
    const written = parseSync("spec.ts", "runner.soft(subject);").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionEntryCall(written.expression as ESTree.CallExpression);
  })
  .extend("entryCallReadingOfAMemberChosenAtRunTime", () => {
    const written = parseSync("spec.ts", "expect[chosen](subject);").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionEntryCall(written.expression as ESTree.CallExpression);
  })
  .extend("entryCallReadingOfAnEntryHandedBackByAnotherCall", () => {
    const written = parseSync("spec.ts", "makeExpect()(subject);").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionEntryCall(written.expression as ESTree.CallExpression);
  })
  .extend("chainReadingOfABareEntryCall", () => {
    const written = parseSync("spec.ts", "expect(subject);").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionChain(written.expression);
  })
  .extend("chainReadingOfTheNegationModifier", () => {
    const written = parseSync("spec.ts", "expect(subject).not;").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionChain(written.expression);
  })
  .extend("chainReadingOfARunOfSettlementAndNegationModifiers", () => {
    const written = parseSync("spec.ts", "expect(pending).resolves.not;").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionChain(written.expression);
  })
  .extend("chainReadingOfTheRejectionModifier", () => {
    const written = parseSync("spec.ts", "expect(pending).rejects;").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionChain(written.expression);
  })
  .extend("chainReadingOfANonNullAssertionAroundTheRoot", () => {
    const written = parseSync("spec.ts", "expect(subject)!;").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionChain(written.expression);
  })
  .extend("chainReadingOfATypeAssertionAroundTheRoot", () => {
    const written = parseSync("spec.ts", "expect(subject) as Assertion;").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionChain(written.expression);
  })
  .extend("chainReadingOfAMemberThatIsNotAModifier", () => {
    const written = parseSync("spec.ts", "expect(subject).value;").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionChain(written.expression);
  })
  .extend("chainReadingOfALinkChosenAtRunTime", () => {
    const written = parseSync("spec.ts", "expect(subject)[modifier];").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionChain(written.expression);
  })
  .extend("chainReadingOfABareName", () => {
    const written = parseSync("spec.ts", "checker;").program.body[0] as ESTree.ExpressionStatement;
    return isAssertionChain(written.expression);
  })
  .extend("chainReadingOfAModifierChainRootedInAnotherName", () => {
    const written = parseSync("spec.ts", "checker.not;").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionChain(written.expression);
  })
  .extend("assertionCallReadingOfAChainThatReachedAMatcher", () => {
    const written = parseSync("spec.ts", "expect(subject).toStrictEqual(expected);").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionCall(written.expression as ESTree.CallExpression);
  })
  .extend("assertionCallReadingOfAMatcherBehindAModifier", () => {
    const written = parseSync("spec.ts", "expect(pending).rejects.toThrow(failure);").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionCall(written.expression as ESTree.CallExpression);
  })
  .extend("assertionCallReadingOfAMatcherChosenAtRunTime", () => {
    const written = parseSync("spec.ts", "expect(subject)[chosen](expected);").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionCall(written.expression as ESTree.CallExpression);
  })
  .extend("assertionCallReadingOfAChainThatStoppedBeforeAMatcher", () => {
    const written = parseSync("spec.ts", "expect(subject);").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionCall(written.expression as ESTree.CallExpression);
  })
  .extend("assertionCallReadingOfAUtilityOfTheEntryNamespace", () => {
    const written = parseSync("spec.ts", "expect.assertions(1);").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionCall(written.expression as ESTree.CallExpression);
  })
  .extend("assertionCallReadingOfAMatcherCarriedByAnotherReceiver", () => {
    const written = parseSync("spec.ts", "checker.toBe(expected);").program
      .body[0] as ESTree.ExpressionStatement;
    return isAssertionCall(written.expression as ESTree.CallExpression);
  })
  .extend("argumentCountOfTheEntryCallABareChainStandsOn", () => {
    const written = parseSync("spec.ts", "expect(subject);").program
      .body[0] as ESTree.ExpressionStatement;
    return assertionEntryCallOf(written.expression)?.arguments.length ?? null;
  })
  .extend("spellingOfTheEntryCallUnderARunOfModifiers", () => {
    const written = parseSync("spec.ts", "expect(pending).resolves.not;").program
      .body[0] as ESTree.ExpressionStatement;
    return assertionEntryCallOf(written.expression)?.type ?? null;
  })
  .extend("entryCallUnderAChainRootedInAnotherName", () => {
    const written = parseSync("spec.ts", "checker.not;").program
      .body[0] as ESTree.ExpressionStatement;
    return assertionEntryCallOf(written.expression);
  })
  .extend("entryCallUnderAMemberThatIsNotAModifier", () => {
    const written = parseSync("spec.ts", "expect(subject).value;").program
      .body[0] as ESTree.ExpressionStatement;
    return assertionEntryCallOf(written.expression);
  });

describe("ASSERTION_ENTRY_NAME", () => {
  it("spells the entry the way the runner injects it", () => {
    expect(ASSERTION_ENTRY_NAME).toBe("expect");
  });
});

describe("isAssertionEntryReference", () => {
  it("recognises the entry standing on its own", ({
    entryReferenceReadingOfTheEntryStandingOnItsOwn,
  }) => {
    expect(entryReferenceReadingOfTheEntryStandingOnItsOwn).toBe(true);
  });

  it("leaves another name standing in the same position", ({
    entryReferenceReadingOfAnotherNameInTheSamePosition,
  }) => {
    expect(entryReferenceReadingOfAnotherNameInTheSamePosition).toBe(false);
  });

  it("leaves a receiver that is not a name at all", ({
    entryReferenceReadingOfAReceiverThatIsNotAName,
  }) => {
    expect(entryReferenceReadingOfAReceiverThatIsNotAName).toBe(false);
  });
});

describe("isAssertionEntryCall", () => {
  it("reads a call on the entry as the opening of an assertion", ({
    entryCallReadingOfACallOnTheEntry,
  }) => {
    expect(entryCallReadingOfACallOnTheEntry).toBe(true);
  });

  it("leaves a call on another name", ({ entryCallReadingOfACallOnAnotherName }) => {
    expect(entryCallReadingOfACallOnAnotherName).toBe(false);
  });

  it("reads the soft receiver as the same opening", ({ entryCallReadingOfTheSoftReceiver }) => {
    expect(entryCallReadingOfTheSoftReceiver).toBe(true);
  });

  it("reads the poll receiver as the same opening", ({ entryCallReadingOfThePollReceiver }) => {
    expect(entryCallReadingOfThePollReceiver).toBe(true);
  });

  it("leaves another member of the entry namespace", ({
    entryCallReadingOfAnotherMemberOfTheEntryNamespace,
  }) => {
    expect(entryCallReadingOfAnotherMemberOfTheEntryNamespace).toBe(false);
  });

  it("leaves a derived spelling carried by another receiver", ({
    entryCallReadingOfADerivedSpellingCarriedByAnotherReceiver,
  }) => {
    expect(entryCallReadingOfADerivedSpellingCarriedByAnotherReceiver).toBe(false);
  });

  it("leaves a member of the entry chosen at run time", ({
    entryCallReadingOfAMemberChosenAtRunTime,
  }) => {
    expect(entryCallReadingOfAMemberChosenAtRunTime).toBe(false);
  });

  it("leaves an entry handed back by another call", ({
    entryCallReadingOfAnEntryHandedBackByAnotherCall,
  }) => {
    expect(entryCallReadingOfAnEntryHandedBackByAnotherCall).toBe(false);
  });
});

describe("isAssertionChain", () => {
  it("reads a chain whose root is the entry call", ({ chainReadingOfABareEntryCall }) => {
    expect(chainReadingOfABareEntryCall).toBe(true);
  });

  it("keeps the negation modifier inside the chain", ({ chainReadingOfTheNegationModifier }) => {
    expect(chainReadingOfTheNegationModifier).toBe(true);
  });

  it("keeps a run of settlement and negation modifiers inside the chain", ({
    chainReadingOfARunOfSettlementAndNegationModifiers,
  }) => {
    expect(chainReadingOfARunOfSettlementAndNegationModifiers).toBe(true);
  });

  it("keeps the rejection modifier inside the chain", ({ chainReadingOfTheRejectionModifier }) => {
    expect(chainReadingOfTheRejectionModifier).toBe(true);
  });

  it("sees through a non-null assertion written around the root", ({
    chainReadingOfANonNullAssertionAroundTheRoot,
  }) => {
    expect(chainReadingOfANonNullAssertionAroundTheRoot).toBe(true);
  });

  it("sees through a type assertion written around the root", ({
    chainReadingOfATypeAssertionAroundTheRoot,
  }) => {
    expect(chainReadingOfATypeAssertionAroundTheRoot).toBe(true);
  });

  it("leaves a member that is not a modifier", ({ chainReadingOfAMemberThatIsNotAModifier }) => {
    expect(chainReadingOfAMemberThatIsNotAModifier).toBe(false);
  });

  it("leaves a link chosen at run time", ({ chainReadingOfALinkChosenAtRunTime }) => {
    expect(chainReadingOfALinkChosenAtRunTime).toBe(false);
  });

  it("leaves a bare name", ({ chainReadingOfABareName }) => {
    expect(chainReadingOfABareName).toBe(false);
  });

  it("leaves a modifier chain whose root is another name", ({
    chainReadingOfAModifierChainRootedInAnotherName,
  }) => {
    expect(chainReadingOfAModifierChainRootedInAnotherName).toBe(false);
  });
});

describe("isAssertionCall", () => {
  it("counts a chain that reached a matcher as one assertion", ({
    assertionCallReadingOfAChainThatReachedAMatcher,
  }) => {
    expect(assertionCallReadingOfAChainThatReachedAMatcher).toBe(true);
  });

  it("counts a chain that reached a matcher behind a modifier as one assertion", ({
    assertionCallReadingOfAMatcherBehindAModifier,
  }) => {
    expect(assertionCallReadingOfAMatcherBehindAModifier).toBe(true);
  });

  it("counts a matcher chosen at run time as one assertion", ({
    assertionCallReadingOfAMatcherChosenAtRunTime,
  }) => {
    expect(assertionCallReadingOfAMatcherChosenAtRunTime).toBe(true);
  });

  it("leaves a chain that stopped before a matcher", ({
    assertionCallReadingOfAChainThatStoppedBeforeAMatcher,
  }) => {
    expect(assertionCallReadingOfAChainThatStoppedBeforeAMatcher).toBe(false);
  });

  it("leaves a utility of the entry namespace", ({
    assertionCallReadingOfAUtilityOfTheEntryNamespace,
  }) => {
    expect(assertionCallReadingOfAUtilityOfTheEntryNamespace).toBe(false);
  });

  it("leaves a matcher carried by another receiver", ({
    assertionCallReadingOfAMatcherCarriedByAnotherReceiver,
  }) => {
    expect(assertionCallReadingOfAMatcherCarriedByAnotherReceiver).toBe(false);
  });
});

describe("assertionEntryCallOf", () => {
  it("hands back the entry call a bare chain stands on", ({
    argumentCountOfTheEntryCallABareChainStandsOn,
  }) => {
    expect(argumentCountOfTheEntryCallABareChainStandsOn).toBe(1);
  });

  it("hands back the entry call standing under a run of modifiers", ({
    spellingOfTheEntryCallUnderARunOfModifiers,
  }) => {
    expect(spellingOfTheEntryCallUnderARunOfModifiers).toBe("CallExpression");
  });

  it("hands back nothing for a chain rooted in another name", ({
    entryCallUnderAChainRootedInAnotherName,
  }) => {
    expect(entryCallUnderAChainRootedInAnotherName).toBe(null);
  });

  it("hands back nothing for a member that is not a modifier", ({
    entryCallUnderAMemberThatIsNotAModifier,
  }) => {
    expect(entryCallUnderAMemberThatIsNotAModifier).toBe(null);
  });
});
