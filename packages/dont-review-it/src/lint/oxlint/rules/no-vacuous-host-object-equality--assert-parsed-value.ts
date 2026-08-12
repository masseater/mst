import { createDontReviewItRule } from "../../../create-rule.ts";
import { ancestorsOf } from "../lib/ast-node.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
import { resolveBinding, type ScopeLookup } from "../lib/resolved-bindings.ts";
import {
  isAssertionEntryCall,
  isAssertionEntryReference,
} from "../lib/spec-syntax/assertion-entries.ts";
import {
  comparedPositionsOf,
  isSettledShape,
  type ComparedPair,
  type ComparedSide,
  type SideResolution,
} from "../lib/spec-syntax/compared-positions.ts";
import {
  constructedHostTypeOf,
  hostObjectTypesFrom,
  runtimeModulesFrom,
  type HostTypeLookup,
} from "../lib/spec-syntax/host-object-constructions.ts";
import {
  ASSERTION_CHAIN_MODIFIERS,
  STRUCTURAL_MATCHERS,
} from "../lib/spec-syntax/matcher-vocabulary.ts";
import {
  entryKeysOf,
  snapshotMatcherSiteOf,
  INLINE_SPELLING_BY_EXTERNAL,
  type SnapshotEntryKeys,
  type SnapshotMatcherSite,
} from "../lib/spec-syntax/snapshot-entry-keys.ts";
import {
  emptyBodyConstructorOf,
  externalRecordOf,
  fileRecordOf,
} from "../lib/spec-syntax/snapshot-records.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";
import { staticMemberName, staticSpelling } from "../lib/spec-syntax/static-names.ts";
import {
  asSpecFunction,
  returnedExpressionsOf,
  unwrapSubject,
} from "../lib/spec-syntax/subject-expressions.ts";

import type { ESTree, Options } from "@oxlint/plugins";

const PARTIAL_SHAPE_MATCHERS: ReadonlySet<string> = new Set(["toMatchObject"]);

const PARTIAL_SHAPE_ASYMMETRIC_MATCHER = "objectContaining";

const FILE_RECORD_MATCHER = "toMatchFileSnapshot";

const PARSED_VALUE_MATCHER_OPTION = "parsedValueMatcher";

const DEFAULT_PARSED_VALUE_MATCHER = "toHaveParsedFields";

const STRUCTURAL_EQUALITY_MESSAGE = "vacuousStructuralEquality";

const PARTIAL_SHAPE_MESSAGE = "vacuousPartialShape";

type RuntimeImports = {
  readonly names: ReadonlyMap<string, string>;
  readonly namespaces: ReadonlySet<string>;
};

type SpecReader = {
  readonly lookup: HostTypeLookup;
  readonly resolve: SideResolution;
  readonly settle: (side: ComparedSide) => ComparedSide;
  readonly mayHold: (side: ESTree.Expression, hostType: string) => boolean;
};

type ComparisonSite = {
  readonly left: ComparedSide;
  readonly right: ComparedSide;
  readonly messageId: string;
};

type SnapshotRecording = {
  readonly site: SnapshotMatcherSite;
  readonly subject: ComparedSide;
};

const parsedValueMatcherFrom = (options: Readonly<Options>): string => {
  const [first] = options;
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return DEFAULT_PARSED_VALUE_MATCHER;
  }
  const configured = first[PARSED_VALUE_MATCHER_OPTION];
  return typeof configured === "string" && configured.length > 0
    ? configured
    : DEFAULT_PARSED_VALUE_MATCHER;
};

const argumentAt = (call: ESTree.CallExpression, index: number): ESTree.Expression | null => {
  const handed = call.arguments[index];
  return handed === undefined || handed.type === "SpreadElement" ? null : handed;
};

const assertionRootOf = (node: ESTree.Expression): ESTree.CallExpression | null => {
  const written = unwrapSubject(node);
  if (written.type === "CallExpression") return isAssertionEntryCall(written) ? written : null;
  if (written.type !== "MemberExpression") return null;

  const member = staticMemberName(written);
  if (member === null || !ASSERTION_CHAIN_MODIFIERS.has(member)) return null;
  return assertionRootOf(written.object);
};

