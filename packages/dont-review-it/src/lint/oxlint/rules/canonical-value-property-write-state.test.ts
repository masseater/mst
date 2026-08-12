import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { createCanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import { createCanonicalValuePropertyState } from "./canonical-value-property-state.ts";

import type { Context, ESTree } from "@oxlint/plugins";
import type { CanonicalValueOrigin } from "./canonical-value-property-origin.ts";
import type { CanonicalValueStaticPrimitive } from "./canonical-value-property-static.ts";

const primitiveSpelling = (primitive: CanonicalValueStaticPrimitive): string => {
  if (primitive === undefined) return "undefined";
  if (typeof primitive === "string") return JSON.stringify(primitive);
  if (typeof primitive === "bigint") return `${String(primitive)}n`;
  return String(primitive);
};

const projectionSpelling = (
  projection: Extract<CanonicalValueOrigin, { readonly kind: "expression" }>["projections"][number],
): string => {
  if (projection.kind === "array-transform") return `transform:${projection.method}`;
  if (projection.kind === "array-element") return "element";
  if (projection.kind === "property-name") return "property-name";
  if (projection.kind === "static-values") return `values:${projection.values.join(",")}`;
  if (projection.kind === "array-slice") return `slice:${projection.startIndex}`;
  if (projection.kind === "call-arguments") return `arguments:${projection.startIndex}`;
  if (projection.kind === "object-rest") return `rest:${projection.excludedKeys.join(",")}`;
  return `property:${projection.path.join(".")}`;
};

const originSpelling = (context: Context, origin: CanonicalValueOrigin): string => {
  if (origin.kind === "absent") return "absent";
  const source = context.sourceCode.getText(origin.expression);
  const projections = origin.projections.map(projectionSpelling);
  return [source, ...projections].join("|");
};

const expectedSpelling = (argument: ESTree.Argument | undefined): string | null =>
  argument?.type === "Literal" && typeof argument.value === "string" ? argument.value : null;

const inspectedExpression = (argument: ESTree.Argument | undefined): ESTree.Expression | null =>
  argument === undefined || argument.type === "SpreadElement" ? null : argument;

const callName = (callee: ESTree.Expression): string | null =>
  callee.type === "Identifier" ? callee.name : null;

const candidateSpelling = (complete: boolean, candidates: readonly string[]): string =>
  `${complete ? "closed" : "open"}:${candidates.toSorted().join(",")}`;

const inspectionSummary = (
  context: Context,
  input: {
    readonly expression: ESTree.Expression;
    readonly execution: ReturnType<typeof createCanonicalValuePropertyState>["execution"];
    readonly name: string;
    readonly origins: ReturnType<typeof createCanonicalValuePropertyState>["origins"];
    readonly primitives: ReturnType<typeof createCanonicalValuePropertyState>["primitives"];
  },
): string | null => {
  if (input.name === "expectOrigin") {
    const origins = input.origins({ expression: input.expression });
    return candidateSpelling(
      origins.complete,
      origins.candidates.map((origin) => originSpelling(context, origin)),
    );
  }
  if (input.name === "expectExecution") {
    const execution = input.execution(input.expression);
    return `${execution.definite ? "definite" : "possible"}:${execution.executes ? "executes" : "skipped"}`;
  }
  if (input.name !== "expectPrimitive") return null;
  const primitives = input.primitives({ expression: input.expression });
  return candidateSpelling(primitives.complete, primitives.candidates.map(primitiveSpelling));
};

const inspectCall = (
  context: Context,
  input: {
    readonly execution: ReturnType<typeof createCanonicalValuePropertyState>["execution"];
    readonly node: ESTree.CallExpression;
    readonly origins: ReturnType<typeof createCanonicalValuePropertyState>["origins"];
    readonly primitives: ReturnType<typeof createCanonicalValuePropertyState>["primitives"];
  },
): void => {
  const expression = inspectedExpression(input.node.arguments[0]);
  const expected = expectedSpelling(input.node.arguments[1]);
  const name = callName(input.node.callee);
  if (expression === null || expected === null || name === null) return;
  const candidateSummary = inspectionSummary(context, { expression, name, ...input });
  if (candidateSummary === null) return;
  if (candidateSummary === expected) return;
  context.report({
    data: { actual: candidateSummary, expected },
    messageId: "unexpected",
    node: expression,
  });
};

const propertyStateRule = createDontReviewItRule({
  name: "canonical-value-property-write-state",
  meta: {
    type: "problem",
    docs: { description: "Exercise canonical value property state", relatedGuidelines: [] },
    messages: { unexpected: "Expected {{expected}}, received {{actual}}." },
    schema: [],
  },
  create(context) {
    const bindingIndex = createCanonicalValueBindingIndex(context.sourceCode);
    const propertyState = createCanonicalValuePropertyState(bindingIndex);
    const inspections = new Set<ESTree.CallExpression>();
    return {
      AssignmentExpression: bindingIndex.recordAssignment,
      AssignmentPattern: bindingIndex.recordAssignmentPattern,
      CallExpression(node: ESTree.CallExpression) {
        bindingIndex.recordCallExpression(node);
        inspections.add(node);
      },
      ClassDeclaration: bindingIndex.recordClassDeclaration,
      ClassExpression: bindingIndex.recordClassExpression,
      Decorator: bindingIndex.recordDecorator,
      ForInStatement: bindingIndex.recordForInStatement,
      ForOfStatement: bindingIndex.recordForOfStatement,
      MemberExpression: bindingIndex.recordMemberExpression,
      NewExpression: bindingIndex.recordNewExpression,
      "Program:exit"() {
        bindingIndex.finalize();
        for (const node of inspections) inspectCall(context, { node, ...propertyState });
      },
      ReturnStatement: bindingIndex.recordReturnStatement,
      SpreadElement: bindingIndex.recordSpreadElement,
      TaggedTemplateExpression: bindingIndex.recordTaggedTemplateExpression,
      UnaryExpression: bindingIndex.recordUnaryExpression,
      UpdateExpression: bindingIndex.recordUpdateExpression,
      VariableDeclarator: bindingIndex.recordVariableDeclarator,
    };
  },
});

describe("canonical value property write state", () => {
  testLintRule(propertyStateRule, {
    valid: [
      {
        name: "a destructured string length resolves as a primitive",
        code: 'const { length: retry } = "abc";\nexpectOrigin(retry, "closed:\\"abc\\"|property:length");\nexpectPrimitive(retry, "closed:3");',
      },
      {
        name: "a split string exposes its static result vector",
        code: 'expectOrigin("d.r.a.f.t".split("."), "closed:\\"d.r.a.f.t\\".split(\\".\\")|values:d,r,a,f,t");',
      },
      {
        name: "a mapped collection keeps its callback return origins",
        code: 'expectOrigin([0, 1].map((index) => index === 0 ? "draft" : "published"), "open:[0, 1].map((index) => index === 0 ? \\"draft\\" : \\"published\\")|arguments:0");',
      },
      {
        name: "a call argument reaches a plain parameter",
        code: 'inspect("draft");\nfunction inspect(status) { expectPrimitive(status, "closed:\\"draft\\""); }',
      },
      {
        name: "an immediate call argument reaches an arrow parameter",
        code: '((status) => expectPrimitive(status, "closed:\\"draft\\""))("draft");',
      },
      {
        name: "multiple calls retain every possible plain parameter value",
        code: 'inspect("draft");\ninspect("published");\nfunction inspect(status) { expectPrimitive(status, "closed:\\"draft\\",\\"published\\""); }',
      },
      {
        name: "an alias chain resolves to its original expression",
        code: 'const first = ["draft", "published"] as const;\nconst second = first;\nexpectOrigin(second, "closed:[\\"draft\\", \\"published\\"]");',
      },
      {
        name: "a member write through an alias updates the original binding",
        code: 'const original = { statuses: runtimeStatuses() };\nconst alias = original;\nalias.statuses = ["draft", "published"];\nexpectOrigin(original.statuses, "closed:[\\"draft\\", \\"published\\"]");',
      },
      {
        name: "a member write through the original binding updates an alias",
        code: 'const original = { statuses: runtimeStatuses() };\nconst alias = original;\noriginal.statuses = ["draft", "published"];\nexpectOrigin(alias.statuses, "closed:[\\"draft\\", \\"published\\"]");',
      },
      {
        name: "a write through a member alias updates its source member",
        code: 'const original = { nested: { status: runtimeStatus() } };\nconst alias = original.nested;\nalias.status = "draft";\nexpectPrimitive(original.nested.status, "closed:\\"draft\\"");',
      },
      {
        name: "a member assignment shares later writes with its source binding",
        code: 'const original = { status: runtimeStatus() };\nconst holder = {};\nholder.reference = original;\noriginal.status = "draft";\nexpectPrimitive(holder.reference.status, "closed:\\"draft\\"");',
      },
      {
        name: "a computed member alias keeps the key from its assignment time",
        code: 'const original = { status: runtimeStatus() };\nconst holder = {};\nlet key = "reference";\nholder[key] = original;\nkey = "other";\noriginal.status = "draft";\nexpectPrimitive(holder.reference.status, "closed:\\"draft\\"");',
      },
      {
        name: "descendant writes through a destructured alias invalidate the original collection",
        code: 'import { ORDER_STATUSES } from "@mst/order-vocabulary";\nconst original = { statuses: ORDER_STATUSES };\nconst { statuses: alias } = original;\nalias[0] = "draft";\nalias[1] = "published";\nexpectOrigin(original.statuses, "open:");',
      },
      {
        name: "a direct alias overwrite cuts the previous identity",
        code: 'const original = { status: "original" };\nconst replacement = { status: "replacement" };\nlet alias = original;\nalias = replacement;\nalias.status = "mutated";\nexpectPrimitive(original.status, "closed:\\"original\\"");',
      },
      {
        name: "a member alias is cut when its root binding is overwritten",
        code: 'const original = { status: "original" };\nconst replacement = { reference: { status: "replacement" } };\nlet holder = {};\nholder.reference = original;\nholder = replacement;\nholder.reference.status = "mutated";\nexpectPrimitive(original.status, "closed:\\"original\\"");',
      },
      {
        name: "a member alias is cut when an ancestor member is overwritten",
        code: 'const original = { status: "original" };\nconst replacement = { reference: { status: "replacement" } };\nconst holder = { nested: {} };\nholder.nested.reference = original;\nholder.nested = replacement;\nholder.nested.reference.status = "mutated";\nexpectPrimitive(original.status, "closed:\\"original\\"");',
      },
      {
        name: "an alias cycle shares mutations and terminates",
        code: 'let first = {};\nconst second = first;\nfirst = second;\nsecond.status = "draft";\nexpectPrimitive(first.status, "closed:\\"draft\\"");',
      },
      {
        name: "an uncertain alias mutation keeps a finite candidate open",
        code: 'const original = { status: runtimeStatus() };\nconst alias = enabled ? original : runtimeObject();\nalias.status = "draft";\nexpectPrimitive(original.status, "open:\\"draft\\"");',
      },
      {
        name: "a statically selected alias only shares mutation with its selected source",
        code: 'const original = { status: runtimeStatus() };\nconst replacement = { status: "replacement" };\nconst enabled = true;\nconst alias = enabled ? original : replacement;\nalias.status = "draft";\nexpectPrimitive(original.status, "closed:\\"draft\\"");\nexpectPrimitive(replacement.status, "closed:\\"replacement\\"");',
      },
      {
        name: "an uncertain alias mutation preserves its opaque route origin",
        code: 'import { REGISTERED } from "@mst/registered";\nimport { UNREGISTERED } from "./unregistered.ts";\nconst original = { statuses: REGISTERED };\nconst alias = enabled ? original : runtimeObject();\nalias.statuses = UNREGISTERED;\nexpectOrigin(original.statuses, "open:REGISTERED,UNREGISTERED");',
      },
      {
        name: "an unknown computed alias cannot hide an opaque route mutation",
        code: 'import { REGISTERED } from "@mst/registered";\nimport { UNREGISTERED } from "./unregistered.ts";\nconst original = { statuses: REGISTERED };\nconst holder = {};\nholder[runtimeKey()] = original;\nholder.reference.statuses = UNREGISTERED;\nexpectOrigin(original.statuses, "open:REGISTERED,UNREGISTERED");',
      },
      {
        name: "the last static computed property wins",
        code: 'const key = "statuses";\nconst source = { statuses: runtime(), [key]: ["draft", "published"] };\nexpectOrigin(source.statuses, "closed:[\\"draft\\", \\"published\\"]");',
      },
      {
        name: "an unknown trailing computed property keeps an earlier candidate open",
        code: 'const source = { draft: "draft", [runtimeKey()]: runtime() };\nexpectPrimitive(source.draft, "open:\\"draft\\"");',
      },
      {
        name: "an unknown trailing spread invalidates an earlier property",
        code: 'const source = { draft: "draft", ...runtime() };\nexpectPrimitive(source.draft, "open:");',
      },
      {
        name: "a null spread leaves an earlier property intact",
        code: 'const source = { draft: "draft", ...null };\nexpectPrimitive(source.draft, "closed:\\"draft\\"");',
      },
      {
        name: "an array spread resolves an index beyond zero",
        code: 'const source = [null, ...[["draft", "published"]]];\nexpectOrigin(source[1], "closed:[\\"draft\\", \\"published\\"]");',
      },
      {
        name: "an array rest binding resolves a later scalar index",
        code: 'const [, ...rest] = [null, "draft"];\nexpectPrimitive(rest[0], "closed:\\"draft\\"");',
      },
      {
        name: "object destructuring resolves a scalar property",
        code: 'const { draft } = { draft: "draft" };\nexpectPrimitive(draft, "closed:\\"draft\\"");',
      },
      {
        name: "array destructuring resolves through a spread",
        code: 'const [, draft] = [null, ...["draft"]];\nexpectPrimitive(draft, "closed:\\"draft\\"");',
      },
      {
        name: "an object rest binding preserves a non-excluded property",
        code: 'const { skip, ...rest } = { skip: "skip", draft: "draft" };\nexpectPrimitive(rest.draft, "closed:\\"draft\\"");',
      },
      {
        name: "a destructuring default replaces an absent property",
        code: 'const { draft = "draft" } = {};\nexpectPrimitive(draft, "closed:\\"draft\\"");',
      },
      {
        name: "a destructuring default replaces an undefined property",
        code: 'const { draft = "draft" } = { draft: undefined };\nexpectPrimitive(draft, "closed:\\"draft\\"");',
      },
      {
        name: "a destructuring default does not replace a defined property",
        code: 'const { draft = "draft" } = { draft: "published" };\nexpectPrimitive(draft, "closed:\\"published\\"");',
      },
      {
        name: "a later direct assignment replaces an earlier binding state",
        code: 'let status = runtime();\nstatus = "draft";\nexpectPrimitive(status, "closed:\\"draft\\"");',
      },
      {
        name: "a direct member assignment introduces a primitive",
        code: 'const source = {};\nsource.draft = "draft";\nexpectPrimitive(source.draft, "closed:\\"draft\\"");',
      },
      {
        name: "a statically computed member assignment introduces a primitive",
        code: 'const source = {};\nconst key = "draft";\nsource[key] = "draft";\nexpectPrimitive(source.draft, "closed:\\"draft\\"");',
      },
      {
        name: "destructuring into a member introduces a primitive",
        code: 'const source = {};\n[source.draft] = ["draft"];\nexpectPrimitive(source.draft, "closed:\\"draft\\"");',
      },
      {
        name: "a later runtime assignment invalidates an earlier primitive",
        code: 'let status = "draft";\nstatus = runtime();\nexpectPrimitive(status, "open:");',
      },
      {
        name: "a conditional assignment joins the earlier binding state",
        code: 'let status = "published";\nif (enabled) status = "draft";\nexpectPrimitive(status, "closed:\\"draft\\",\\"published\\"");',
      },
      {
        name: "a self member assignment reads the state before its own write",
        code: 'const source = { draft: "draft" };\nsource.draft = source.draft;\nexpectPrimitive(source.draft, "closed:\\"draft\\"");',
      },
      {
        name: "a statically unreachable member write is ignored",
        code: 'const source = { draft: "draft" };\nif (false) source.draft = runtime();\nexpectPrimitive(source.draft, "closed:\\"draft\\"");',
      },
      {
        name: "a write in an uncalled function does not contaminate program state",
        code: 'const source = { draft: "draft" };\nfunction mutate() { source[runtimeKey()] = runtime(); }\nexpectPrimitive(source.draft, "closed:\\"draft\\"");',
      },
      {
        name: "a called function declaration contributes a possible write",
        code: 'let status = "draft";\nfunction mutate() { status = "published"; }\nmutate();\nexpectPrimitive(status, "closed:\\"draft\\",\\"published\\"");',
      },
      {
        name: "a called function expression contributes a possible write",
        code: 'const source = { status: "draft" };\nconst mutate = function () { source.status = "published"; };\nmutate();\nexpectPrimitive(source.status, "closed:\\"draft\\",\\"published\\"");',
      },
      {
        name: "an immediately invoked function contributes a possible write",
        code: 'const source = { status: "draft" };\n(() => { source.status = "published"; })();\nexpectPrimitive(source.status, "closed:\\"draft\\",\\"published\\"");',
      },
      {
        name: "a statically unreachable call does not propagate its function writes",
        code: 'const source = { status: "draft" };\nfunction mutate() { source.status = "published"; }\nif (false) mutate();\nexpectPrimitive(source.status, "closed:\\"draft\\"");',
      },
      {
        name: "execution reports a statically unreachable expression",
        code: 'if (false) { expectExecution(marker, "definite:skipped"); }',
      },
      {
        name: "execution reports a guarded expression as possible",
        code: 'if (enabled) { expectExecution(marker, "possible:executes"); }',
      },
      {
        name: "a same-context unknown member write invalidates an earlier property",
        code: 'const source = { draft: "draft" };\nsource[runtimeKey()] = runtime();\nexpectPrimitive(source.draft, "open:");',
      },
      {
        name: "an unknown branch retains every finite primitive candidate",
        code: 'const status = enabled ? "draft" : "published";\nexpectPrimitive(status, "closed:\\"draft\\",\\"published\\"");',
      },
      {
        name: "an unknown branch marks a known primitive candidate open",
        code: 'const status = enabled ? "draft" : runtime();\nexpectPrimitive(status, "open:\\"draft\\"");',
      },
      {
        name: "an outer declaration is visible in a nested execution context",
        code: 'const status = "draft";\nfunction inspect() { expectPrimitive(status, "closed:\\"draft\\""); }',
      },
      {
        name: "every outer write remains possible in a nested execution context",
        code: 'let status = "draft";\nstatus = "published";\nfunction inspect() { expectPrimitive(status, "closed:\\"draft\\",\\"published\\""); }',
      },
      {
        name: "a parameter default remains a fallback candidate",
        code: 'function inspect(status = "draft") { expectPrimitive(status, "open:\\"draft\\""); }',
      },
      {
        name: "a for of target receives every static iterable candidate",
        code: 'for (const status of ["draft", "published"]) { expectPrimitive(status, "closed:\\"draft\\",\\"published\\""); }',
      },
      {
        name: "a for of target resolves an aliased static iterable",
        code: 'const statuses = ["draft", "published"];\nfor (const status of statuses) { expectPrimitive(status, "closed:\\"draft\\",\\"published\\""); }',
      },
      {
        name: "a for in target receives every static property key",
        code: 'for (const status in { draft: true, published: true }) { expectPrimitive(status, "closed:\\"draft\\",\\"published\\""); }',
      },
      {
        name: "an update invalidates a static binding value",
        code: 'let status = "draft";\nstatus++;\nexpectPrimitive(status, "open:");',
      },
      {
        name: "delete records an absent member value",
        code: 'const source = { draft: "draft" };\ndelete source.draft;\nexpectOrigin(source.draft, "closed:absent");',
      },
      {
        name: "a named import remains an opaque origin",
        code: 'import { STATUSES } from "./vocabulary.ts";\nexpectOrigin(STATUSES, "closed:STATUSES");',
      },
      {
        name: "a namespace import preserves its property projection",
        code: 'import * as vocabulary from "./vocabulary.ts";\nexpectOrigin(vocabulary.STATUSES, "closed:vocabulary|property:STATUSES");',
      },
    ],
    invalid: [],
  });
});
