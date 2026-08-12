import { measureVisitor } from "./measure-rule-duration.ts";
import {
  workspaceLintRuleDocsRelativePath,
  workspaceLintRuleDocsUrl,
  type WorkspaceLintRuleIdentity,
} from "./workspace-lint-rule-docs-path.ts";

import type { CreateRule, RuleMeta } from "@oxlint/plugins";

export type WorkspaceLintRule = {
  readonly name: string;
  readonly meta: {
    readonly type: RuleMeta["type"];
    readonly docs: {
      readonly description: string;
      readonly relatedGuidelines: readonly string[];
      readonly url?: string;
    };
    readonly messages: Record<string, string>;
    readonly schema: RuleMeta["schema"];
    readonly fixable?: RuleMeta["fixable"];
    readonly hasSuggestions?: RuleMeta["hasSuggestions"];
  };
  readonly create: CreateRule["create"];
};

const appendDocPointer = (writtenBody: string, identity: WorkspaceLintRuleIdentity): string =>
  `${writtenBody.trimEnd()} See ${workspaceLintRuleDocsRelativePath(identity)}.`;

const withDocPointers = (
  complaints: Record<string, string>,
  identity: WorkspaceLintRuleIdentity,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(complaints).map(([messageId, writtenBody]) => [
      messageId,
      appendDocPointer(writtenBody, identity),
    ]),
  );

export const createWorkspaceLintRule = ({ workspaceDir }: { readonly workspaceDir: string }) => {
  return <DefinedRule extends WorkspaceLintRule>(rule: DefinedRule): DefinedRule => {
    const identity = { workspaceDir, ruleName: rule.name };
    return {
      ...rule,
      meta: {
        ...rule.meta,
        docs: { ...rule.meta.docs, url: workspaceLintRuleDocsUrl(identity) },
        messages: withDocPointers(rule.meta.messages, identity),
      },
      create: (inspection) =>
        measureVisitor({ ruleName: rule.name, visitor: rule.create(inspection) }),
    };
  };
};
