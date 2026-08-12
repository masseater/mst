import { createDontReviewItRule } from "../../../create-rule.ts";
import { resolveBinding, type ScopeLookup } from "../lib/resolved-bindings.ts";
import { syntaxShapeOf } from "../lib/spec-syntax/expression-shape.ts";
import {
  fixtureDeclarationsOf,
  fixtureDependenciesOf,
  type FixtureDeclaration,
  type FixtureDependency,
} from "../lib/spec-syntax/fixture-declarations.ts";
import {
  ASSERTION_CHAIN_MODIFIERS,
  DERIVED_ASSERTION_RECEIVERS,
} from "../lib/spec-syntax/matcher-vocabulary.ts";
import { isSpecFile, specFileSuffixesFrom } from "../lib/spec-syntax/spec-files.ts";
import { staticMemberName } from "../lib/spec-syntax/static-names.ts";
import {
  blockBodyOf,
  returnedExpressionsOf,
  unwrapSubject,
  type SpecFunction,
} from "../lib/spec-syntax/subject-expressions.ts";

import type { ESTree, Variable } from "@oxlint/plugins";

const ASSERTION_RECEIVER = "expect";

type MirrorCandidate = {
  readonly subject: ESTree.IdentifierReference;
  readonly expected: ESTree.Expression;
};

type MirrorReport = {
  readonly node: ESTree.Expression;
  readonly messageId: string;
  readonly data: { readonly subject: string };
};

const caughtName = (attempt: ESTree.TryStatement): string | null => {
  const caught = attempt.handler?.param;
  return caught?.type === "Identifier" ? caught.name : null;
};

const thrownUnderCatch = (
  writtenBody: ESTree.FunctionBody,
  spelled: string,
): readonly ESTree.Expression[] =>
  writtenBody.body
    .flatMap((statement) => (statement.type === "TryStatement" ? [statement] : []))
    .filter((attempt) => caughtName(attempt) === spelled)
    .flatMap((attempt) => attempt.block.body)
    .flatMap((statement) => (statement.type === "ThrowStatement" ? [statement.argument] : []));

const bindingAt = (scopeAt: ScopeLookup, written: ESTree.IdentifierReference): Variable | null =>
  resolveBinding(scopeAt(written), written.name);

const namesOneBinding = (input: {
  readonly scopeAt: ScopeLookup;
  readonly left: ESTree.IdentifierReference;
  readonly right: ESTree.IdentifierReference;
}): boolean => {
  const { scopeAt, left, right } = input;
  const held = bindingAt(scopeAt, left);
  return held !== null && held === bindingAt(scopeAt, right);
};

const soleBoundExpression = (binding: Variable): ESTree.Expression | null => {
  const [definition] = binding.defs;
  if (definition === undefined || binding.defs.length !== 1) return null;

  const declarator = definition.node;
  if (declarator.type !== "VariableDeclarator" || declarator.id.type !== "Identifier") return null;
  if (declarator.init === null) return null;

  const rewritten = binding.references
    .flatMap((reference) => reference.writeExpr ?? [])
    .filter((written) => written !== declarator.init);
  return rewritten.length === 0 ? declarator.init : null;
};

const boundExpressionAt = (
  scopeAt: ScopeLookup,
  written: ESTree.IdentifierReference,
): ESTree.Expression | null => {
  const binding = bindingAt(scopeAt, written);
  return binding === null ? null : soleBoundExpression(binding);
};

const resolvedExpression = (input: {
  readonly scopeAt: ScopeLookup;
  readonly written: ESTree.Expression;
  readonly seen?: Set<ESTree.Expression>;
}): ESTree.Expression => {
  const { scopeAt, written, seen = new Set<ESTree.Expression>() } = input;
  const bare = unwrapSubject(written);
  if (bare.type !== "Identifier" || seen.has(bare)) return bare;

  seen.add(bare);
  const bound = boundExpressionAt(scopeAt, bare);
  return bound === null ? bare : resolvedExpression({ scopeAt, written: bound, seen });
};

const fixtureDependenciesAt = (node: ESTree.Node): readonly FixtureDependency[] => {
  if (node.type !== "ArrowFunctionExpression" && node.type !== "FunctionExpression") return [];
  return fixtureDependenciesOf(node) ?? [];
};

