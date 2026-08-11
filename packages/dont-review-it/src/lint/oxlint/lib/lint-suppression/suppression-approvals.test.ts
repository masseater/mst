import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-suppression-approvals-"));

const repositoryHolding = ({
  name,
  written,
}: {
  readonly name: string;
  readonly written: string;
}) => {
  const root = join(fixtureDir, name);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, APPROVAL_LEDGER_FILE_NAME), written);
  return root;
};

const FULL_ROW: SuppressionApproval = {
  path: HOST_PATH,
  rule: REASSIGN_RULE,
  grounds: "the platform interface writes the total back into the element",
  approver: "the owner of the cart package",
};

describe("suppression-approvals", () => {
  test("a repository without a ledger file holds no approvals", () => {
    expect(approvalLedgerIn(join(fixtureDir, "unledgered"))).toStrictEqual([]);
  });

  test("a ledger that is not a list of rows holds no approvals", () => {
    expect(
      approvalLedgerIn(repositoryHolding({ name: "object-ledger", written: '{ "rows": [] }' })),
    ).toStrictEqual([]);
  });

  test("a row naming a path and a rule is read with its grounds and its approver", () => {
    expect(
      approvalLedgerIn(
        repositoryHolding({ name: "full", written: JSON.stringify([{ ...FULL_ROW }]) }),
      ),
    ).toStrictEqual([FULL_ROW]);
  });

  test("a row missing its path or its rule is no row at all", () => {
    expect(
      approvalLedgerIn(
        repositoryHolding({
          name: "partial",
          written: JSON.stringify([
            { rule: REASSIGN_RULE, grounds: "g", approver: "a" },
            { path: HOST_PATH, grounds: "g", approver: "a" },
            { path: "   ", rule: REASSIGN_RULE },
          ]),
        }),
      ),
    ).toStrictEqual([]);
  });

  test("a row written without grounds or approver is read with those fields empty", () => {
    expect(
      approvalLedgerIn(
        repositoryHolding({
          name: "bare",
          written: JSON.stringify([{ path: HOST_PATH, rule: REASSIGN_RULE }]),
        }),
      ),
    ).toStrictEqual([{ path: HOST_PATH, rule: REASSIGN_RULE, grounds: "", approver: "" }]);
  });

  test("a ledger read once is read again from the same repository", () => {
    const root = repositoryHolding({
      name: "memoized",
      written: JSON.stringify([{ ...FULL_ROW }]),
    });
    const first = approvalLedgerIn(root);
    writeFileSync(join(root, APPROVAL_LEDGER_FILE_NAME), "[]");
    expect(approvalLedgerIn(root)).toBe(first);
  });

  test("a row is found by the path and the rule the suppression names", () => {
    expect(approvalFor({ ledger: [FULL_ROW], path: HOST_PATH, ruleName: REASSIGN_RULE })).toBe(
      FULL_ROW,
    );
    expect(
      approvalFor({
        ledger: [FULL_ROW],
        path: HOST_PATH,
        ruleName: `dont-review-it/${REASSIGN_RULE}`,
      }),
    ).toBe(FULL_ROW);
  });

  test("a row naming another path or another rule is not the row asked for", () => {
    expect(
      approvalFor({
        ledger: [FULL_ROW],
        path: "packages/cart/src/name.ts",
        ruleName: REASSIGN_RULE,
      }),
    ).toBeNull();
    expect(approvalFor({ ledger: [FULL_ROW], path: HOST_PATH, ruleName: "no-console" })).toBeNull();
  });

  test("a row holding both grounds and an approver leaves no gap", () => {
    expect(gapIn(FULL_ROW)).toBeNull();
  });

  test("a row missing its grounds names the grounds as its gap", () => {
    expect(gapIn({ ...FULL_ROW, grounds: "" })).toBe("grounds");
  });

  test("a row missing its approver names the approver as its gap", () => {
    expect(gapIn({ ...FULL_ROW, approver: "" })).toBe("approver");
  });

  test("a line comment naming the rule is a directive the source still holds", () => {
    expect(
      holdsDirectiveNaming({
        text: `// oxlint-disable-next-line ${REASSIGN_RULE} -- the platform writes it back\nelement.total = 1;\n`,
        ruleName: REASSIGN_RULE,
      }),
    ).toBe(true);
  });

  test("a block comment naming the rule is a directive the source still holds", () => {
    expect(
      holdsDirectiveNaming({
        text: `/* oxlint-disable ${REASSIGN_RULE} */\nelement.total = 1;\n`,
        ruleName: REASSIGN_RULE,
      }),
    ).toBe(true);
  });

  test("a rule name written with its plugin prefix names the same rule", () => {
    expect(
      holdsDirectiveNaming({
        text: `// oxlint-disable-next-line dont-review-it/${REASSIGN_RULE} -- the platform writes it back\n`,
        ruleName: REASSIGN_RULE,
      }),
    ).toBe(true);
  });

  test("a source naming another rule holds no directive for this one", () => {
    expect(
      holdsDirectiveNaming({
        text: "// oxlint-disable-next-line no-console -- the CLI prints here\nconsole.log(1);\n",
        ruleName: REASSIGN_RULE,
      }),
    ).toBe(false);
  });

  test("a source whose comments open no directive holds none", () => {
    expect(
      holdsDirectiveNaming({
        text: `// the running total the checkout screen reads\n/**\n * @see ${REASSIGN_RULE}\n */\nexport const total = 1;\n`,
        ruleName: REASSIGN_RULE,
      }),
    ).toBe(false);
  });
});
