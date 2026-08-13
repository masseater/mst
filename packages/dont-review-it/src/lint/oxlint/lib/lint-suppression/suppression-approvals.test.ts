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

describe("approvalLedgerIn", () => {
  describe("a repository without a ledger file", () => {
    const it = test.extend("approvalsOfARepositoryWithoutALedger", () =>
      approvalLedgerIn(join(FIXTURE_ROOT, "unledgered")));

    it("holds no approvals", ({ approvalsOfARepositoryWithoutALedger }) => {
      expect(approvalsOfARepositoryWithoutALedger).toStrictEqual([]);
    });
  });

  describe("a ledger that is not a list of rows", () => {
    const it = test.extend("approvalsOfALedgerThatIsNotAListOfRows", ({}, { onCleanup }) => {
      const root = join(FIXTURE_ROOT, "object-ledger");
      rmSync(root, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(root, { recursive: true });
      writeFileSync(join(root, APPROVAL_LEDGER_FILE_NAME), '{ "rows": [] }');
      return approvalLedgerIn(root);
    });

    it("holds no approvals", ({ approvalsOfALedgerThatIsNotAListOfRows }) => {
      expect(approvalsOfALedgerThatIsNotAListOfRows).toStrictEqual([]);
    });
  });

  describe("a row naming a path and a rule", () => {
    const it = test.extend("approvalsOfARowNamingAPathAndARule", ({}, { onCleanup }) => {
      const root = join(FIXTURE_ROOT, "full");
      rmSync(root, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(root, { recursive: true });
      writeFileSync(join(root, APPROVAL_LEDGER_FILE_NAME), JSON.stringify([FULL_ROW]));
      return approvalLedgerIn(root);
    });

    it("is read with its grounds and its approver", ({ approvalsOfARowNamingAPathAndARule }) => {
      expect(approvalsOfARowNamingAPathAndARule).toStrictEqual([FULL_ROW]);
    });
  });

  describe("rows missing their path or their rule", () => {
    const it = test.extend("approvalsOfRowsMissingTheirPathOrTheirRule", ({}, { onCleanup }) => {
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
    });

    it("are no rows at all", ({ approvalsOfRowsMissingTheirPathOrTheirRule }) => {
      expect(approvalsOfRowsMissingTheirPathOrTheirRule).toStrictEqual([]);
    });
  });

  describe("a row written without grounds or approver", () => {
    const it = test.extend("approvalsOfARowWrittenWithoutGroundsOrApprover", ({}, {
      onCleanup,
    }) => {
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
    });

    it("is read with those fields empty", ({ approvalsOfARowWrittenWithoutGroundsOrApprover }) => {
      expect(approvalsOfARowWrittenWithoutGroundsOrApprover).toStrictEqual([
        { path: HOST_PATH, rule: REASSIGN_RULE, grounds: "", approver: "" },
      ]);
    });
  });

  describe("a ledger row written as bare text", () => {
    const it = test.extend("approvalsOfARowOfBareText", ({}, { onCleanup }) => {
      const root = join(FIXTURE_ROOT, "row-of-bare-text");
      rmSync(root, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(root, { recursive: true });
      writeFileSync(join(root, APPROVAL_LEDGER_FILE_NAME), JSON.stringify([REASSIGN_RULE]));
      return approvalLedgerIn(root);
    });

    it("approves nothing", ({ approvalsOfARowOfBareText }) => {
      expect(approvalsOfARowOfBareText).toStrictEqual([]);
    });
  });

  describe("a ledger entry that is not a row", () => {
    const it = test.extend("approvalsOfALedgerHoldingEntriesThatAreNotRows", ({}, {
      onCleanup,
    }) => {
      const root = join(FIXTURE_ROOT, "unshaped-entries");
      rmSync(root, { recursive: true, force: true });
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(root, { recursive: true });
      writeFileSync(
        join(root, APPROVAL_LEDGER_FILE_NAME),
        JSON.stringify([null, HOST_PATH, 42, [], { ...FULL_ROW }]),
      );
      return approvalLedgerIn(root);
    });

    it("leaves the rows around it standing", ({
      approvalsOfALedgerHoldingEntriesThatAreNotRows,
    }) => {
      expect(approvalsOfALedgerHoldingEntriesThatAreNotRows).toStrictEqual([FULL_ROW]);
    });
  });

  describe("a ledger read once and then emptied", () => {
    const it = test.extend("approvalsReadAgainAfterTheLedgerWasEmptied", ({}, { onCleanup }) => {
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
    });

    it("is read again from the same repository", ({
      approvalsReadAgainAfterTheLedgerWasEmptied,
    }) => {
      expect(approvalsReadAgainAfterTheLedgerWasEmptied).toStrictEqual([FULL_ROW]);
    });
  });
});

describe("approvalFor", () => {
  describe("the path and the rule the suppression names", () => {
    const it = test.extend("approvalFoundByThePathAndTheRuleTheSuppressionNames", () =>
      approvalFor({ ledger: [FULL_ROW], path: HOST_PATH, ruleName: REASSIGN_RULE }));

    it("find the row", ({ approvalFoundByThePathAndTheRuleTheSuppressionNames }) => {
      expect(approvalFoundByThePathAndTheRuleTheSuppressionNames).toBe(FULL_ROW);
    });
  });

  describe("a rule name carrying its plugin prefix", () => {
    const it = test.extend("approvalFoundByARuleNameCarryingItsPluginPrefix", () =>
      approvalFor({
        ledger: [FULL_ROW],
        path: HOST_PATH,
        ruleName: `dont-review-it/${REASSIGN_RULE}`,
      }));

    it("finds the same row", ({ approvalFoundByARuleNameCarryingItsPluginPrefix }) => {
      expect(approvalFoundByARuleNameCarryingItsPluginPrefix).toBe(FULL_ROW);
    });
  });

  describe("a row naming another path", () => {
    const it = test.extend("approvalLookedUpUnderAnotherPath", () =>
      approvalFor({
        ledger: [FULL_ROW],
        path: "packages/cart/src/name.ts",
        ruleName: REASSIGN_RULE,
      }));

    it("is not the row asked for", ({ approvalLookedUpUnderAnotherPath }) => {
      expect(approvalLookedUpUnderAnotherPath).toBe(null);
    });
  });

  describe("a row naming another rule", () => {
    const it = test.extend("approvalLookedUpUnderAnotherRule", () =>
      approvalFor({ ledger: [FULL_ROW], path: HOST_PATH, ruleName: "no-console" }));

    it("is not the row asked for", ({ approvalLookedUpUnderAnotherRule }) => {
      expect(approvalLookedUpUnderAnotherRule).toBe(null);
    });
  });
});

describe("gapIn", () => {
  describe("a row holding both grounds and an approver", () => {
    const it = test.extend("gapOfARowHoldingBothGroundsAndAnApprover", () => gapIn(FULL_ROW));

    it("leaves no gap", ({ gapOfARowHoldingBothGroundsAndAnApprover }) => {
      expect(gapOfARowHoldingBothGroundsAndAnApprover).toBe(null);
    });
  });

  describe("a row missing its grounds", () => {
    const it = test.extend("gapOfARowMissingItsGrounds", () => gapIn({ ...FULL_ROW, grounds: "" }));

    it("names the grounds as its gap", ({ gapOfARowMissingItsGrounds }) => {
      expect(gapOfARowMissingItsGrounds).toBe("grounds");
    });
  });

  describe("a row missing its approver", () => {
    const it = test.extend("gapOfARowMissingItsApprover", () =>
      gapIn({ ...FULL_ROW, approver: "" }));

    it("names the approver as its gap", ({ gapOfARowMissingItsApprover }) => {
      expect(gapOfARowMissingItsApprover).toBe("approver");
    });
  });
});

describe("holdsDirectiveNaming", () => {
  describe("a line comment naming the rule", () => {
    const it = test.extend("holdingOfADirectiveWrittenAsALineComment", () =>
      holdsDirectiveNaming({
        text: `// oxlint-disable-next-line ${REASSIGN_RULE} -- the platform writes it back\nelement.total = 1;\n`,
        ruleName: REASSIGN_RULE,
      }));

    it("is a directive the source still holds", ({ holdingOfADirectiveWrittenAsALineComment }) => {
      expect(holdingOfADirectiveWrittenAsALineComment).toBe(true);
    });
  });

  describe("a block comment naming the rule", () => {
    const it = test.extend("holdingOfADirectiveWrittenAsABlockComment", () =>
      holdsDirectiveNaming({
        text: `/* oxlint-disable ${REASSIGN_RULE} */\nelement.total = 1;\n`,
        ruleName: REASSIGN_RULE,
      }));

    it("is a directive the source still holds", ({ holdingOfADirectiveWrittenAsABlockComment }) => {
      expect(holdingOfADirectiveWrittenAsABlockComment).toBe(true);
    });
  });

  describe("a rule name written with its plugin prefix", () => {
    const it = test.extend("holdingOfADirectiveNamingTheRuleWithItsPluginPrefix", () =>
      holdsDirectiveNaming({
        text: `// oxlint-disable-next-line dont-review-it/${REASSIGN_RULE} -- the platform writes it back\n`,
        ruleName: REASSIGN_RULE,
      }));

    it("names the same rule", ({ holdingOfADirectiveNamingTheRuleWithItsPluginPrefix }) => {
      expect(holdingOfADirectiveNamingTheRuleWithItsPluginPrefix).toBe(true);
    });
  });

  describe("a source naming another rule", () => {
    const it = test.extend("holdingOfADirectiveNamingAnotherRule", () =>
      holdsDirectiveNaming({
        text: "// oxlint-disable-next-line no-console -- the CLI prints here\nconsole.log(1);\n",
        ruleName: REASSIGN_RULE,
      }));

    it("holds no directive for this one", ({ holdingOfADirectiveNamingAnotherRule }) => {
      expect(holdingOfADirectiveNamingAnotherRule).toBe(false);
    });
  });

  describe("a source whose comments open no directive", () => {
    const it = test.extend("holdingOfCommentsThatOpenNoDirective", () =>
      holdsDirectiveNaming({
        text: `// the running total the checkout screen reads\n/**\n * @see ${REASSIGN_RULE}\n */\nexport const total = 1;\n`,
        ruleName: REASSIGN_RULE,
      }));

    it("holds none", ({ holdingOfCommentsThatOpenNoDirective }) => {
      expect(holdingOfCommentsThatOpenNoDirective).toBe(false);
    });
  });

  describe("a directive written right behind another comment", () => {
    const it = test.extend("holdingOfADirectiveBehindAnotherComment", () =>
      holdsDirectiveNaming({
        text: `/* the running total the checkout screen reads *//* oxlint-disable-next-line ${REASSIGN_RULE} -- the platform writes it back */\nelement.total = 1;\n`,
        ruleName: REASSIGN_RULE,
      }));

    it("is still found", ({ holdingOfADirectiveBehindAnotherComment }) => {
      expect(holdingOfADirectiveBehindAnotherComment).toBe(true);
    });
  });
});
