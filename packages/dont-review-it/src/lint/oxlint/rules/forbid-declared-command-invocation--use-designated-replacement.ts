import { resolve, sep } from "node:path";

import { memoize, uniq } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import {
  carriesUndecidedTarget,
  invokedNamesIn,
  namesRunner,
} from "../lib/declared-replacements/command-lines.ts";
import {
  deadWithdrawals,
  declaredReplacementsIn,
  DECLARED_OPTION,
  DECLARED_REPLACEMENT_SCHEMA,
  DEFAULT_DECLARED_REPLACEMENTS,
  groundlessWithdrawals,
  replacementNamed,
  replacementsInForce,
  REPLACEMENT_WITHDRAWAL_SCHEMA,
  withdrawalsIn,
  WITHDRAWN_OPTION,
  type DeclaredReplacement,
  type ReplacementWithdrawal,
} from "../lib/declared-replacements/declared-entries.ts";
import {
  handedTextsOf,
  spawnRoutesIn,
  spawnSiteAt,
  type SpawnSite,
} from "../lib/declared-replacements/invocation-sites.ts";
import {
  DEFAULT_SPAWN_FORMS,
  spawnFormsIn,
  SPAWN_FORM_SCHEMA,
  SPAWN_FORMS_OPTION,
  SPAWN_TARGET_NAME,
  type SpawnForm,
} from "../lib/declared-replacements/spawn-forms.ts";
import { segmentsOf } from "../lib/path-segments.ts";
import { constantSpecifiersIn, staticSpecifierOf } from "../lib/setup-modules/coupling-edges.ts";
import {
  carriesGrounds,
  exceptionsCovering,
  specifierExceptionsIn,
  SPECIFIER_EXCEPTION_SCHEMA,
  type SpecifierException,
} from "../lib/specifier-exceptions.ts";

import type { Context, ESTree } from "@oxlint/plugins";

const reportRegistrations = ({
  inspection,
  node,
  declared,
  withdrawals,
  groundless,
}: {
  readonly inspection: Context;
  readonly node: ESTree.Program;
  readonly declared: readonly DeclaredReplacement[];
  readonly withdrawals: readonly ReplacementWithdrawal[];
  readonly groundless: readonly SpecifierException[];
}): void => {
  for (const withdrawal of groundlessWithdrawals(withdrawals)) {
    inspection.report({ node, messageId: "groundlessWithdrawal", data: { name: withdrawal.name } });
  }
  for (const withdrawal of deadWithdrawals({ declared, withdrawals })) {
    inspection.report({ node, messageId: "deadWithdrawal", data: { name: withdrawal.name } });
  }
  for (const exception of groundless) {
    inspection.report({
      node,
      messageId: "groundlessInvocationException",
      data: { path: exception.path },
    });
  }
};

const reportUndecided = ({
  inspection,
  node,
}: {
  readonly inspection: Context;
  readonly node: ESTree.Node;
}): void => {
  inspection.report({
    node,
    messageId: "undecidedCommandTarget",
    data: { written: inspection.sourceCode.getText(node) },
  });
};

const reportRetired = ({
  inspection,
  node,
  line,
  entries,
}: {
  readonly inspection: Context;
  readonly node: ESTree.Node;
  readonly line: string;
  readonly entries: readonly DeclaredReplacement[];
}): void => {
  for (const spelled of uniq(invokedNamesIn(line))) {
    const listed = replacementNamed({ entries, name: spelled });
    if (listed === null) continue;
    inspection.report({
      node,
      messageId: "declaredCommandInvocation",
      data: { name: spelled, substitute: listed.substitute },
    });
  }
};

const commandLineOf = ({
  site,
  target,
  constants,
}: {
  readonly site: SpawnSite;
  readonly target: string;
  readonly constants: ReadonlyMap<string, string>;
}): string | null => {
  if (site.form.carries !== SPAWN_TARGET_NAME || !namesRunner(target)) return target;

  const heldElements = handedTextsOf({ handed: site.handed, constants });
  return heldElements === null ? null : [target, ...heldElements].join(" ");
};

type Reading = {
  readonly routes: ReturnType<typeof spawnRoutesIn>;
  readonly constants: ReadonlyMap<string, string>;
};

type SpawnCall = ESTree.CallExpression | ESTree.TaggedTemplateExpression;

const targetNodeOf = (node: SpawnCall, form: SpawnForm): ESTree.Node =>
  node.type === "TaggedTemplateExpression"
    ? node.quasi
    : (node.arguments.at(form.position) ?? node);

