import { dirname, resolve } from "node:path";

import { memoize } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { passThroughExportsIn } from "../lib/restricted-targets/pass-through-exports.ts";
import { reachRouteOf } from "../lib/restricted-targets/reach-routes.ts";
import {
  restrictedTargetReachedBy,
  type ReachPolicy,
} from "../lib/restricted-targets/relayed-reach.ts";
import {
  entriesInForceAt,
  internalAliasesFrom,
  matchingRestrictedTarget,
  RESTRICTED_TARGET_SCHEMA,
  restrictedTargetsFrom,
} from "../lib/restricted-targets/restricted-entries.ts";
import { constantSpecifiersIn } from "../lib/setup-modules/coupling-edges.ts";

import type { ESTree } from "@oxlint/plugins";

const RELAY_CHAIN_SEPARATOR = " -> ";

export const forbidRestrictedTargetRelay = createDontReviewItRule({
  name: "forbid-restricted-target-relay--delete-the-relay",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a local module passing a restricted target straight to its own public surface and disallow reading a restricted target through such a module, so a target held out of reach in one file stays out of reach behind a chain of local modules",
      relatedGuidelines: [],
    },
    messages: {
      restrictedTargetForward:
        "A local module must not pass a restricted target straight to its own public surface. This module exposes `{{target}}` as `{{exposed}}`. Delete this forward, or rebuild this module as a boundary that publishes its own vocabulary. {{substitute}} Register an exception as an entry in the lint configuration.",
      relayedTargetForward:
        "A local module must not pass a restricted target straight to its own public surface. This module exposes `{{target}}` as `{{exposed}}` through `{{relays}}`. Delete this forward, or rebuild this module as a boundary that publishes its own vocabulary. {{substitute}} Register an exception as an entry in the lint configuration.",
      relayedTargetReach:
        "A module must not read a restricted target through a local module that forwards it. `{{specifier}}` reaches `{{target}}` through `{{relays}}`. Delete the forwarding module, or rebuild it as a boundary that publishes its own vocabulary. {{substitute}} Register an exception as an entry in the lint configuration.",
    },
    schema: RESTRICTED_TARGET_SCHEMA,
  },
  create(inspection) {
    const listedEntries = restrictedTargetsFrom(inspection.options);
    if (listedEntries.length === 0) return {};

    const fromFile = resolve(inspection.cwd, inspection.filename);
    const aliases = internalAliasesFrom(inspection.options);

    const readingPolicyOf = memoize(
      (): ReachPolicy => ({
        workspaceRoot: findWorkspaceRoot(dirname(fromFile)),
        entries: entriesInForceAt({ entries: listedEntries, file: fromFile, cwd: inspection.cwd }),
        aliases,
      }),
    );

    const forwardingPolicyOf = memoize(
      (): ReachPolicy => ({ ...readingPolicyOf(), entries: listedEntries }),
    );

    const constantsOf = memoize(
      (): ReadonlyMap<string, string> => constantSpecifiersIn(inspection.sourceCode.ast.body),
    );

    const reportForward = (forwarded: {
      readonly statement: ESTree.Statement;
      readonly specifier: string;
      readonly exported: string | null;
      readonly exposed: string;
    }): void => {
      const named = matchingRestrictedTarget({ entries: listedEntries, forwarded });
      if (named !== null) {
        inspection.report({
          node: forwarded.statement,
          messageId: "restrictedTargetForward",
          data: {
            target: forwarded.specifier,
            exposed: forwarded.exposed,
            substitute: named.substitute,
          },
        });
        return;
      }

      const reached = restrictedTargetReachedBy({
        specifier: forwarded.specifier,
        fromFile,
        policy: forwardingPolicyOf(),
      });
      if (reached === null) return;
      inspection.report({
        node: forwarded.statement,
        messageId: "relayedTargetForward",
        data: {
          target: reached.target,
          exposed: forwarded.exposed,
          relays: reached.relays.join(RELAY_CHAIN_SEPARATOR),
          substitute: reached.entry.substitute,
        },
      });
    };

    const reportReach = (node: ESTree.Node): void => {
      const specifier = reachRouteOf(node, constantsOf());
      if (specifier === null) return;

      const reached = restrictedTargetReachedBy({
        specifier,
        fromFile,
        policy: readingPolicyOf(),
      });
      if (reached === null) return;
      inspection.report({
        node,
        messageId: "relayedTargetReach",
        data: {
          specifier,
          target: reached.target,
          relays: reached.relays.join(RELAY_CHAIN_SEPARATOR),
          substitute: reached.entry.substitute,
        },
      });
    };

    return {
      Program(node: ESTree.Program) {
        for (const forwarded of passThroughExportsIn(node.body)) reportForward(forwarded);
      },
      ImportDeclaration: reportReach,
      ImportExpression: reportReach,
      CallExpression: reportReach,
      TSImportEqualsDeclaration: reportReach,
      TSImportType: reportReach,
    };
  },
});