const assertionAt = (
  call: ESTree.CallExpression,
): { readonly matcher: string; readonly subject: ComparedSide } | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return null;

  const matcher = staticMemberName(callee);
  if (matcher === null) return null;

  const root = assertionRootOf(callee.object);
  return root === null ? null : { matcher, subject: argumentAt(root, 0) };
};

const isAsymmetricPartialShape = (call: ESTree.CallExpression): boolean => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression") return false;
  if (staticMemberName(callee) !== PARTIAL_SHAPE_ASYMMETRIC_MATCHER) return false;
  return isAssertionEntryReference(callee.object);
};

const comparedByMatcher = (
  call: ESTree.CallExpression,
  matched: { readonly matcher: string; readonly subject: ComparedSide },
): ComparisonSite | null => {
  if (STRUCTURAL_MATCHERS.has(matched.matcher)) {
    return {
      left: matched.subject,
      right: argumentAt(call, 0),
      messageId: STRUCTURAL_EQUALITY_MESSAGE,
    };
  }
  if (PARTIAL_SHAPE_MATCHERS.has(matched.matcher)) {
    return { left: argumentAt(call, 0), right: null, messageId: PARTIAL_SHAPE_MESSAGE };
  }
  return null;
};

const comparisonSiteOf = (call: ESTree.CallExpression): ComparisonSite | null => {
  if (isAsymmetricPartialShape(call)) {
    return { left: argumentAt(call, 0), right: null, messageId: PARTIAL_SHAPE_MESSAGE };
  }
  const matched = assertionAt(call);
  return matched === null ? null : comparedByMatcher(call, matched);
};

const snapshotRecordingOf = (call: ESTree.CallExpression): SnapshotRecording | null => {
  const matched = assertionAt(call);
  if (matched === null) return null;

  const site = snapshotMatcherSiteOf(call, ancestorsOf(call));
  return site === null ? null : { site, subject: matched.subject };
};

const inlineRecordOf = (call: ESTree.CallExpression): string | null => {
  const given = call.arguments.flatMap((argument) =>
    argument.type === "SpreadElement" ? [] : [argument],
  );
  if (given.length !== call.arguments.length) return null;

  const last = given.at(-1);
  if (last === undefined) return null;
  if (given.length === 1 && unwrapSubject(last).type === "ObjectExpression") return null;
  return staticSpelling(last);
};

const runtimeImportsOf = (request: {
  readonly program: ESTree.Program;
  readonly modules: ReadonlySet<string>;
}): RuntimeImports => {
  const specifiers = request.program.body.flatMap((statement) =>
    statement.type === "ImportDeclaration" && request.modules.has(statement.source.value)
      ? statement.specifiers
      : [],
  );
  return {
    names: new Map(
      specifiers.flatMap((specifier) =>
        specifier.type === "ImportSpecifier"
          ? [
              [
                specifier.local.name,
                specifier.imported.type === "Identifier"
                  ? specifier.imported.name
                  : specifier.imported.value,
              ] as const,
            ]
          : [],
      ),
    ),
    namespaces: new Set(
      specifiers.flatMap((specifier) =>
        specifier.type === "ImportNamespaceSpecifier" ? [specifier.local.name] : [],
      ),
    ),
  };
};

const lookupOf = (request: {
  readonly imports: RuntimeImports;
  readonly hostTypes: ReadonlySet<string>;
  readonly scopeAt: ScopeLookup;
}): HostTypeLookup => ({
  named: (name, at) => {
    const imported = request.imports.names.get(name);
    if (imported !== undefined) return request.hostTypes.has(imported) ? imported : null;
    if (!request.hostTypes.has(name)) return null;
    return resolveBinding(request.scopeAt(at), name) === null ? name : null;
  },
  qualified: (namespace, member) =>
    request.imports.namespaces.has(namespace) && request.hostTypes.has(member) ? member : null,
});