const reportSite = ({
  inspection,
  node,
  site,
  entries,
  reading,
}: {
  readonly inspection: Context;
  readonly node: SpawnCall;
  readonly site: SpawnSite;
  readonly entries: readonly DeclaredReplacement[];
  readonly reading: Reading;
}): void => {
  const checked = site.target === null ? null : staticSpecifierOf(site.target, reading.constants);
  const reported = targetNodeOf(node, site.form);
  const line =
    checked === null
      ? null
      : commandLineOf({ site, target: checked, constants: reading.constants });

  if (line === null) {
    reportUndecided({ inspection, node: checked === null ? reported : node });
    return;
  }
  if (carriesUndecidedTarget(line)) {
    inspection.report({ node: reported, messageId: "unreadableCommandLine", data: { line } });
    return;
  }
  reportRetired({ inspection, node: reported, line, entries });
};

const declarationIn = (
  ruleOptions: Context["options"],
): {
  readonly declared: readonly DeclaredReplacement[];
  readonly withdrawals: readonly ReplacementWithdrawal[];
  readonly entries: readonly DeclaredReplacement[];
} => {
  const withdrawals = withdrawalsIn(ruleOptions);
  const declared = declaredReplacementsIn({
    options: ruleOptions,
    standing: DEFAULT_DECLARED_REPLACEMENTS,
  });
  return { declared, withdrawals, entries: replacementsInForce({ declared, withdrawals }) };
};

const registeredPositionsIn = (
  inspection: Context,
): {
  readonly covering: readonly SpecifierException[];
  readonly groundless: readonly SpecifierException[];
} => {
  const covering = exceptionsCovering({
    exceptions: specifierExceptionsIn(inspection.options),
    pathSegments: segmentsOf({
      path: resolve(inspection.cwd, inspection.filename),
      separator: sep,
    }),
    cwd: inspection.cwd,
  });
  return { covering, groundless: covering.filter((exception) => !carriesGrounds(exception)) };
};

export const forbidDeclaredCommandInvocation = createDontReviewItRule({
  name: "forbid-declared-command-invocation--use-designated-replacement",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow starting a command the shared declaration has retired as a child process, so the declaration that closes the import route and the manifest route closes the process route with the same entry",
      relatedGuidelines: [],
    },
    messages: {
      declaredCommandInvocation:
        "A command the declaration has retired must not be started as a child process. The declaration covers starting it, not only importing it. Replace `{{name}}` with what the declaration names in its place: {{substitute}}",
      undecidedCommandTarget:
        "A child process must not be started through a target the source leaves undecided. `{{written}}` is settled while the program runs, and nothing matches it against the commands the declaration has retired. Write one name the source spells out at the target position.",
      unreadableCommandLine:
        "A command line handed to a shell must not settle what it starts while it runs. `{{line}}` reaches text nobody can read here, and nothing matches it against the commands the declaration has retired. Write the command out by name and hand it its arguments.",
      groundlessWithdrawal:
        "A withdrawal must not lift a declared command without grounds. `{{name}}` is withdrawn with none. Write what makes this repository need that command, or drop the withdrawal.",
      deadWithdrawal:
        "A withdrawal must not name a command no declaration carries. `{{name}}` is withdrawn and declared nowhere. Delete the withdrawal.",
      groundlessInvocationException:
        "A registered position must not stand without the grounds it stays. `{{path}}` is registered with none. Write what starts a retired command at that position, or drop the entry.",
    },
    schema: [
      {
        type: "object",
        properties: {
          [DECLARED_OPTION]: DECLARED_REPLACEMENT_SCHEMA,
          [WITHDRAWN_OPTION]: REPLACEMENT_WITHDRAWAL_SCHEMA,
          [SPAWN_FORMS_OPTION]: SPAWN_FORM_SCHEMA,
          exceptions: SPECIFIER_EXCEPTION_SCHEMA,
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    const declaration = declarationIn(inspection.options);
    const positions = registeredPositionsIn(inspection);
    const registrations = (node: ESTree.Program): void => {
      reportRegistrations({
        inspection,
        node,
        declared: declaration.declared,
        withdrawals: declaration.withdrawals,
        groundless: positions.groundless,
      });
    };

    if (
      declaration.entries.length === 0 ||
      positions.groundless.length < positions.covering.length
    ) {
      return { Program: registrations };
    }

    const forms = spawnFormsIn({ options: inspection.options, standing: DEFAULT_SPAWN_FORMS });
    const readingOf = memoize(
      (): Reading => ({
        routes: spawnRoutesIn({
          body: inspection.sourceCode.ast.body,
          filename: inspection.filename,
        }),
        constants: constantSpecifiersIn(inspection.sourceCode.ast.body),
      }),
    );

    const reportInvocation = (node: SpawnCall): void => {
      const reading = readingOf();
      const site = spawnSiteAt({ node, routes: reading.routes, forms });
      if (site !== null) {
        reportSite({ inspection, node, site, entries: declaration.entries, reading });
      }
    };

    return {
      Program: registrations,
      CallExpression: reportInvocation,
      TaggedTemplateExpression: reportInvocation,
    };
  },
});
