import { createDontReviewItRule } from "../../../../create-rule.ts";
import { nodesOfType } from "../../lib/nodes-of-type.ts";
import { propertyKeyOf } from "../../lib/object-literal.ts";
import { standardIoFixtureLocalNameOf } from "../../lib/standard-io-fixture.ts";
import { staticMemberOf } from "../../lib/static-member.ts";
import { PROCESS_IO_MEMBER } from "../mutation-and-failure/no-logged-and-continued-failure--stop-or-recover.ts";

import type { ESTree } from "@oxlint/plugins";
import type { NamedReport } from "../../lib/named-report.ts";

const TEST_FILE_SUFFIXES = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"];

type NamedStreamProperty = {
  readonly property: ESTree.ObjectProperty;
  readonly streamName: string;
};

const CAPTURED_STREAM_NAMES = new Set(["stdout", "stderr"]);

const capturedStreamPropertiesOf = (
  definition: ESTree.ObjectExpression,
): readonly NamedStreamProperty[] =>
  definition.properties.flatMap((property): readonly NamedStreamProperty[] => {
    if (property.type !== "Property") return [];
    const streamName = propertyKeyOf(property);
    if (streamName === null || !CAPTURED_STREAM_NAMES.has(streamName)) return [];
    return [{ property, streamName }];
  });

const isExtendCall = (callee: ESTree.Expression): boolean =>
  staticMemberOf(callee)?.name === "extend";

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
  return capturedStreamPropertiesOf(definition).map(({ property, streamName }) => ({
    node: property,
    messageId: "ownFixture",
    data: { name: streamName },
  }));
};

const directStreamReportOf = (node: ESTree.MemberExpression): NamedReport | null => {
  const member = staticMemberOf(node);
  if (member === null) return null;
  if (member.object.type !== "Identifier" || member.object.name !== "process") return null;
  if (!CAPTURED_STREAM_NAMES.has(member.name)) return null;
  return { node, messageId: "directStream", data: { name: member.name } };
};

const isFunctionValued = (propertyValue: ESTree.Expression): boolean =>
  propertyValue.type === "FunctionExpression" || propertyValue.type === "ArrowFunctionExpression";

const STREAM_CLASS_NAMES = new Set(["Writable", "Duplex", "Transform", "PassThrough"]);

const isWriteShapedDouble = (propertyValue: ESTree.Expression): boolean => {
  if (propertyValue.type === "NewExpression") {
    return (
      propertyValue.callee.type === "Identifier" &&
      STREAM_CLASS_NAMES.has(propertyValue.callee.name)
    );
  }
  if (propertyValue.type !== "ObjectExpression") return false;
  return propertyValue.properties.some(
    (property) =>
      property.type === "Property" &&
      propertyKeyOf(property) === PROCESS_IO_MEMBER.write &&
      isFunctionValued(property.value),
  );
};

const streamShapedDoubleReportsOf = (node: ESTree.ObjectExpression): readonly NamedReport[] =>
  capturedStreamPropertiesOf(node)
    .filter(({ property }) => isWriteShapedDouble(property.value))
    .map(({ property, streamName }) => ({
      node: property,
      messageId: "streamShapedDouble",
      data: { name: streamName },
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
  create(inspection) {
    if (!TEST_FILE_SUFFIXES.some((suffix) => inspection.filename.endsWith(suffix))) return {};

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
          inspection.report(report);
        }
      },
    };
  },
});
