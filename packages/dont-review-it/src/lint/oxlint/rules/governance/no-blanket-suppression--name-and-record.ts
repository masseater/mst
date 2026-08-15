import { dirname, join, relative, resolve } from "node:path";

import { createDontReviewItRule } from "../../../../create-rule.ts";
import { readTextFile } from "../../lib/canonical-values/source-files.ts";
import { findWorkspaceRoot } from "../../lib/canonical-values/workspace-root.ts";
import { LINT_CONFIGURATION_FILE } from "../../lib/lint-suppression/lint-config-suppression.ts";
import {
  APPROVAL_LEDGER_FILE_NAME,
  approvalFor,
  approvalLedgerIn,
  gapIn,
  holdsDirectiveNaming,
  type SuppressionApproval,
} from "../../lib/lint-suppression/suppression-approvals.ts";
import {
  suppressionDirectiveOf,
  type SuppressionDirective,
} from "../../lib/lint-suppression/suppression-directives.ts";
import { toPosixPath } from "../../lib/posix-path.ts";

import type { Comment, ESTree } from "@oxlint/plugins";
import type { RuleMessage } from "../../lib/rule-message.ts";

const STATEMENT_SCOPED_SPELLINGS: ReadonlySet<string> = new Set([
  "oxlint-disable-next-line",
  "eslint-disable-next-line",
]);

const unmetConditionFor = (directive: SuppressionDirective): RuleMessage | null => {
  const spelling = { spelling: directive.spelling };
  if (directive.ruleNames.length === 0) return { messageId: "unnamedSuppression", data: spelling };
  if (!STATEMENT_SCOPED_SPELLINGS.has(directive.spelling)) {
    return { messageId: "wideSuppression", data: spelling };
  }
  if (directive.carriesGrounds) return null;
  return {
    messageId: "groundlessSuppression",
    data: { ruleNames: directive.ruleNames.join("`, `") },
  };
};

const ACCEPTED_FORM = `A suppression is accepted on four conditions held together: it names the rule it stops, it is spelled \`oxlint-disable-next-line\` on its own line above the one statement it covers, it carries its grounds after \`--\`, and \`${APPROVAL_LEDGER_FILE_NAME}\` at the repository root holds a row naming that path, that rule, those grounds and whoever approved them. Three of the four leave the suppression reported.`;

const BEFORE_SUPPRESSING =
  "Rewrite the code the rule reports before writing any suppression, and when the report is wrong, correct the condition that produced it instead of covering it.";

const NOT_AN_APPROVAL =
  "A row records whose name the decision was made under. It does not make the decision right.";

export const noBlanketSuppression = createDontReviewItRule({
  name: "no-blanket-suppression--name-and-record",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow any lint suppression that fails to name its rule, to stop at the one statement below it, to carry its grounds, or to stand against a row in the repository ledger, so what a run has stopped saying and whose name it was stopped under can be read off the source alone",
      relatedGuidelines: [],
    },
    messages: {
      unnamedSuppression: `A \`{{spelling}}\` comment must not stand without naming the rule it stops. Delete it and rewrite the code the linter reports. ${ACCEPTED_FORM} ${BEFORE_SUPPRESSING}`,
      wideSuppression: `A \`{{spelling}}\` comment must not take a scope other than the one statement below it. Delete it and rewrite the code the linter reports. ${ACCEPTED_FORM} ${BEFORE_SUPPRESSING}`,
      groundlessSuppression: `A suppression of \`{{ruleNames}}\` must not stand without grounds. Delete it and rewrite the code that rule reports, or write after \`--\` what makes this statement the exception. ${ACCEPTED_FORM} ${BEFORE_SUPPRESSING}`,
      unrecordedSuppression: `A suppression of \`{{ruleName}}\` must not stand without a row in \`${APPROVAL_LEDGER_FILE_NAME}\`. Delete it and rewrite the code that rule reports, or add a row naming \`{{path}}\`, that rule, the grounds and whoever approved them. ${NOT_AN_APPROVAL} ${BEFORE_SUPPRESSING}`,
      incompleteApproval: `A row of \`${APPROVAL_LEDGER_FILE_NAME}\` must not leave \`{{gap}}\` empty. Write it into the row naming \`{{path}}\` and \`{{ruleName}}\`, or delete that row together with the suppression standing on it. ${NOT_AN_APPROVAL}`,
      staleApproval: `A row of \`${APPROVAL_LEDGER_FILE_NAME}\` must not stand for a suppression the source no longer holds. Delete the row naming \`{{path}}\` and \`{{ruleName}}\`.`,
      abandonedApproval: `A row of \`${APPROVAL_LEDGER_FILE_NAME}\` must not name a path this repository does not hold. Delete the row naming \`{{path}}\`, or point it at the file that took over the suppression it stands for.`,
    },
    schema: [],
  },
  create(inspection) {
    const absolutePath = resolve(inspection.cwd, inspection.filename);
    const repositoryRoot = findWorkspaceRoot(dirname(absolutePath));
    const relativePath = toPosixPath(relative(repositoryRoot, absolutePath));
    const ledger = approvalLedgerIn(repositoryRoot);

    const reportRecord = ({
      comment,
      ruleName,
    }: {
      readonly comment: Comment;
      readonly ruleName: string;
    }): void => {
      const approval = approvalFor({ ledger, path: relativePath, ruleName });
      if (approval === null) {
        inspection.report({
          loc: comment.loc,
          messageId: "unrecordedSuppression",
          data: { ruleName, path: relativePath },
        });
        return;
      }
      const gap = gapIn(approval);
      if (gap === null) return;
      inspection.report({
        loc: comment.loc,
        messageId: "incompleteApproval",
        data: { gap, ruleName, path: relativePath },
      });
    };

    const reportDirective = ({
      comment,
      directive,
    }: {
      readonly comment: Comment;
      readonly directive: SuppressionDirective;
    }): void => {
      const unmet = unmetConditionFor(directive);
      if (unmet !== null) {
        inspection.report({ loc: comment.loc, ...unmet });
        return;
      }
      for (const ruleName of directive.ruleNames) reportRecord({ comment, ruleName });
    };

    const reportApproval = ({
      program,
      approval,
    }: {
      readonly program: ESTree.Program;
      readonly approval: SuppressionApproval;
    }): void => {
      const held = readTextFile(join(repositoryRoot, approval.path));
      if (held === null) {
        inspection.report({
          node: program,
          messageId: "abandonedApproval",
          data: { path: approval.path },
        });
        return;
      }
      if (holdsDirectiveNaming({ text: held, ruleName: approval.rule })) return;
      inspection.report({
        node: program,
        messageId: "staleApproval",
        data: { path: approval.path, ruleName: approval.rule },
      });
    };

    return {
      Program(node: ESTree.Program) {
        for (const comment of node.comments) {
          const directive = suppressionDirectiveOf(comment);
          if (directive !== null) reportDirective({ comment, directive });
        }
        if (!LINT_CONFIGURATION_FILE.test(toPosixPath(inspection.filename))) return;
        for (const approval of ledger) reportApproval({ program: node, approval });
      },
    };
  },
});
