import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  APPROVAL_LEDGER_FILE_NAME,
  approvalFor,
  approvalLedgerIn,
  gapIn,
  holdsDirectiveNaming,
  type SuppressionApproval,
} from "./suppression-approvals.ts";

const REASSIGN_RULE = "no-reassign--use-spread-or-iife";

const HOST_PATH = "packages/cart/src/total.ts";

const FIXTURE_ROOT = join(tmpdir(), "dont-review-it-suppression-approvals");

const FULL_ROW: SuppressionApproval = {
  path: HOST_PATH,
  rule: REASSIGN_RULE,
  grounds: "the platform interface writes the total back into the element",
  approver: "the owner of the cart package",
};

const it = test
  .extend("approvalsOfARepositoryWithoutALedger", () =>
    approvalLedgerIn(join(FIXTURE_ROOT, "unledgered")))
  .extend("approvalsOfALedgerThatIsNotAListOfRows", ({}, { onCleanup }) => {
    const root = join(FIXTURE_ROOT, "object-ledger");
    rmSync(root, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, APPROVAL_LEDGER_FILE_NAME), '{ "rows": [] }');
    return approvalLedgerIn(root);
  })
  .extend("approvalsOfARowNamingAPathAndARule", ({}, { onCleanup }) => {
    const root = join(FIXTURE_ROOT, "full");
    rmSync(root, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, APPROVAL_LEDGER_FILE_NAME), JSON.stringify([FULL_ROW]));
    return approvalLedgerIn(root);
  })
  .extend("approvalsOfRowsMissingTheirPathOrTheirRule", ({}, { onCleanup }) => {
    const root = join(FIXTURE_ROOT, "partial");
    rmSync(root, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(root, { recursive: true });
    writeFileSync(
      join(root, APPROVAL_LEDGER_FILE_NAME),
      JSON.stringify([
        { rule: REASSIGN_RULE, grounds: "g", approver: "a" },
        { path: HOST_PATH, grounds: "g", approver: "a" },
        { path: "   ", rule: REASSIGN_RULE },
      ]),
    );
    return approvalLedgerIn(root);
  })
  .extend("approvalsOfARowWrittenWithoutGroundsOrApprover", ({}, { onCleanup }) => {
    const root = join(FIXTURE_ROOT, "bare");
    rmSync(root, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(root, { recursive: true });
    writeFileSync(
      join(root, APPROVAL_LEDGER_FILE_NAME),
      JSON.stringify([{ path: HOST_PATH, rule: REASSIGN_RULE }]),
    );
    return approvalLedgerIn(root);
  })
  .extend("approvalsOfARowOfBareText", ({}, { onCleanup }) => {
    const root = join(FIXTURE_ROOT, "row-of-bare-text");
    rmSync(root, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, APPROVAL_LEDGER_FILE_NAME), JSON.stringify([REASSIGN_RULE]));
    return approvalLedgerIn(root);
  })
  .extend("approvalsReadAgainAfterTheLedgerWasEmptied", ({}, { onCleanup }) => {
    const root = join(FIXTURE_ROOT, "memoized");
    rmSync(root, { recursive: true, force: true });
    onCleanup(() => {
      rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, APPROVAL_LEDGER_FILE_NAME), JSON.stringify([FULL_ROW]));
    approvalLedgerIn(root);
    writeFileSync(join(root, APPROVAL_LEDGER_FILE_NAME), "[]");
    return approvalLedgerIn(root);
  })
  .extend("approvalFoundByThePathAndTheRuleTheSuppressionNames", () =>
    approvalFor({ ledger: [FULL_ROW], path: HOST_PATH, ruleName: REASSIGN_RULE }),
  )
  .extend("approvalFoundByARuleNameCarryingItsPluginPrefix", () =>
    approvalFor({
      ledger: [FULL_ROW],
      path: HOST_PATH,
      ruleName: `dont-review-it/${REASSIGN_RULE}`,
    }),
  )
  .extend("approvalLookedUpUnderAnotherPath", () =>
    approvalFor({ ledger: [FULL_ROW], path: "packages/cart/src/name.ts", ruleName: REASSIGN_RULE }),
  )
  .extend("approvalLookedUpUnderAnotherRule", () =>
    approvalFor({ ledger: [FULL_ROW], path: HOST_PATH, ruleName: "no-console" }),
  )
  .extend("gapOfARowHoldingBothGroundsAndAnApprover", () => gapIn(FULL_ROW))
  .extend("gapOfARowMissingItsGrounds", () => gapIn({ ...FULL_ROW, grounds: "" }))
  .extend("gapOfARowMissingItsApprover", () => gapIn({ ...FULL_ROW, approver: "" }))
  .extend("holdingOfADirectiveWrittenAsALineComment", () =>
    holdsDirectiveNaming({
      text: `// oxlint-disable-next-line ${REASSIGN_RULE} -- the platform writes it back\nelement.total = 1;\n`,
      ruleName: REASSIGN_RULE,
    }),
  )
  .extend("holdingOfADirectiveWrittenAsABlockComment", () =>
    holdsDirectiveNaming({
      text: `/* oxlint-disable ${REASSIGN_RULE} */\nelement.total = 1;\n`,
      ruleName: REASSIGN_RULE,
    }),
  )
  .extend("holdingOfADirectiveNamingTheRuleWithItsPluginPrefix", () =>
    holdsDirectiveNaming({
      text: `// oxlint-disable-next-line dont-review-it/${REASSIGN_RULE} -- the platform writes it back\n`,
      ruleName: REASSIGN_RULE,
    }),
  )
  .extend("holdingOfADirectiveNamingAnotherRule", () =>
    holdsDirectiveNaming({
      text: "// oxlint-disable-next-line no-console -- the CLI prints here\nconsole.log(1);\n",
      ruleName: REASSIGN_RULE,
    }),
  )
  .extend("holdingOfCommentsThatOpenNoDirective", () =>
    holdsDirectiveNaming({
      text: `// the running total the checkout screen reads\n/**\n * @see ${REASSIGN_RULE}\n */\nexport const total = 1;\n`,
      ruleName: REASSIGN_RULE,
    }),
  )
  .extend("holdingOfADirectiveBehindAnotherComment", () =>
    holdsDirectiveNaming({
      text: `/* the running total the checkout screen reads *//* oxlint-disable-next-line ${REASSIGN_RULE} -- the platform writes it back */\nelement.total = 1;\n`,
      ruleName: REASSIGN_RULE,
    }),
  );

describe("suppression-approvals", () => {
  it("a repository without a ledger file holds no approvals", ({
    approvalsOfARepositoryWithoutALedger,
  }) => {
    expect(approvalsOfARepositoryWithoutALedger).toStrictEqual([]);
  });

  it("a ledger that is not a list of rows holds no approvals", ({
    approvalsOfALedgerThatIsNotAListOfRows,
  }) => {
    expect(approvalsOfALedgerThatIsNotAListOfRows).toStrictEqual([]);
  });

  it("a row naming a path and a rule is read with its grounds and its approver", ({
    approvalsOfARowNamingAPathAndARule,
  }) => {
    expect(approvalsOfARowNamingAPathAndARule).toStrictEqual([FULL_ROW]);
  });

  it("a row missing its path or its rule is no row at all", ({
    approvalsOfRowsMissingTheirPathOrTheirRule,
  }) => {
    expect(approvalsOfRowsMissingTheirPathOrTheirRule).toStrictEqual([]);
  });

  it("a row written without grounds or approver is read with those fields empty", ({
    approvalsOfARowWrittenWithoutGroundsOrApprover,
  }) => {
    expect(approvalsOfARowWrittenWithoutGroundsOrApprover).toStrictEqual([
      { path: HOST_PATH, rule: REASSIGN_RULE, grounds: "", approver: "" },
    ]);
  });

  it("a ledger row written as bare text approves nothing", ({ approvalsOfARowOfBareText }) => {
    expect(approvalsOfARowOfBareText).toStrictEqual([]);
  });

  it("a ledger read once is read again from the same repository", ({
    approvalsReadAgainAfterTheLedgerWasEmptied,
  }) => {
    expect(approvalsReadAgainAfterTheLedgerWasEmptied).toStrictEqual([FULL_ROW]);
  });

  it("a row is found by the path and the rule the suppression names", ({
    approvalFoundByThePathAndTheRuleTheSuppressionNames,
  }) => {
    expect(approvalFoundByThePathAndTheRuleTheSuppressionNames).toBe(FULL_ROW);
  });

  it("a rule name carrying its plugin prefix finds the same row", ({
    approvalFoundByARuleNameCarryingItsPluginPrefix,
  }) => {
    expect(approvalFoundByARuleNameCarryingItsPluginPrefix).toBe(FULL_ROW);
  });

  it("a row naming another path is not the row asked for", ({
    approvalLookedUpUnderAnotherPath,
  }) => {
    expect(approvalLookedUpUnderAnotherPath).toBe(null);
  });

  it("a row naming another rule is not the row asked for", ({
    approvalLookedUpUnderAnotherRule,
  }) => {
    expect(approvalLookedUpUnderAnotherRule).toBe(null);
  });

  it("a row holding both grounds and an approver leaves no gap", ({
    gapOfARowHoldingBothGroundsAndAnApprover,
  }) => {
    expect(gapOfARowHoldingBothGroundsAndAnApprover).toBe(null);
  });

  it("a row missing its grounds names the grounds as its gap", ({ gapOfARowMissingItsGrounds }) => {
    expect(gapOfARowMissingItsGrounds).toBe("grounds");
  });

  it("a row missing its approver names the approver as its gap", ({
    gapOfARowMissingItsApprover,
  }) => {
    expect(gapOfARowMissingItsApprover).toBe("approver");
  });

  it("a line comment naming the rule is a directive the source still holds", ({
    holdingOfADirectiveWrittenAsALineComment,
  }) => {
    expect(holdingOfADirectiveWrittenAsALineComment).toBe(true);
  });

  it("a block comment naming the rule is a directive the source still holds", ({
    holdingOfADirectiveWrittenAsABlockComment,
  }) => {
    expect(holdingOfADirectiveWrittenAsABlockComment).toBe(true);
  });

  it("a rule name written with its plugin prefix names the same rule", ({
    holdingOfADirectiveNamingTheRuleWithItsPluginPrefix,
  }) => {
    expect(holdingOfADirectiveNamingTheRuleWithItsPluginPrefix).toBe(true);
  });

  it("a source naming another rule holds no directive for this one", ({
    holdingOfADirectiveNamingAnotherRule,
  }) => {
    expect(holdingOfADirectiveNamingAnotherRule).toBe(false);
  });

  it("a source whose comments open no directive holds none", ({
    holdingOfCommentsThatOpenNoDirective,
  }) => {
    expect(holdingOfCommentsThatOpenNoDirective).toBe(false);
  });

  it("a directive written right behind another comment is still found", ({
    holdingOfADirectiveBehindAnotherComment,
  }) => {
    expect(holdingOfADirectiveBehindAnotherComment).toBe(true);
  });
});
