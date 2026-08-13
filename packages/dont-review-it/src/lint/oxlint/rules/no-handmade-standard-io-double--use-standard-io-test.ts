import { createDontReviewItRule } from "../../../create-rule.ts";
import { nodesOfType } from "../lib/nodes-of-type.ts";
import { propertyKeyOf } from "../lib/object-literal.ts";
import { standardIoFixtureLocalNameOf } from "../lib/standard-io-fixture.ts";
import { staticMemberOf } from "../lib/static-member.ts";

import type { ESTree } from "@oxlint/plugins";
import type { NamedReport } from "../lib/named-report.ts";

const CAPTURED_STREAM_NAMES = new Set(["stdout", "stderr"]);

const STREAM_CLASS_NAMES = new Set(["Writable", "Duplex", "Transform", "PassThrough"]);

const TEST_FILE_SUFFIXES = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"];

const isExtendCall = (callee: ESTree.Expression): boolean =>
  staticMemberOf(callee)?.name === "extend";

const isFunctionValued = (value: ESTree.Expression): boolean =>
  value.type === "FunctionExpression" || value.type === "ArrowFunctionExpression";

const isWriteShapedDouble = (value: ESTree.Expression): boolean => {
  if (value.type === "NewExpression") {
    return value.callee.type === "Identifier" && STREAM_CLASS_NAMES.has(value.callee.name);
  }
  if (value.type !== "ObjectExpression") return false;
  return value.properties.some(
    (property) =>
      property.type === "Property" &&
      propertyKeyOf(property) === "write" &&
      isFunctionValued(property.value),
  );
};

type NamedStreamProperty = {
  readonly property: ESTree.ObjectProperty;
  readonly name: string;
};

const capturedStreamPropertiesOf = (
  definition: ESTree.ObjectExpression,
): readonly NamedStreamProperty[] =>
  definition.properties.flatMap((property): readonly NamedStreamProperty[] => {
    if (property.type !== "Property") return [];
    const name = propertyKeyOf(property);
    if (name === null || !CAPTURED_STREAM_NAMES.has(name)) return [];
    return [{ property, name }];
  });

const ownFixtureReportsOf = (call: ESTree.CallExpression): readonly NamedReport[] => {
  if (!isExtendCall(call.callee)) return [];

  const [definition] = call.arguments;
  if (
    definition?.type === "Literal" &&
    typeof definition.value === "string" &&
    CAPTURED_STREAM_NAMES.has(definition.value)
  ) {
    return [{ node: definition, messageId: "ownFixture", data: { name: definition.value } }];
  }
  if (definition?.type !== "ObjectExpression") return [];
  return capturedStreamPropertiesOf(definition).map(({ property, name }) => ({
    node: property,
    messageId: "ownFixture",
    data: { name },
  }));
};

const directStreamReportOf = (node: ESTree.MemberExpression): NamedReport | null => {
  const member = staticMemberOf(node);
  if (member === null) return null;
  if (member.object.type !== "Identifier" || member.object.name !== "process") return null;
  if (!CAPTURED_STREAM_NAMES.has(member.name)) return null;
  return { node, messageId: "directStream", data: { name: member.name } };
};

const streamShapedDoubleReportsOf = (node: ESTree.ObjectExpression): readonly NamedReport[] =>
  capturedStreamPropertiesOf(node)
    .filter(({ property }) => isWriteShapedDouble(property.value))
    .map(({ property, name }) => ({
      node: property,
      messageId: "streamShapedDouble",
      data: { name },
    }));

export const noHandmadeStandardIoDouble = createDontReviewItRule({
  name: "no-handmade-standard-io-double--use-standard-io-test",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a spec that assembles its own stdout or stderr test double, so stream capture is solved once by the shared `standardIoTest` fixture",
      relatedGuidelines: [],
    },
    messages: {
      ownFixture:
        "A spec must not declare a `{{name}}` fixture of its own. Import `standardIoTest` from `@mst/dont-review-it/vitest` and derive the test from it.",
      directStream:
        "A spec must not reach `process.{{name}}` by hand. Import `standardIoTest` from `@mst/dont-review-it/vitest`; its `{{name}}` fixture hands the captured stream to the test.",
      streamShapedDouble:
        "A spec must not assemble a `{{name}}`-shaped write double. Import `standardIoTest` from `@mst/dont-review-it/vitest` and assert on its `{{name}}` fixture instead.",
    },
    schema: [],
  },
  create(context) {
    if (!TEST_FILE_SUFFIXES.some((suffix) => context.filename.endsWith(suffix))) return {};

    return {
      "Program:exit"(program: ESTree.Program) {
        const importsFixture = nodesOfType(program, "ImportDeclaration").some(
          (node) => standardIoFixtureLocalNameOf(node) !== null,
        );

        const reports = [
          ...nodesOfType(program, "CallExpression").flatMap((call) => ownFixtureReportsOf(call)),
          ...(importsFixture
            ? []
            : nodesOfType(program, "MemberExpression").flatMap(
                (node) => directStreamReportOf(node) ?? [],
              )),
          ...nodesOfType(program, "ObjectExpression").flatMap((node) =>
            streamShapedDoubleReportsOf(node),
          ),
        ];

        for (const report of reports.toSorted(
          (first, second) => first.node.start - second.node.start,
        )) {
          context.report(report);
        }
      },
    };
  },
});
