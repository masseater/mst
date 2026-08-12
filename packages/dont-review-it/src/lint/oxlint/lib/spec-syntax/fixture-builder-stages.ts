import { fixtureDependenciesOf } from "./fixture-declarations.ts";
import { staticPropertyName } from "./static-names.ts";
import {
  asSpecFunction,
  returnedExpressionsOf,
  unwrapSubject,
  type SpecFunction,
  type SpecStatement,
} from "./subject-expressions.ts";

import type { ESTree } from "@oxlint/plugins";

const CLEANUP_REGISTRATION = "onCleanup";

const NON_FUNCTION_VALUES: ReadonlySet<string> = new Set([
  "ArrayExpression",
  "Literal",
  "ObjectExpression",
  "TemplateLiteral",
  "UnaryExpression",
]);

export type FixtureSource = {
  readonly textOf: (node: ESTree.Node) => string;
  readonly readCountOf: (declared: ESTree.Node, name: string) => number;
};

type FixtureParts = {
  readonly written: string;
  readonly dependencies: readonly string[];
};

type BuilderStage = FixtureParts & { readonly name: string };

type FactoryShape = {
  readonly opened: string;
  readonly context: string;
  readonly handoff: string;
  readonly source: FixtureSource;
};

type HandoffSplit = {
  readonly leading: readonly SpecStatement[];
  readonly yielded: ESTree.Expression;
  readonly registered: string;
};

const endedStatement = (written: string): string =>
  written.endsWith(";") ? written : `${written};`;

const soleArgumentOf = (call: ESTree.CallExpression): ESTree.Expression | null => {
  const [only, ...rivals] = call.arguments;
  return only === undefined || rivals.length !== 0 || only.type === "SpreadElement" ? null : only;
};

const handoffCallOf = (
  written: ESTree.Expression,
  handoff: string,
): ESTree.CallExpression | null => {
  const bare = unwrapSubject(written);
  if (bare.type !== "CallExpression") return null;
  const callee = unwrapSubject(bare.callee);
  return callee.type === "Identifier" && callee.name === handoff ? bare : null;
};

const handoffCallIn = (statement: SpecStatement, handoff: string): ESTree.CallExpression | null =>
  statement.type === "ExpressionStatement" ? handoffCallOf(statement.expression, handoff) : null;

const arrowBodyText = (yielded: ESTree.Expression, source: FixtureSource): string => {
  const written = source.textOf(yielded);
  return unwrapSubject(yielded).type === "ObjectExpression" ? `(${written})` : written;
};

const cleanupRegistrationText = (
  trailing: readonly SpecStatement[],
  { source, awaited }: { readonly source: FixtureSource; readonly awaited: boolean },
): string | null => {
  if (trailing.length === 0) return "";
  if (trailing.some((statement) => statement.type !== "ExpressionStatement")) return null;
  const registered = trailing
    .map((statement) => endedStatement(source.textOf(statement)))
    .join("\n");
  return `${CLEANUP_REGISTRATION}(${awaited ? "async " : ""}() => {\n${registered}\n});`;
};

const handoffSplitOf = (
  { fn, body }: { readonly fn: ESTree.ArrowFunctionExpression; readonly body: ESTree.FunctionBody },
  { handoff, source }: FactoryShape,
): HandoffSplit | null => {
  if (returnedExpressionsOf(fn).length !== 0) return null;

  const [handed] = body.body.flatMap((statement, at) => {
    const call = handoffCallIn(statement, handoff);
    return call === null ? [] : [{ at, call }];
  });
  if (handed === undefined) return null;

  const yielded = soleArgumentOf(handed.call);
  if (yielded === null) return null;

  const registered = cleanupRegistrationText(body.body.slice(handed.at + 1), {
    source,
    awaited: fn.async,
  });
  return registered === null
    ? null
    : { leading: body.body.slice(0, handed.at), yielded, registered };
};

const blockFactoryText = (
  { leading, yielded, registered }: HandoffSplit,
  { opened, context, source }: FactoryShape,
): string => {
  if (leading.length === 0 && registered === "") {
    return `${opened}(${context}) => ${arrowBodyText(yielded, source)}`;
  }

  const written = [
    ...leading.map((statement) => endedStatement(source.textOf(statement))),
    ...(registered === "" ? [] : [registered]),
    `return ${source.textOf(yielded)};`,
  ].join("\n");
  const taken = registered === "" ? context : `${context}, { ${CLEANUP_REGISTRATION} }`;
  return `${opened}(${taken}) => {\n${written}\n}`;
};

