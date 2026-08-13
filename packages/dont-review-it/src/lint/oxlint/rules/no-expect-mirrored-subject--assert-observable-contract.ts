import { uniq } from "es-toolkit";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
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
  readonly expectedExpression: ESTree.Expression;
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
  factoryBody: ESTree.FunctionBody,
  caughtErrorName: string,
): readonly ESTree.Expression[] =>
  factoryBody.body
    .flatMap((statement) => (statement.type === "TryStatement" ? [statement] : []))
    .filter((attempt) => caughtName(attempt) === caughtErrorName)
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

  const factoryBody = factory === null ? null : blockBodyOf(factory);
  return factoryBody === null ? [] : thrownUnderCatch(factoryBody, written.name);
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
  const reached = (nestedExpression: ESTree.Expression): readonly ESTree.Expression[] =>
    constructionsBehind({ scopeAt, written: nestedExpression, factory, seen });

  if (bare.type === "Identifier") {
    return behindName({ scopeAt, written: bare, factory }).flatMap(reached);
  }
  if (bare.type === "CallExpression") return [bare, ...behindCall(scopeAt, bare).flatMap(reached)];
  return [bare];
};

const subjectShapesOf = (
  declaration: FixtureDeclaration,
  scopeAt: ScopeLookup,
): readonly string[] =>
  declaration.subjects
    .flatMap((subject) =>
      constructionsBehind({
        scopeAt,
        written: subject,
        factory: declaration.factory,
        seen: new Set(),
      }),
    )
    .map((construction) => syntaxShapeOf(construction));

const constructionShapesOf = (input: {
  readonly scopeAt: ScopeLookup;
  readonly declarations: readonly FixtureDeclaration[];
}): ReadonlyMap<string, ReadonlySet<string>> => {
  const { scopeAt, declarations } = input;
  return new Map(
    uniq(declarations.map((declaration) => declaration.name)).map((fixtureName) => [
      fixtureName,
      new Set(
        declarations
          .filter((declaration) => declaration.name === fixtureName)
          .flatMap((declaration) => subjectShapesOf(declaration, scopeAt)),
      ),
    ]),
  );
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
  const expectedExpression = subject === null ? null : firstValueOf(call);
  return subject === null || expectedExpression === null ? null : { subject, expectedExpression };
};

const spreadSourcesOf = (
  expectedExpression: ESTree.Expression,
): readonly ESTree.IdentifierReference[] => {
  if (expectedExpression.type !== "ObjectExpression") return [];
  return expectedExpression.properties.flatMap((property) => {
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
  const { subject, expectedExpression } = candidate;
  const reached = resolvedExpression({ scopeAt, written: expectedExpression });
  const fixture = fixtureNameOf(scopeAt, subject);
  const spreads = spreadSourcesOf(reached).some((source) =>
    namesOneBinding({ scopeAt, left: source, right: subject }),
  );
  if (spreads) {
    return { node: expectedExpression, messageId: "spreadSubject", data: { subject: fixture } };
  }

  const mirrored =
    reached.type === "Identifier"
      ? namesOneBinding({ scopeAt, left: reached, right: subject })
      : boundExpressionAt(scopeAt, subject) === null &&
        (shapesByFixture.get(fixture)?.has(syntaxShapeOf(reached)) ?? false);
  if (!mirrored) return null;
  return { node: expectedExpression, messageId: "mirroredSubject", data: { subject: fixture } };
};

const mirrorReportsOf = (input: {
  readonly scopeAt: ScopeLookup;
  readonly declarations: readonly FixtureDeclaration[];
  readonly candidates: readonly MirrorCandidate[];
}): readonly MirrorReport[] => {
  const { scopeAt, declarations, candidates } = input;
  const shapesByFixture = constructionShapesOf({ scopeAt, declarations });
  return candidates.flatMap((candidate) => {
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
        "Disallow writing the expression a fixture built the subject from as the expected value of an assertion, so a passing assertion states something about the code rather than that one expression evaluates to itself",
      relatedGuidelines: [],
    },
    messages: {
      mirroredSubject:
        "An expected value must not repeat the expression the fixture `{{subject}}` built the subject from. Decide what this assertion claims about the code, then write the expected value from outside that expression: the concrete value the code has to produce, or a derived value the fixture hands back for comparison against a literal. Drop the assertion altogether where a stronger claim about the same subject already stands beside it.",
      spreadSubject:
        "An expected value must not spread the subject into itself, leaving every key it does not override compared against itself. Write the whole expected value from outside the expression that built the fixture `{{subject}}`: the concrete value the code has to produce, or the overridden keys as derived values the fixture hands back for comparison against literals.",
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

    return {
      "Program:exit"(program: ESTree.Program) {
        const calls = nodesOfType(program, "CallExpression");
        const declarations = calls.flatMap((call) => fixtureDeclarationsOf(call));
        const candidates = calls.flatMap((call) => {
          const candidate = candidateOf(call);
          return candidate === null ? [] : [candidate];
        });

        for (const report of mirrorReportsOf({ scopeAt, declarations, candidates })) {
          inspection.report(report);
        }
      },
    };
  },
});
