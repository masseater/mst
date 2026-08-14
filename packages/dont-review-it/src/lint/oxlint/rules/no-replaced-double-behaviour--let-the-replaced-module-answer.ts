import { createDontReviewItRule } from "../../../create-rule.ts";
import { exemptionsWrittenAbove } from "../lib/directive-comments.ts";
import { resolveBinding } from "../lib/resolved-bindings.ts";
import {
  DEFAULT_MOCK_NAMESPACE_SPELLINGS,
  MOCK_BEHAVIOUR_SETTERS,
  spellsImportedBinding,
  spellsMockNamespace,
  type NamespaceLookup,
} from "../lib/spec-syntax/mock-namespace.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";
import { staticMemberName } from "../lib/spec-syntax/static-names.ts";
import { unwrapSubject } from "../lib/spec-syntax/subject-expressions.ts";

import type { ESTree, Scope, Variable } from "@oxlint/plugins";

const RULE_NAME = "no-replaced-double-behaviour--let-the-replaced-module-answer";

const boundExpressionOf = (definition: {
  readonly node: ESTree.Node;
}): ESTree.Expression | null => {
  const declared = definition.node;
  return declared.type === "VariableDeclarator" ? declared.init : null;
};

const MOCK_VIEW_MEMBER = "mocked";

type Reach = {
  readonly lookup: NamespaceLookup;
  readonly followed: readonly Variable[];
};

const viewedDoubleOf = (call: ESTree.CallExpression, reach: Reach): ESTree.Expression | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return null;
  if (staticMemberName(callee) !== MOCK_VIEW_MEMBER) return null;
  if (callee.object.type === "Super" || !spellsMockNamespace(callee.object, reach.lookup)) {
    return null;
  }

  const [viewed] = call.arguments;
  return viewed === undefined || viewed.type === "SpreadElement" ? null : viewed;
};

const reachesThroughBinding = (written: ESTree.IdentifierReference, reach: Reach): boolean => {
  const binding = resolveBinding(reach.lookup.scopeAt(written), written.name);
  if (binding === null || reach.followed.includes(binding)) return false;

  const traced = { ...reach, followed: [...reach.followed, binding] };
  return binding.defs.some((definition) => {
    const bound = boundExpressionOf(definition);
    return bound !== null && reachesReplacedModule(bound, traced);
  });
};

const reachesReplacedModule = (node: ESTree.Expression, reach: Reach): boolean => {
  const written = unwrapSubject(node);
  if (written.type === "MemberExpression") {
    return written.object.type !== "Super" && reachesReplacedModule(written.object, reach);
  }
  if (written.type === "CallExpression") {
    const viewed = viewedDoubleOf(written, reach);
    return viewed !== null && reachesReplacedModule(viewed, reach);
  }
  if (written.type !== "Identifier") return false;
  return (
    spellsImportedBinding(written, reach.lookup.scopeAt) || reachesThroughBinding(written, reach)
  );
};

export const noReplacedDoubleBehaviour = createDontReviewItRule({
  name: RULE_NAME,
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow settling what a double taken from a replaced module hands back, so a replacement records how the code under test called out and never answers in place of the module it stands for",
      relatedGuidelines: [],
    },
    messages: {
      replacedDoubleBehaviour:
        "A double taken from a replaced module must not be told what to hand back. `{{member}}` settles the answer the replaced module was going to give, so the spec reads back the value it wrote itself and the module it replaced never runs. Delete this call and leave the replacement a pass-through that only records how it was called.",
      unreasonedExemption:
        "An exemption comment must not stand without grounds. Write the grounds for this exemption after `--`, and name there what this spec cannot reach without settling the answer.",
    },
    schema: [
      {
        type: "object",
        properties: {
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

    const reach: Reach = {
      lookup: {
        scopeAt: (node: ESTree.Node): Scope => inspection.sourceCode.getScope(node),
        spellings: new Set(DEFAULT_MOCK_NAMESPACE_SPELLINGS),
        seenBindings: new Set(),
      },
      followed: [],
    };

    const grantsExemption = (call: ESTree.CallExpression): boolean => {
      const written = exemptionsWrittenAbove({
        comments: inspection.sourceCode.ast.comments,
        line: call.loc.start.line,
        ruleName: RULE_NAME,
      });

      for (const exemption of written.filter((carried) => carried.grounds === "")) {
        inspection.report({ loc: exemption.comment.loc, messageId: "unreasonedExemption" });
      }
      return written.some((exemption) => exemption.grounds !== "");
    };

    return {
      CallExpression(node: ESTree.CallExpression) {
        const callee = unwrapSubject(node.callee);
        if (callee.type !== "MemberExpression" || callee.object.type === "Super") return;

        const member = staticMemberName(callee);
        if (member === null || !MOCK_BEHAVIOUR_SETTERS.has(member)) return;
        if (!reachesReplacedModule(callee.object, reach)) return;
        if (grantsExemption(node)) return;
        inspection.report({ node, messageId: "replacedDoubleBehaviour", data: { member } });
      },
    };
  },
});
