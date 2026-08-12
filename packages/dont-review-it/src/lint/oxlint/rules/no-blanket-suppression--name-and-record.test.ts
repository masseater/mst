import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noBlanketSuppression } from "./no-blanket-suppression--name-and-record.ts";

const REASSIGN_RULE = "no-reassign--use-spread-or-iife";

const SELF_RULE = "no-blanket-suppression--name-and-record";

const LEDGER_FILE_NAME = "approved-lint-suppressions.json";

const HOST_PATH = "src/total.ts";

const STATEMENT = "element.total = 1;";

const GROUNDS = "the platform interface writes the total back into the element";

const APPROVER = "the owner of the cart package";

const nextLine = ({ rule, grounds }: { readonly rule: string; readonly grounds: string }): string =>
  `// oxlint-disable-next-line ${rule} -- ${grounds}\n${STATEMENT}`;

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-no-blanket-suppression-"));

const writtenFile = ({
  root,
  relativePath,
  written,
}: {
  readonly root: string;
  readonly relativePath: string;
  readonly written: string;
}): void => {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, written);
};

const repositoryHolding = ({
  name: spelled,
  rows,
}: {
  readonly name: string;
  readonly rows: readonly Readonly<Record<string, string>>[];
}): string => {
  const root = join(fixtureDir, spelled);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
  writeFileSync(join(root, LEDGER_FILE_NAME), JSON.stringify(rows));
  return root;
};

const FULL_ROW = {
  path: HOST_PATH,
  rule: REASSIGN_RULE,
  grounds: GROUNDS,
  approver: APPROVER,
};

const recordedHost = join(repositoryHolding({ name: "recorded", rows: [FULL_ROW] }), HOST_PATH);

const selfRecordedHost = join(
  repositoryHolding({ name: "self-recorded", rows: [{ ...FULL_ROW, rule: SELF_RULE }] }),
  HOST_PATH,
);

const unledgeredHost = join(repositoryHolding({ name: "unledgered", rows: [] }), HOST_PATH);

const groundlessRowHost = join(
  repositoryHolding({ name: "groundless-row", rows: [{ ...FULL_ROW, grounds: "" }] }),
  HOST_PATH,
);

const unapprovedRowHost = join(
  repositoryHolding({ name: "unapproved-row", rows: [{ ...FULL_ROW, approver: "" }] }),
  HOST_PATH,
);

const matchedRoot = repositoryHolding({ name: "matched", rows: [FULL_ROW] });
writtenFile({
  root: matchedRoot,
  relativePath: HOST_PATH,
  written: `${nextLine({ rule: REASSIGN_RULE, grounds: GROUNDS })}\n`,
});

const staleRoot = repositoryHolding({ name: "stale", rows: [FULL_ROW] });
writtenFile({ root: staleRoot, relativePath: HOST_PATH, written: `${STATEMENT}\n` });

const abandonedRoot = repositoryHolding({ name: "abandoned", rows: [FULL_ROW] });

const CONFIG_SOURCE = "export default { lint: {} };";

