import { createDontReviewItRule } from "../../../create-rule.ts";
import { spellingsFrom } from "../lib/configured-spellings.ts";
import {
  DEFAULT_MOCK_NAMESPACE_SPELLINGS,
  DEFAULT_MODULE_REPLACEMENT_MEMBERS,
  MODULE_REPLACEMENT_MEMBERS_OPTION,
  replacedModuleSpecifier,
  type NamespaceLookup,
} from "../lib/spec-syntax/mock-namespace.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";

import type { WorkspaceLintRule } from "@mst/lint-rule-authoring";
import type { ESTree, Scope } from "@oxlint/plugins";
import type { ExternalIoVocabulary, ReplacedModule } from "../lib/external-io-boundary.ts";

const EXTERNAL_IO_MODULES_OPTION = "externalIoModules";

const EXTERNAL_IO_PACKAGES_OPTION = "externalIoPackages";

const DEFAULT_EXTERNAL_IO_MODULES: readonly string[] = [
  "child_process",
  "cluster",
  "crypto",
  "dgram",
  "dns",
  "dns/promises",
  "fs",
  "fs/promises",
  "http",
  "http2",
  "https",
  "inspector",
  "net",
  "node:child_process",
  "node:cluster",
  "node:crypto",
  "node:dgram",
  "node:dns",
  "node:dns/promises",
  "node:fs",
  "node:fs/promises",
  "node:http",
  "node:http2",
  "node:https",
  "node:inspector",
  "node:net",
  "node:os",
  "node:perf_hooks",
  "node:process",
  "node:readline",
  "node:readline/promises",
  "node:timers",
  "node:timers/promises",
  "node:tls",
  "node:worker_threads",
  "os",
  "perf_hooks",
  "process",
  "readline",
  "readline/promises",
  "timers",
  "timers/promises",
  "tls",
  "worker_threads",
];

export const createNoNonBoundaryDouble = (reading: {
  readonly readBoundary: (input: {
    readonly specifier: string;
    readonly fromFile: string;
    readonly vocabulary: ExternalIoVocabulary;
  }) => ReplacedModule;
}): WorkspaceLintRule =>
  createDontReviewItRule({
    name: "no-non-boundary-double--replace-at-the-external-boundary",
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow replacing a module that does not own an external I/O boundary itself, so a spec cannot take the code it is supposed to be checking out of the run and call what is left a verification",
        relatedGuidelines: [],
      },
      messages: {
        determinedModuleDouble:
          "A module replacement must not take a module whose output is determined by its input. Nothing `{{specifier}}` reaches leaves this process, so what it returns is decided by what it is handed, and this declaration takes that decision out of the run. Delete the declaration and let the real module answer what the test hands it.",
        insideBoundaryDouble:
          "A module replacement must not stand in front of the module that owns the boundary. `{{specifier}}` reaches the outside only through `{{boundary}}`, so replacing it here takes everything between the two out of the run along with the I/O. Move the declaration to `{{boundary}}`, which is the module this repository owns the boundary in, and let the modules in between run.",
      },
      schema: [
        {
          type: "object",
          properties: {
            moduleReplacementMembers: { type: "array", items: { type: "string" } },
            externalIoModules: { type: "array", items: { type: "string" } },
            externalIoPackages: { type: "array", items: { type: "string" } },
            specFileSuffixes: { type: "array", items: { type: "string" } },
          },
          additionalProperties: false,
        },
      ],
    },
    create(inspection) {
      if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

      const lookup: NamespaceLookup = {
        scopeAt: (node: ESTree.Node): Scope => inspection.sourceCode.getScope(node),
        spellings: new Set(DEFAULT_MOCK_NAMESPACE_SPELLINGS),
        seenBindings: new Set(),
      };
      const members = spellingsFrom(inspection.options, {
        option: MODULE_REPLACEMENT_MEMBERS_OPTION,
        fallback: DEFAULT_MODULE_REPLACEMENT_MEMBERS,
      });
      const vocabulary = {
        modules: spellingsFrom(inspection.options, {
          option: EXTERNAL_IO_MODULES_OPTION,
          fallback: DEFAULT_EXTERNAL_IO_MODULES,
        }),
        packages: spellingsFrom(inspection.options, {
          option: EXTERNAL_IO_PACKAGES_OPTION,
          fallback: [],
        }),
      };

      return {
        CallExpression(node: ESTree.CallExpression) {
          const specifier = replacedModuleSpecifier(node, { lookup, members });
          if (specifier === null) return;

          const replaced = reading.readBoundary({
            specifier,
            fromFile: inspection.filename,
            vocabulary,
          });
          if (replaced.kind === "determinedByItsInput") {
            inspection.report({ node, messageId: "determinedModuleDouble", data: { specifier } });
            return;
          }
          if (replaced.kind !== "behindOwnModules") return;
          inspection.report({
            node,
            messageId: "insideBoundaryDouble",
            data: { specifier, boundary: replaced.boundary },
          });
        },
      };
    },
  });
