import { uniq, uniqBy } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { resolveBinding, type ScopeLookup } from "../lib/resolved-bindings.ts";
import {
  moduleDeclarationsOf,
  moduleExportSpelling,
  type ModuleDeclarations,
} from "../lib/spec-syntax/module-declarations.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";
import { staticMemberName } from "../lib/spec-syntax/static-names.ts";
import { unwrapSubject } from "../lib/spec-syntax/subject-expressions.ts";
import {
  INJECTED_TEST_HOOK_SPELLINGS,
  reachesTestHook,
} from "../lib/spec-syntax/test-hook-declarations.ts";

import type { ESTree, Options, Scope, Variable } from "@oxlint/plugins";

const HOOK_NAMES_OPTION = "hookNames";

type Report = {
  readonly node: ESTree.Node;
  readonly messageId: string;
  readonly data: { readonly hook: string } | { readonly through: string };
};

type HookReading = {
  readonly hookNames: ReadonlySet<string>;
  readonly scopeAt: ScopeLookup;
};

const hookNamesFrom = (options: Readonly<Options>): ReadonlySet<string> => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return new Set(INJECTED_TEST_HOOK_SPELLINGS);
  }

  const listed = first[HOOK_NAMES_OPTION];
  return Array.isArray(listed)
    ? new Set(listed.map(String))
    : new Set(INJECTED_TEST_HOOK_SPELLINGS);
};

const scopesUnder = (scope: Scope): readonly Scope[] => [
  scope,
  ...scope.childScopes.flatMap(scopesUnder),
];

const importsHook = (variable: Variable, hookNames: ReadonlySet<string>): boolean =>
  variable.defs.some((definition) => {
    const declared = definition.node;
    if (declared.type !== "ImportSpecifier") return false;
    return hookNames.has(moduleExportSpelling(declared.imported));
  });

const importsNamespace = (variable: Variable): boolean =>
  variable.defs.some((definition) => definition.node.type === "ImportNamespaceSpecifier");

const aliasedIdentifier = (variable: Variable): ESTree.IdentifierReference | null =>
  variable.defs
    .flatMap((definition) => {
      const declared = definition.node;
      if (declared.type !== "VariableDeclarator" || declared.init === null) return [];

      const written = unwrapSubject(declared.init);
      return written.type === "Identifier" ? [written] : [];
    })
    .at(-1) ?? null;

const boundVariableOf = (
  identifier: ESTree.IdentifierReference,
  scopeAt: ScopeLookup,
): Variable | null => resolveBinding(scopeAt(identifier), identifier.name);

const namesHook = (
  identifier: ESTree.IdentifierReference,
  reading: HookReading & { readonly reached: ReadonlySet<Variable> },
): boolean => {
  const bound = boundVariableOf(identifier, reading.scopeAt);
  return bound === null ? reading.hookNames.has(identifier.name) : reading.reached.has(bound);
};

const namesReachedVariable = (
  identifier: ESTree.IdentifierReference,
  reading: { readonly scopeAt: ScopeLookup; readonly reached: ReadonlySet<Variable> },
): boolean => {
  const bound = boundVariableOf(identifier, reading.scopeAt);
  return bound !== null && reading.reached.has(bound);
};

const aliasChainOf = (
  variables: readonly Variable[],
  reading: {
    readonly names: (identifier: ESTree.IdentifierReference) => boolean;
    readonly reached: Set<Variable>;
  },
): ReadonlySet<Variable> => {
  const gained = variables.filter((variable) => {
    if (reading.reached.has(variable)) return false;

    const aliased = aliasedIdentifier(variable);
    return aliased !== null && reading.names(aliased);
  });
  if (gained.length === 0) return reading.reached;

  for (const variable of gained) reading.reached.add(variable);
  return aliasChainOf(variables, reading);
};

const hookAliasesOf = (
  variables: readonly Variable[],
  reading: HookReading & { readonly reached: Set<Variable> },
): ReadonlySet<Variable> =>
  aliasChainOf(variables, {
    names: (identifier) => namesHook(identifier, reading),
    reached: reading.reached,
  });

const namespaceBindingsOf = (
  variables: readonly Variable[],
  scopeAt: ScopeLookup,
): ReadonlySet<Variable> => {
  const reached = new Set(variables.filter(importsNamespace));
  return aliasChainOf(variables, {
    names: (identifier) => namesReachedVariable(identifier, { scopeAt, reached }),
    reached,
  });
};

const namespaceHookOf = (
  member: ESTree.MemberExpression,
  reading: HookReading & { readonly namespaces: ReadonlySet<Variable> },
): string | null => {
  const named = staticMemberName(member);
  if (named === null || !reading.hookNames.has(named)) return null;

  const receiver = unwrapSubject(member.object);
  if (receiver.type !== "Identifier") return null;

  const bound = boundVariableOf(receiver, reading.scopeAt);
  return bound !== null && reading.namespaces.has(bound) ? named : null;
};

const spotsOf = (variable: Variable): readonly Variable["identifiers"][number][] =>
  uniqBy(
    [...variable.identifiers, ...variable.references.map((reference) => reference.identifier)],
    (identifier) => identifier.start,
  );

const injectedReports = (scope: Scope, hookNames: ReadonlySet<string>): readonly Report[] =>
  scope.through.flatMap((reference) => {
    const { identifier } = reference;
    if (!hookNames.has(identifier.name)) return [];
    return [{ node: identifier, messageId: "testHook", data: { hook: identifier.name } }];
  });

