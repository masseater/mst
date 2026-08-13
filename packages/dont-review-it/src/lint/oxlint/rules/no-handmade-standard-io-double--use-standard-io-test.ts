import { createDontReviewItRule } from "../../../create-rule.ts";
import { propertyKeyOf } from "../lib/object-literal.ts";
import { standardIoFixtureLocalNameOf } from "../lib/standard-io-fixture.ts";
import { staticMemberOf } from "../lib/static-member.ts";
import { PROCESS_IO_MEMBER } from "./no-logged-and-continued-failure--stop-or-recover.ts";

import type { ESTree } from "@oxlint/plugins";

const CAPTURED_STREAM_NAMES = new Set(["stdout", "stderr"]);

const STREAM_CLASS_NAMES = new Set(["Writable", "Duplex", "Transform", "PassThrough"]);

const TEST_FILE_SUFFIXES = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"];

const isExtendCall = (callee: ESTree.Expression): boolean =>
  staticMemberOf(callee)?.name === "extend";

const isFunctionValued = (held: ESTree.Expression): boolean =>
  held.type === "FunctionExpression" || held.type === "ArrowFunctionExpression";

const isWriteShapedDouble = (held: ESTree.Expression): boolean => {
  if (held.type === "NewExpression") {
    return held.callee.type === "Identifier" && STREAM_CLASS_NAMES.has(held.callee.name);
  }
  if (held.type !== "ObjectExpression") return false;
  return held.properties.some(
    (property) =>
      property.type === "Property" &&
      propertyKeyOf(property) === PROCESS_IO_MEMBER.write &&
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
    const spelled = propertyKeyOf(property);
    if (spelled === null || !CAPTURED_STREAM_NAMES.has(spelled)) return [];
    return [{ property, name: spelled }];
  });

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

    const fixtureImports = new Set<string>();

    return {
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        const localName = standardIoFixtureLocalNameOf(node);
        if (localName !== null) fixtureImports.add(localName);
      },
      CallExpression(node: ESTree.CallExpression) {
        if (!isExtendCall(node.callee)) return;
        const [definition] = node.arguments;
        if (
          definition?.type === "Literal" &&
          typeof definition.value === "string" &&
          CAPTURED_STREAM_NAMES.has(definition.value)
        ) {
          inspection.report({
            node: definition,
            messageId: "ownFixture",
            data: { name: definition.value },
          });
          return;
        }
        if (definition?.type !== "ObjectExpression") return;
        for (const { property, name } of capturedStreamPropertiesOf(definition)) {
          inspection.report({ node: property, messageId: "ownFixture", data: { name } });
        }
      },
      MemberExpression(node: ESTree.MemberExpression) {
        if (fixtureImports.size > 0) return;
        const member = staticMemberOf(node);
        if (member === null) return;
        if (member.object.type !== "Identifier" || member.object.name !== "process") return;
        if (!CAPTURED_STREAM_NAMES.has(member.name)) return;
        inspection.report({ node, messageId: "directStream", data: { name: member.name } });
      },
      ObjectExpression(node: ESTree.ObjectExpression) {
        for (const { property, name } of capturedStreamPropertiesOf(node)) {
          if (!isWriteShapedDouble(property.value)) continue;
          inspection.report({ node: property, messageId: "streamShapedDouble", data: { name } });
        }
      },
    };
  },
});