const expressionFactoryText = (
  factoryBody: ESTree.Expression,
  { opened, context, handoff, source }: FactoryShape,
): string | null => {
  const handed = handoffCallOf(factoryBody, handoff);
  if (handed === null) return null;

  const yielded = soleArgumentOf(handed);
  return yielded === null ? null : `${opened}(${context}) => ${arrowBodyText(yielded, source)}`;
};

const factoryShapeOf = (
  arrow: ESTree.ArrowFunctionExpression,
  source: FixtureSource,
): FactoryShape | null => {
  const [contextParameter, handoffParameter, ...extraParameters] = arrow.params;
  if (extraParameters.length !== 0) return null;
  if (contextParameter === undefined) return null;
  if (handoffParameter?.type !== "Identifier") return null;
  if (source.readCountOf(handoffParameter, handoffParameter.name) !== 1) return null;

  return {
    opened: arrow.async ? "async " : "",
    context: source.textOf(contextParameter),
    handoff: handoffParameter.name,
    source,
  };
};

const factoryParts = (takenFunction: SpecFunction, source: FixtureSource): FixtureParts | null => {
  if (takenFunction.type !== "ArrowFunctionExpression") return null;

  const shape = factoryShapeOf(takenFunction, source);
  if (shape === null) return null;

  const dependencies = (fixtureDependenciesOf(takenFunction) ?? []).map(
    (dependency) => dependency.name,
  );
  if (takenFunction.body.type !== "BlockStatement") {
    const written = expressionFactoryText(takenFunction.body, shape);
    return written === null ? null : { written, dependencies };
  }

  const split = handoffSplitOf({ fn: takenFunction, body: takenFunction.body }, shape);
  return split === null ? null : { written: blockFactoryText(split, shape), dependencies };
};

const heldValueParts = (written: ESTree.Expression, source: FixtureSource): FixtureParts | null =>
  NON_FUNCTION_VALUES.has(unwrapSubject(written).type)
    ? { written: source.textOf(written), dependencies: [] }
    : null;

const declaredFixtureParts = (
  written: ESTree.Expression,
  source: FixtureSource,
): FixtureParts | null => {
  const factory = asSpecFunction(written);
  return factory === null ? heldValueParts(written, source) : factoryParts(factory, source);
};

const scopedFixtureParts = (
  written: ESTree.ArrayExpression,
  source: FixtureSource,
): FixtureParts | null => {
  const [declared, ruleOptions, ...rivals] = written.elements;
  if (rivals.length !== 0) return null;
  if (declared === undefined || declared === null || declared.type === "SpreadElement") return null;

  const fixture = declaredFixtureParts(declared, source);
  if (fixture === null) return null;
  if (ruleOptions === undefined) return fixture;
  if (ruleOptions === null || ruleOptions.type === "SpreadElement") return null;
  if (unwrapSubject(ruleOptions).type !== "ObjectExpression") return null;

  return { ...fixture, written: `${source.textOf(ruleOptions)}, ${fixture.written}` };
};

const stageOf = (property: ESTree.ObjectProperty, source: FixtureSource): BuilderStage | null => {
  if (property.computed || property.method || property.kind !== "init") return null;

  const spelled = staticPropertyName(property);
  if (spelled === null) return null;

  const bare = unwrapSubject(property.value);
  const parts =
    bare.type === "ArrayExpression"
      ? scopedFixtureParts(bare, source)
      : declaredFixtureParts(property.value, source);

  return parts === null
    ? null
    : { ...parts, name: spelled, written: `${JSON.stringify(spelled)}, ${parts.written}` };
};

const orderedStages = (
  pending: readonly BuilderStage[],
  placed: readonly BuilderStage[],
): readonly BuilderStage[] | null => {
  if (pending.length === 0) return placed;

  const settled = new Set(placed.map((stage) => stage.name));
  const reachedNext = pending.find((stage) =>
    stage.dependencies.every((dependency) => settled.has(dependency)),
  );
  if (reachedNext === undefined) return null;

  return orderedStages(
    pending.filter((stage) => stage !== reachedNext),
    [...placed, reachedNext],
  );
};

export const builderStagesFor = (
  builderObject: ESTree.ObjectExpression,
  source: FixtureSource,
): readonly string[] | null => {
  const stages = builderObject.properties.map((property) =>
    property.type === "Property" ? stageOf(property, source) : null,
  );

  const declared = stages.filter((stage) => stage !== null);
  if (declared.length !== stages.length || declared.length === 0) return null;

  const named = new Set(declared.map((stage) => stage.name));
  if (named.size !== declared.length) return null;

  const ordered = orderedStages(
    declared.map((stage) => ({
      ...stage,
      dependencies: stage.dependencies.filter((dependency) => named.has(dependency)),
    })),
    [],
  );
  return ordered === null ? null : ordered.map((stage) => stage.written);
};