const fixtureNameOf = (scopeAt: ScopeLookup, written: ESTree.IdentifierReference): string => {
  const binding = bindingAt(scopeAt, written);
  const declared = (binding?.defs ?? []).flatMap((definition) =>
    fixtureDependenciesAt(definition.node).filter(
      (dependency) => dependency.boundAs === written.name,
    ),
  );
  return declared[0]?.name ?? written.name;
};

const behindName = (input: {
  readonly scopeAt: ScopeLookup;
  readonly written: ESTree.IdentifierReference;
  readonly factory: SpecFunction | null;
}): readonly ESTree.Expression[] => {
  const { scopeAt, written, factory } = input;
  const bound = boundExpressionAt(scopeAt, written);
  if (bound !== null) return [bound];

  const writtenBody = factory === null ? null : blockBodyOf(factory);
  return writtenBody === null ? [] : thrownUnderCatch(writtenBody, written.name);
};

const behindCall = (
  scopeAt: ScopeLookup,
  call: ESTree.CallExpression,
): readonly ESTree.Expression[] => {
  const called = resolvedExpression({ scopeAt, written: call.callee });
  if (called.type !== "ArrowFunctionExpression" && called.type !== "FunctionExpression") return [];
  return returnedExpressionsOf(called);
};

const constructionsBehind = (input: {
  readonly scopeAt: ScopeLookup;
  readonly written: ESTree.Expression;
  readonly factory: SpecFunction | null;
  readonly seen: Set<ESTree.Expression>;
}): readonly ESTree.Expression[] => {
  const { scopeAt, written, factory, seen } = input;
  if (seen.has(written)) return [];

  seen.add(written);
  const bare = unwrapSubject(written);
  const reached = (reachedNext: ESTree.Expression): readonly ESTree.Expression[] =>
    constructionsBehind({ scopeAt, written: reachedNext, factory, seen });

  if (bare.type === "Identifier") {
    return behindName({ scopeAt, written: bare, factory }).flatMap(reached);
  }
  if (bare.type === "CallExpression") return [bare, ...behindCall(scopeAt, bare).flatMap(reached)];
  return [bare];
};

const constructionShapesOf = (input: {
  readonly scopeAt: ScopeLookup;
  readonly declarations: ReadonlySet<FixtureDeclaration>;
}): ReadonlyMap<string, ReadonlySet<string>> => {
  const { scopeAt, declarations } = input;
  const shapesByFixture = new Map<string, Set<string>>();
  for (const declaration of declarations) {
    const known = shapesByFixture.get(declaration.name) ?? new Set<string>();
    shapesByFixture.set(declaration.name, known);
    for (const subject of declaration.subjects) {
      const behind = constructionsBehind({
        scopeAt,
        written: subject,
        factory: declaration.factory,
        seen: new Set(),
      });
      for (const construction of behind) known.add(syntaxShapeOf(construction));
    }
  }
  return shapesByFixture;
};

const isAssertionReceiver = (call: ESTree.CallExpression): boolean => {
  const callee = unwrapSubject(call.callee);
  if (callee.type === "Identifier") return callee.name === ASSERTION_RECEIVER;
  if (callee.type !== "MemberExpression") return false;

  const member = staticMemberName(callee);
  if (member === null || !DERIVED_ASSERTION_RECEIVERS.has(member)) return false;

  const receiver = unwrapSubject(callee.object);
  return receiver.type === "Identifier" && receiver.name === ASSERTION_RECEIVER;
};

const assertionRootOf = (node: ESTree.Expression): ESTree.CallExpression | null => {
  const written = unwrapSubject(node);
  if (written.type === "CallExpression") return isAssertionReceiver(written) ? written : null;
  if (written.type !== "MemberExpression") return null;

  const member = staticMemberName(written);
  if (member === null || !ASSERTION_CHAIN_MODIFIERS.has(member)) return null;
  return assertionRootOf(written.object);
};

const firstValueOf = (call: ESTree.CallExpression): ESTree.Expression | null => {
  const [handed] = call.arguments;
  if (handed === undefined || handed.type === "SpreadElement") return null;
  return handed;
};