const specReaderOf = (request: {
  readonly lookup: HostTypeLookup;
  readonly scopeAt: ScopeLookup;
}): SpecReader => {
  const { lookup, scopeAt } = request;

  const settledInitializerOf = (
    identifier: ESTree.IdentifierReference,
  ): ESTree.Expression | null => {
    const binding = resolveBinding(scopeAt(identifier), identifier.name);
    const [only, ...rest] = binding?.references.filter((reference) => reference.isWrite()) ?? [];
    if (only === undefined || rest.length > 0) return null;
    return only.init ? only.writeExpr : null;
  };

  const boundToDeclaration = (identifier: ESTree.IdentifierReference): boolean =>
    resolveBinding(scopeAt(identifier), identifier.name)?.defs.some(
      (definition) => definition.type === "ClassName" || definition.type === "FunctionName",
    ) === true;

  const returnedByThunk = (
    call: ESTree.CallExpression,
    seen: ReadonlySet<string>,
  ): { readonly name: string; readonly returned: ESTree.Expression } | null => {
    const callee = unwrapSubject(call.callee);
    if (callee.type !== "Identifier" || seen.has(callee.name)) return null;

    const bound = settledInitializerOf(callee);
    const factory = bound === null ? null : asSpecFunction(bound);
    if (factory === null) return null;

    const [only, ...rest] = returnedExpressionsOf(factory);
    return only === undefined || rest.length > 0 ? null : { name: callee.name, returned: only };
  };

  const settledValue = (node: ESTree.Expression, seen: ReadonlySet<string>): ESTree.Expression => {
    const written = unwrapSubject(node);
    if (written.type === "Identifier") {
      const initializer = seen.has(written.name) ? null : settledInitializerOf(written);
      return initializer === null
        ? written
        : settledValue(initializer, new Set([...seen, written.name]));
    }
    if (written.type !== "CallExpression") return written;

    const behind = returnedByThunk(written, seen);
    if (behind === null) return written;
    return settledValue(behind.returned, new Set([...seen, behind.name]));
  };

  const resolve: SideResolution = (node) => settledValue(node, new Set());

  const mayHold = (side: ESTree.Expression, hostType: string): boolean => {
    const host = constructedHostTypeOf(side, lookup);
    if (host !== null) return host === hostType;
    if (isSettledShape(side)) return false;
    return side.type === "Identifier" ? !boundToDeclaration(side) : true;
  };

  return { lookup, resolve, settle: (side) => (side === null ? null : resolve(side)), mayHold };
};

const vacuousOnLeft = (input: {
  readonly pair: ComparedPair;
  readonly reader: SpecReader;
}): readonly (readonly [ESTree.Expression, string])[] => {
  const { pair, reader } = input;
  if (pair.left === null) return [];

  const host = constructedHostTypeOf(pair.left, reader.lookup);
  if (host === null) return [];

  const open = pair.right === null || reader.mayHold(pair.right, host);
  return open ? [[pair.left, host] as const] : [];
};

const vacuousIn = (input: {
  readonly pair: ComparedPair;
  readonly reader: SpecReader;
}): readonly (readonly [ESTree.Expression, string])[] => {
  const { pair, reader } = input;
  const written = vacuousOnLeft({ pair, reader });
  if (written.length > 0) return written;
  return vacuousOnLeft({ pair: { left: pair.right, right: pair.left }, reader });
};

const namedFileRecordOf = (call: ESTree.CallExpression, filename: string): readonly string[] => {
  const written = argumentAt(call, 0);
  const named = written === null ? null : staticSpelling(written);
  const record = named === null ? null : fileRecordOf(filename, named);
  return record === null ? [] : [record];
};

const recordsAt = (request: {
  readonly site: SnapshotMatcherSite;
  readonly keys: SnapshotEntryKeys | undefined;
  readonly filename: string;
}): readonly string[] => {
  const { site, keys, filename } = request;
  if (site.matcher === FILE_RECORD_MATCHER) return namedFileRecordOf(site.node, filename);
  if (!INLINE_SPELLING_BY_EXTERNAL.has(site.matcher)) {
    const record = inlineRecordOf(site.node);
    return record === null ? [] : [record];
  }
  if (keys?.kind !== "spelled") return [];
  return keys.keys.flatMap((key) => {
    const record = externalRecordOf(filename, key);
    return record === null ? [] : [record];
  });
};

