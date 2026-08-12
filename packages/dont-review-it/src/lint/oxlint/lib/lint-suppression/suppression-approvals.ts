import { join } from "node:path";

import { isPlainObject, memoize } from "es-toolkit";

import { readJsonFile } from "../canonical-values/read-json-file.ts";
import { bareRuleNameOf, namesRule, suppressionDirectiveOf } from "./suppression-directives.ts";

export const APPROVAL_LEDGER_FILE_NAME = "approved-lint-suppressions.json";

export type SuppressionApproval = {
  readonly path: string;
  readonly rule: string;
  readonly grounds: string;
  readonly approver: string;
};

const spelledTextOf = (held: unknown): string => (typeof held === "string" ? held.trim() : "");

const approvalOf = (declared: unknown): readonly SuppressionApproval[] => {
  if (!isPlainObject(declared)) return [];
  const path = spelledTextOf(declared.path);
  const rule = spelledTextOf(declared.rule);
  if (path === "" || rule === "") return [];

  return [
    {
      path,
      rule,
      grounds: spelledTextOf(declared.grounds),
      approver: spelledTextOf(declared.approver),
    },
  ];
};

const approvalsIn = (held: unknown): readonly SuppressionApproval[] =>
  Array.isArray(held) ? held.flatMap(approvalOf) : [];

export const approvalLedgerIn = memoize((repositoryRoot: string): readonly SuppressionApproval[] =>
  approvalsIn(readJsonFile(join(repositoryRoot, APPROVAL_LEDGER_FILE_NAME))),
);

export const approvalFor = ({
  ledger,
  path,
  ruleName,
}: {
  readonly ledger: readonly SuppressionApproval[];
  readonly path: string;
  readonly ruleName: string;
}): SuppressionApproval | null =>
  ledger.find(
    (approval) =>
      approval.path === path && bareRuleNameOf(approval.rule) === bareRuleNameOf(ruleName),
  ) ?? null;

export const gapIn = (approval: SuppressionApproval): string | null => {
  if (approval.grounds === "") return "grounds";
  return approval.approver === "" ? "approver" : null;
};

const COMMENTS = /\/\/[^\n]*|\/\*[\s\S]*?\*\//gu;

const bodyOf = (comment: string): string =>
  comment.startsWith("//") ? comment.slice(2) : comment.slice(2, -2);

export const holdsDirectiveNaming = ({
  text,
  ruleName,
}: {
  readonly text: string;
  readonly ruleName: string;
}): boolean =>
  [...text.matchAll(COMMENTS)].some((match) => {
    const directive = suppressionDirectiveOf({ value: bodyOf(match[0]) });
    return directive !== null && namesRule({ directive, ruleName });
  });