const assertedSubjectOf = (call: ESTree.CallExpression): ESTree.IdentifierReference | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "MemberExpression" || staticMemberName(callee) === null) return null;

  const root = assertionRootOf(callee.object);
  const handed = root === null ? null : firstValueOf(root);
  const subject = handed === null ? null : unwrapSubject(handed);
  return subject?.type === "Identifier" ? subject : null;
};

const candidateOf = (call: ESTree.CallExpression): MirrorCandidate | null => {
  const subject = assertedSubjectOf(call);
  const wanted = subject === null ? null : firstValueOf(call);
  return subject === null || wanted === null ? null : { subject, expected: wanted };
};

const spreadSourcesOf = (wanted: ESTree.Expression): readonly ESTree.IdentifierReference[] => {
  if (wanted.type !== "ObjectExpression") return [];
  return wanted.properties.flatMap((property) => {
    if (property.type !== "SpreadElement") return [];
    const source = unwrapSubject(property.argument);
    return source.type === "Identifier" ? [source] : [];
  });
};

const mirrorReportOf = (input: {
  readonly scopeAt: ScopeLookup;
  readonly shapesByFixture: ReadonlyMap<string, ReadonlySet<string>>;
  readonly candidate: MirrorCandidate;
}): MirrorReport | null => {
  const { scopeAt, shapesByFixture, candidate } = input;
  const { subject, expected: wanted } = candidate;
  const reached = resolvedExpression({ scopeAt, written: wanted });
  const fixture = fixtureNameOf(scopeAt, subject);
  const spreads = spreadSourcesOf(reached).some((source) =>
    namesOneBinding({ scopeAt, left: source, right: subject }),
  );
  if (spreads) return { node: wanted, messageId: "spreadSubject", data: { subject: fixture } };

  const mirrored =
    reached.type === "Identifier"
      ? namesOneBinding({ scopeAt, left: reached, right: subject })
      : boundExpressionAt(scopeAt, subject) === null &&
        (shapesByFixture.get(fixture)?.has(syntaxShapeOf(reached)) ?? false);
  if (!mirrored) return null;
  return { node: wanted, messageId: "mirroredSubject", data: { subject: fixture } };
};

const mirrorReportsOf = (input: {
  readonly scopeAt: ScopeLookup;
  readonly declarations: ReadonlySet<FixtureDeclaration>;
  readonly candidates: ReadonlySet<MirrorCandidate>;
}): readonly MirrorReport[] => {
  const { scopeAt, declarations, candidates } = input;
  const shapesByFixture = constructionShapesOf({ scopeAt, declarations });
  return [...candidates].flatMap((candidate) => {
    const report = mirrorReportOf({ scopeAt, shapesByFixture, candidate });
    return report === null ? [] : [report];
  });
};

export const noExpectMirroredSubject = createDontReviewItRule({
  name: "no-expect-mirrored-subject--assert-observable-contract",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow writing the expression a fixture built the subject from as the wanted value of an assertion, so a passing assertion states something about the code rather than that one expression evaluates to itself",
      relatedGuidelines: [],
    },
    messages: {
      mirroredSubject:
        "An wanted value must not repeat the expression the fixture `{{subject}}` built the subject from. Decide what this assertion claims about the code, then write the wanted value from outside that expression: the concrete value the code has to produce, or a derived value the fixture hands back for comparison against a literal. Drop the assertion altogether where a stronger claim about the same subject already stands beside it.",
      spreadSubject:
        "An wanted value must not spread the subject into itself, leaving every key it does not override compared against itself. Write the whole wanted value from outside the expression that built the fixture `{{subject}}`: the concrete value the code has to produce, or the overridden keys as derived values the fixture hands back for comparison against literals.",
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

    const scopeAt: ScopeLookup = (node) => inspection.sourceCode.getScope(node);
    const declarations = new Set<FixtureDeclaration>();
    const candidates = new Set<MirrorCandidate>();

    return {
      CallExpression(node: ESTree.CallExpression) {
        for (const declaration of fixtureDeclarationsOf(node)) declarations.add(declaration);

        const candidate = candidateOf(node);
        if (candidate !== null) candidates.add(candidate);
      },
      "Program:exit"() {
        for (const report of mirrorReportsOf({ scopeAt, declarations, candidates })) {
          inspection.report(report);
        }
      },
    };
  },
});