export const noVacuousHostObjectEquality = createDontReviewItRule({
  name: "no-vacuous-host-object-equality--assert-parsed-value",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow comparing or recording a host object that keeps its state in internal slots, so an assertion about an HTTP request or response fails once the code stops producing the contract it was written for",
      relatedGuidelines: [],
    },
    messages: {
      vacuousStructuralEquality:
        "A structural comparison must not stand a `{{hostType}}` construction against a value that may be another one. Assert the parsed value: hand the subject the fixture returned to `{{matcher}}` and write out every field it reads, including the ones the framework fills in. Reading the body inside the fixture and comparing the plain value it yields is forbidden as a repair.",
      vacuousPartialShape:
        "A partial-shape comparison must not name a `{{hostType}}` construction as its expected value. Assert the parsed value: hand the subject the fixture returned to `{{matcher}}` and write out every field it reads, including the ones the framework fills in. Narrowing the comparison to a single field is forbidden as a repair.",
      vacuousSnapshotRecord:
        "A snapshot must not stand in for an assertion about a `{{hostType}}`. The record `{{record}}` holds a constructor name and an empty body. Assert the parsed value: hand the subject the fixture returned to `{{matcher}}` and write out every field it reads, including the ones the framework fills in. Re-recording the snapshot is forbidden as a repair.",
    },
    schema: [
      {
        type: "object",
        properties: {
          hostObjectTypes: { type: "array", items: { type: "string" } },
          parsedValueMatcher: { type: "string" },
          runtimeModules: { type: "array", items: { type: "string" } },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    if (!isSpecFile(context.filename, specFileSuffixesFrom(context.options))) return {};

    const hostTypes = hostObjectTypesFrom(context.options);
    const scopeAt: ScopeLookup = (node) => context.sourceCode.getScope(node);
    const imports = runtimeImportsOf({
      program: context.sourceCode.ast,
      modules: runtimeModulesFrom(context.options),
    });
    const reader = specReaderOf({ lookup: lookupOf({ imports, hostTypes, scopeAt }), scopeAt });
    const matcher = parsedValueMatcherFrom(context.options);

    const reportComparison = (site: ComparisonSite): void => {
      const positions = comparedPositionsOf({
        left: reader.settle(site.left),
        right: reader.settle(site.right),
        resolve: reader.resolve,
      });
      for (const [node, hostType] of positions.flatMap((pair) => vacuousIn({ pair, reader }))) {
        context.report({ node, messageId: site.messageId, data: { hostType, matcher } });
      }
    };

    const reportSnapshot = (recording: SnapshotRecording, records: readonly string[]): void => {
      const [found] = records.flatMap((record) => {
        const hostType = emptyBodyConstructorOf(record);
        return hostType === null || !hostTypes.has(hostType) ? [] : [[record, hostType] as const];
      });
      if (found === undefined) return;

      const subject = reader.settle(recording.subject);
      if (subject === null || !reader.mayHold(subject, found[1])) return;
      context.report({
        node: recording.site.matcherNode,
        messageId: "vacuousSnapshotRecord",
        data: { hostType: found[1], matcher, record: found[0].trim() },
      });
    };

    return {
      CallExpression(node: ESTree.CallExpression) {
        if (snapshotRecordingOf(node) !== null) return;

        const site = comparisonSiteOf(node);
        if (site !== null) reportComparison(site);
      },
      "Program:exit"(program: ESTree.Program) {
        const taken = nodesOfType(program, "CallExpression").flatMap(
          (node) => snapshotRecordingOf(node) ?? [],
        );
        const resolved = entryKeysOf(taken.map((recording) => recording.site));
        for (const [index, recording] of taken.entries()) {
          const records = recordsAt({
            site: recording.site,
            keys: resolved[index],
            filename: context.filename,
          });
          reportSnapshot(recording, records);
        }
      },
    };
  },
});
