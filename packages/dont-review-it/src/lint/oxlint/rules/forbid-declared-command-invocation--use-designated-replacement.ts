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

type SpawnCall = ESTree.CallExpression | ESTree.TaggedTemplateExpression;

type Reading = {
  readonly routes: ReturnType<typeof spawnRoutesIn>;
  readonly constants: ReadonlyMap<string, string>;
};

const targetNodeOf = (node: SpawnCall, form: SpawnForm): ESTree.Node =>
  node.type === "TaggedTemplateExpression"
    ? node.quasi
    : (node.arguments.at(form.position) ?? node);

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

  const elements = handedTextsOf({ handed: site.handed, constants });
  return elements === null ? null : [target, ...elements].join(" ");
};

const reportRegistrations = ({
  context,
  node,
  declared,
  withdrawals,
  groundless,
}: {
  readonly context: Context;
  readonly node: ESTree.Program;
  readonly declared: readonly DeclaredReplacement[];
  readonly withdrawals: readonly ReplacementWithdrawal[];
  readonly groundless: readonly SpecifierException[];
}): void => {
  for (const withdrawal of groundlessWithdrawals(withdrawals)) {
    context.report({ node, messageId: "groundlessWithdrawal", data: { name: withdrawal.name } });
  }
  for (const withdrawal of deadWithdrawals({ declared, withdrawals })) {
    context.report({ node, messageId: "deadWithdrawal", data: { name: withdrawal.name } });
  }
  for (const exception of groundless) {
    context.report({
      node,
      messageId: "groundlessInvocationException",
      data: { path: exception.path },
    });
  }
};

const reportUndecided = ({
  context,
  node,
}: {
  readonly context: Context;
  readonly node: ESTree.Node;
}): void => {
  context.report({
    node,
    messageId: "undecidedCommandTarget",
    data: { written: context.sourceCode.getText(node) },
  });
};

const reportRetired = ({
  context,
  node,
  line,
  entries,
}: {
  readonly context: Context;
  readonly node: ESTree.Node;
  readonly line: string;
  readonly entries: readonly DeclaredReplacement[];
}): void => {
  for (const name of uniq(invokedNamesIn(line))) {
    const entry = replacementNamed({ entries, name });
    if (entry === null) continue;
    context.report({
      node,
      messageId: "declaredCommandInvocation",
      data: { name, substitute: entry.substitute },
    });
  }
};

const reportSite = ({
  context,
  node,
  site,
  entries,
  reading,
}: {
  readonly context: Context;
  readonly node: SpawnCall;
  readonly site: SpawnSite;
  readonly entries: readonly DeclaredReplacement[];
  readonly reading: Reading;
}): void => {
  const target = site.target === null ? null : staticSpecifierOf(site.target, reading.constants);
  const reported = targetNodeOf(node, site.form);
  const line =
    target === null ? null : commandLineOf({ site, target, constants: reading.constants });

  if (line === null) {
    reportUndecided({ context, node: target === null ? reported : node });
    return;
  }
  if (carriesUndecidedTarget(line)) {
    context.report({ node: reported, messageId: "unreadableCommandLine", data: { line } });
    return;
  }
  reportRetired({ context, node: reported, line, entries });
};

const declarationIn = (
  options: Context["options"],
): {
  readonly declared: readonly DeclaredReplacement[];
  readonly withdrawals: readonly ReplacementWithdrawal[];
  readonly entries: readonly DeclaredReplacement[];
} => {
  const withdrawals = withdrawalsIn(options);
  const declared = declaredReplacementsIn({ options, standing: DEFAULT_DECLARED_REPLACEMENTS });
  return { declared, withdrawals, entries: replacementsInForce({ declared, withdrawals }) };
};

const registeredPositionsIn = (
  context: Context,
): {
  readonly covering: readonly SpecifierException[];
  readonly groundless: readonly SpecifierException[];
} => {
  const covering = exceptionsCovering({
    exceptions: specifierExceptionsIn(context.options),
    pathSegments: segmentsOf({ path: resolve(context.cwd, context.filename), separator: sep }),
    cwd: context.cwd,
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
  create(context) {
    const declaration = declarationIn(context.options);
    const positions = registeredPositionsIn(context);
    const registrations = (node: ESTree.Program): void => {
      reportRegistrations({
        context,
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

    const forms = spawnFormsIn({ options: context.options, standing: DEFAULT_SPAWN_FORMS });
    const readingOf = memoize(
      (): Reading => ({
        routes: spawnRoutesIn({ body: context.sourceCode.ast.body, filename: context.filename }),
        constants: constantSpecifiersIn(context.sourceCode.ast.body),
      }),
    );

    const reportInvocation = (node: SpawnCall): void => {
      const reading = readingOf();
      const site = spawnSiteAt({ node, routes: reading.routes, forms });
      if (site !== null) {
        reportSite({ context, node, site, entries: declaration.entries, reading });
      }
    };

    return {
      Program: registrations,
      CallExpression: reportInvocation,
      TaggedTemplateExpression: reportInvocation,
    };
  },
});