const boundReports = (reached: {
  readonly imported: ReadonlySet<Variable>;
  readonly aliased: ReadonlySet<Variable>;
}): readonly Report[] =>
  [...reached.aliased].flatMap((variable) =>
    spotsOf(variable).map((spot) => ({
      node: spot,
      messageId: reached.imported.has(variable) ? "testHook" : "aliasedTestHook",
      data: { hook: variable.name },
    })),
  );

const namespaceReports = (
  members: ReadonlySet<ESTree.MemberExpression>,
  reading: HookReading & { readonly namespaces: ReadonlySet<Variable> },
): readonly Report[] =>
  [...members].flatMap((member) => {
    const named = namespaceHookOf(member, reading);
    if (named === null) return [];
    return [{ node: member, messageId: "namespaceTestHook", data: { hook: named } }];
  });

const reachesHookThrough = (reading: {
  readonly module: ModuleDeclarations;
  readonly name: string;
  readonly hookNames: ReadonlySet<string>;
}): boolean => {
  const imported = reading.module.importedByName.get(reading.name);
  if (imported === undefined || reading.hookNames.has(imported.exported)) return false;

  return reachesTestHook({
    from: reading.module,
    imported,
    hookNames: reading.hookNames,
    visited: new Set([reading.module.filename]),
  });
};

const calleeReports = (
  calls: ReadonlySet<ESTree.CallExpression>,
  reading: { readonly module: ModuleDeclarations; readonly hookNames: ReadonlySet<string> },
): readonly Report[] => {
  const called = [...calls].flatMap((call) => {
    const callee = unwrapSubject(call.callee);
    return callee.type === "Identifier" ? [{ call, name: callee.name }] : [];
  });
  const reaching = new Set(
    uniq(called.map((reached) => reached.name)).filter((name) =>
      reachesHookThrough({ ...reading, name }),
    ),
  );

  return called.flatMap((reached) => {
    if (!reaching.has(reached.name)) return [];
    return [
      { node: reached.call, messageId: "testHookThroughCallee", data: { through: reached.name } },
    ];
  });
};

export const forbidTestHook = createDontReviewItRule({
  name: "forbid-test-hook--move-setup-into-fixture",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a spec file naming a test hook, so every subject an assertion reads is born in the fixture the test block asked for",
      relatedGuidelines: [],
    },
    messages: {
      testHook:
        "A spec file must not name the test hook `{{hook}}`. Every other check in this bundle starts from the subject a fixture hands to the test block, and preparation parked in a hook is born off that path, leaving a mirrored expected value, a projected subject and an inspected mock record unexamined. Move the preparation this hook carries into the fixture and have the fixture hand the subject back to the test block. Delete the cleanup it carries; the shared runner configuration already restores every test.",
      aliasedTestHook:
        "A spec file must not name the test hook `{{hook}}` under a binding of its own. A renamed hook still prepares the subject off the path every other check in this bundle reads, the one running from a fixture to the test block that consumes it. Move the preparation this hook carries into the fixture, have the fixture hand the subject back to the test block, and delete this binding together with the hook. Cleanup stays unwritten; the shared runner configuration already restores every test.",
      namespaceTestHook:
        "A spec file must not reach the test hook `{{hook}}` through the runner namespace. A hook taken off the namespace prepares the subject off the path every other check in this bundle reads, the one running from a fixture to the test block that consumes it. Move the preparation this hook carries into the fixture and have the fixture hand the subject back to the test block. Delete the cleanup it carries; the shared runner configuration already restores every test.",
      testHookThroughCallee:
        "A spec file must not reach a test hook, and the call to `{{through}}` reaches one in the module that declares it. A hook hidden behind a call still prepares the subject off the path every other check in this bundle reads, the one running from a fixture to the test block that consumes it. Inline the preparation that module carries into the fixture and have the fixture hand the subject back to the test block. Delete the cleanup it carries; the shared runner configuration already restores every test.",
    },
    schema: [
      {
        type: "object",
        properties: {
          hookNames: { type: "array", items: { type: "string" } },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    if (!isSpecFile(context.filename, specFileSuffixesFrom(context.options))) return {};

    const hookNames = hookNamesFrom(context.options);
    const scopeAt: ScopeLookup = (node) => context.sourceCode.getScope(node);
    const reading = { hookNames, scopeAt };
    const members = new Set<ESTree.MemberExpression>();
    const calls = new Set<ESTree.CallExpression>();

    return {
      MemberExpression(node: ESTree.MemberExpression) {
        members.add(node);
      },
      CallExpression(node: ESTree.CallExpression) {
        calls.add(node);
      },
      "Program:exit"(node: ESTree.Program) {
        const outermost = scopeAt(node);
        const variables = scopesUnder(outermost).flatMap((scope) => scope.variables);
        const imported = new Set(variables.filter((variable) => importsHook(variable, hookNames)));
        const aliased = hookAliasesOf(variables, { ...reading, reached: new Set(imported) });
        const namespaces = namespaceBindingsOf(variables, scopeAt);
        const reports = [
          ...injectedReports(outermost, hookNames),
          ...boundReports({ imported, aliased }),
          ...namespaceReports(members, { ...reading, namespaces }),
          ...calleeReports(calls, {
            hookNames,
            module: moduleDeclarationsOf(context.filename, node.body),
          }),
        ];

        for (const report of reports) context.report(report);
      },
    };
  },
});