describe("dont-review-it/no-blanket-suppression--name-and-record", () => {
  testLintRule(noBlanketSuppression, {
    valid: [
      { name: "source that suppresses nothing passes", code: STATEMENT },
      {
        name: "a comment the linter does not read as a directive is not a suppression",
        code: `// the running total the checkout screen reads\n${STATEMENT}`,
      },
      {
        name: "a doc block that mentions a directive is not a directive",
        code: `/**\n * @see oxlint-disable\n */\n${STATEMENT}`,
      },
      {
        name: "re-enabling a rule is not a suppression",
        code: `// oxlint-enable ${REASSIGN_RULE}\n${STATEMENT}`,
      },
      {
        name: "a directive that names its rule, covers the next statement, carries grounds and is recorded passes",
        code: nextLine({ rule: REASSIGN_RULE, grounds: GROUNDS }),
        filename: recordedHost,
      },
      {
        name: "a directive naming this rule is judged on the four conditions every other one is judged on",
        code: nextLine({ rule: SELF_RULE, grounds: GROUNDS }),
        filename: selfRecordedHost,
      },
      {
        name: "a rule name carrying its plugin prefix reaches the row that names it bare",
        code: nextLine({ rule: `dont-review-it/${REASSIGN_RULE}`, grounds: GROUNDS }),
        filename: recordedHost,
      },
      {
        name: "a ledger row whose file still holds the directive it stands for passes",
        code: CONFIG_SOURCE,
        filename: join(matchedRoot, "vite.config.ts"),
      },
      {
        name: "a file that is not the lint configuration is read for its comments alone",
        code: CONFIG_SOURCE,
        filename: join(staleRoot, "rules-snapshot.ts"),
      },
    ],
    invalid: [
      {
        name: "a whole-file directive naming no rule is reported for naming none",
        code: `// oxlint-disable\n${STATEMENT}`,
        errors: [{ messageId: "unnamedSuppression", data: { spelling: "oxlint-disable" } }],
      },
      {
        name: "a next-line directive naming no rule is reported for naming none",
        code: `// oxlint-disable-next-line -- ${GROUNDS}\n${STATEMENT}`,
        errors: [
          { messageId: "unnamedSuppression", data: { spelling: "oxlint-disable-next-line" } },
        ],
      },
      {
        name: "a whole-file directive naming a rule is reported for its scope",
        code: `/* oxlint-disable ${REASSIGN_RULE} -- ${GROUNDS} */\n${STATEMENT}`,
        filename: recordedHost,
        errors: [{ messageId: "wideSuppression", data: { spelling: "oxlint-disable" } }],
      },
      {
        name: "the eslint spelling of a whole-file directive is reported the same way",
        code: `// eslint-disable ${REASSIGN_RULE} -- ${GROUNDS}\n${STATEMENT}`,
        filename: recordedHost,
        errors: [{ messageId: "wideSuppression", data: { spelling: "eslint-disable" } }],
      },
      {
        name: "a same-line directive is reported for covering a statement other than the one below it",
        code: `${STATEMENT} // oxlint-disable-line ${REASSIGN_RULE} -- ${GROUNDS}`,
        filename: recordedHost,
        errors: [{ messageId: "wideSuppression", data: { spelling: "oxlint-disable-line" } }],
      },
      {
        name: "a directive written without a grounds separator is reported for its grounds",
        code: `// oxlint-disable-next-line ${REASSIGN_RULE}\n${STATEMENT}`,
        filename: recordedHost,
        errors: [{ messageId: "groundlessSuppression", data: { ruleNames: REASSIGN_RULE } }],
      },
      {
        name: "grounds spelled as the rule name alone are no grounds",
        code: nextLine({ rule: REASSIGN_RULE, grounds: REASSIGN_RULE }),
        filename: recordedHost,
        errors: [{ messageId: "groundlessSuppression" }],
      },
      {
        name: "grounds spelled as a claim of a wrong report are no grounds",
        code: nextLine({ rule: REASSIGN_RULE, grounds: "false positive" }),
        filename: recordedHost,
        errors: [{ messageId: "groundlessSuppression" }],
      },
      {
        name: "a directive the ledger does not record is reported for the missing row",
        code: nextLine({ rule: REASSIGN_RULE, grounds: GROUNDS }),
        filename: unledgeredHost,
        errors: [
          {
            messageId: "unrecordedSuppression",
            data: { ruleName: REASSIGN_RULE, path: HOST_PATH },
          },
        ],
      },
      {
        name: "a directive naming this rule with no row of its own is reported like every other",
        code: nextLine({ rule: SELF_RULE, grounds: GROUNDS }),
        filename: recordedHost,
        errors: [
          { messageId: "unrecordedSuppression", data: { ruleName: SELF_RULE, path: HOST_PATH } },
        ],
      },
      {
        name: "a row that leaves its grounds empty records nothing",
        code: nextLine({ rule: REASSIGN_RULE, grounds: GROUNDS }),
        filename: groundlessRowHost,
        errors: [
          {
            messageId: "incompleteApproval",
            data: { gap: "grounds", ruleName: REASSIGN_RULE, path: HOST_PATH },
          },
        ],
      },
      {
        name: "a row that leaves its approver empty records nobody",
        code: nextLine({ rule: REASSIGN_RULE, grounds: GROUNDS }),
        filename: unapprovedRowHost,
        errors: [
          {
            messageId: "incompleteApproval",
            data: { gap: "approver", ruleName: REASSIGN_RULE, path: HOST_PATH },
          },
        ],
      },
      {
        name: "each rule a directive names is matched against the ledger on its own",
        code: nextLine({ rule: `${REASSIGN_RULE}, no-console`, grounds: GROUNDS }),
        filename: recordedHost,
        errors: [
          { messageId: "unrecordedSuppression", data: { ruleName: "no-console", path: HOST_PATH } },
        ],
      },
      {
        name: "each directive in a file is reported on its own",
        code: `// oxlint-disable-next-line ${REASSIGN_RULE}\n${STATEMENT}\n// oxlint-disable-next-line ${REASSIGN_RULE}\n${STATEMENT}`,
        filename: recordedHost,
        errors: [{ messageId: "groundlessSuppression" }, { messageId: "groundlessSuppression" }],
      },
      {
        name: "a row whose file no longer holds the directive is reported at the lint configuration",
        code: CONFIG_SOURCE,
        filename: join(staleRoot, "vite.config.ts"),
        errors: [
          { messageId: "staleApproval", data: { path: HOST_PATH, ruleName: REASSIGN_RULE } },
        ],
      },
      {
        name: "a row naming a path this repository does not hold is reported at the lint configuration",
        code: CONFIG_SOURCE,
        filename: join(abandonedRoot, "vite.config.ts"),
        errors: [{ messageId: "abandonedApproval", data: { path: HOST_PATH } }],
      },
    ],
  });
});
