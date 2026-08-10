import {
  workspaceLintRuleDocsRelativePath,
  workspaceLintRuleDocsUrl,
  type WorkspaceLintRuleIdentity,
} from "./workspace-lint-rule-docs-path.ts";

import type { CreateRule, RuleMeta } from "@oxlint/plugins";

export type WorkspaceLintRuleDocs = {
  readonly description: string;
  readonly relatedGuidelines: readonly string[];
  readonly url?: string;
};

export type WorkspaceLintRule = {
  readonly name: string;
  readonly meta: {
    readonly type: RuleMeta["type"];
    readonly docs: WorkspaceLintRuleDocs;
    readonly messages: Record<string, string>;
    readonly schema: RuleMeta["schema"];
    readonly fixable?: RuleMeta["fixable"];
    readonly hasSuggestions?: RuleMeta["hasSuggestions"];
  };
  readonly create: CreateRule["create"];
};

const appendDocPointer = (body: string, identity: WorkspaceLintRuleIdentity): string =>
  `${body.trimEnd()} See ${workspaceLintRuleDocsRelativePath(identity)}.`;

const withDocPointers = (
  messages: Record<string, string>,
  identity: WorkspaceLintRuleIdentity,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(messages).map(([messageId, body]) => [
      messageId,
      appendDocPointer(body, identity),
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
    };
  };
};
