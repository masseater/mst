import { testLintRule, type WorkspaceLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { createDontReviewItRule } from "../../../create-rule.ts";
import {
  buildCatalog,
  EMPTY_CANONICAL_VALUES_CATALOG,
  type CanonicalValuesCatalog,
} from "../lib/canonical-values/catalog.ts";
import { fingerprintValues } from "../lib/canonical-values/fingerprint.ts";
import { createCanonicalValueBindingIndex } from "./canonical-value-binding-index.ts";
import { createCanonicalValueDomainResolver } from "./canonical-value-domain.ts";
import { createCanonicalValueRuntimeState } from "./canonical-value-invocation.ts";
import { testRouteClassifier } from "./canonical-value-rule-test-fixture.ts";
import { createCanonicalValueStaticSink } from "./canonical-value-static-sink.ts";
import { createCanonicalValueTypeOriginIndex } from "./canonical-value-type-origin.ts";

import type { ESTree } from "@oxlint/plugins";
import type { CanonicalValueReporter } from "./canonical-value-report.ts";

const REGISTERED_CATALOG = buildCatalog([
  {
    annotationStart: 0,
    binding: "BASE",
    bindingStart: 1,
    conceptId: "static-sink-base",
    declarationEnd: 2,
    declarationPath: "packages/static-sink-vocabulary/src/base.ts",
    declarationStart: 1,
    fingerprint: fingerprintValues(["alpha", "omega", "zeta"]),
    importRoutes: [
      {
        exportName: "BASE",
        resolvedSourcePaths: ["packages/static-sink-vocabulary/src/index.ts"],
        specifier: "@mst/static-sink-vocabulary",
      },
    ],
    packageName: "@mst/static-sink-vocabulary",
    values: ["alpha", "omega", "zeta"],
  },
]);

const createStaticSinkRule = (catalog: CanonicalValuesCatalog): WorkspaceLintRule =>
  createDontReviewItRule({
    name: "canonical-value-static-sink-test",
    meta: {
      type: "problem",
      docs: { description: "Exercise canonical value static sinks", relatedGuidelines: [] },
      messages: {
        importRoute: "unregistered import route",
        ownedVocabulary: "owned vocabulary",
        vocabulary: "unconditional vocabulary",
      },
      schema: [],
    },
    create(context) {
      const bindingIndex = createCanonicalValueBindingIndex(context.sourceCode);
      const { invocationState, propertyState } = createCanonicalValueRuntimeState(bindingIndex);
      const reporter: CanonicalValueReporter = {
        catalog,
        reportImportRoute: (occurrence) => {
          context.report({ data: {}, messageId: "importRoute", node: occurrence.node });
        },
        reportVocabulary: (occurrence, options) => {
          context.report({
            data: {},
            messageId: options.onlyWhenOwned ? "ownedVocabulary" : "vocabulary",
            node: occurrence.node,
          });
        },
        repositoryRoot: context.cwd,
      };
      const domain = createCanonicalValueDomainResolver({
        bindingIndex,
        catalog,
        classifyImportedRoute: testRouteClassifier,
        filename: context.filename,
        invocationState,
        propertyState,
        repositoryRoot: context.cwd,
      });
      const typeOrigins = createCanonicalValueTypeOriginIndex({
        bindingIndex,
        propertyState,
        sourceCode: context.sourceCode,
      });
      const staticSink = createCanonicalValueStaticSink({
        bindingIndex,
        domain,
        filename: context.filename,
        invocationState,
        propertyState,
        reporter,
        typeOrigins,
      });

      return {
        AssignmentExpression(node: ESTree.AssignmentExpression) {
          bindingIndex.recordAssignment(node);
          staticSink.recordAssignment(node);
        },
        CallExpression(node: ESTree.CallExpression) {
          bindingIndex.recordCallExpression(node);
          staticSink.recordCall(node);
        },
        ObjectExpression(node: ESTree.ObjectExpression) {
          staticSink.recordObject(node);
        },
        TSTypeAliasDeclaration(node: ESTree.TSTypeAliasDeclaration) {
          staticSink.recordTypeAlias(node);
        },
        TSIndexedAccessType(node: ESTree.TSIndexedAccessType) {
          staticSink.recordIndexedAccess(node);
        },
        VariableDeclarator(node: ESTree.VariableDeclarator) {
          bindingIndex.recordVariableDeclarator(node);
        },
        "Program:exit"() {
          staticSink.evaluate();
        },
      };
    },
  });

describe("canonical value static sinks", () => {
  testLintRule(createStaticSinkRule(EMPTY_CANONICAL_VALUES_CATALOG), {
    valid: [
      {
        name: "a Boolean literal union is not a finite vocabulary",
        code: "export type Enabled = true | false;",
      },
      {
        name: "an object whose final enum value is dynamic stays unresolved",
        code: 'export const schema = { enum: ["draft", "published"], enum: runtimeValues() };',
      },
      {
        name: "a statically unreachable enum assignment does not create a vocabulary",
        code: 'const schema = {};\nif (false) schema.enum = ["draft", "published"];',
      },
      {
        name: "an indexed access over an external package is not a repository vocabulary",
        code: 'import { METHODS } from "http-methods";\nexport type Method = (typeof METHODS)[number];',
        filename: "/repo/packages/example/src/method.ts",
        cwd: "/repo",
      },
    ],
    invalid: [
      {
        name: "a literal union type alias is an unconditional sink",
        code: 'export type Status = "draft" | "published";',
        errors: [{ messageId: "vocabulary" }],
      },
      {
        name: "a local indexed access is an owned-only sink",
        code: 'const STATUSES = ["draft", "published"] as const;\nexport type Status = (typeof STATUSES)[number];',
        errors: [{ messageId: "ownedVocabulary" }],
      },
      {
        name: "a forward type alias is available when indexed access sinks are evaluated",
        code: 'const STATUSES = ["draft", "published"] as const;\nexport type Status = Values[number];\ntype Values = typeof STATUSES;',
        errors: [{ messageId: "ownedVocabulary" }],
      },
      {
        name: "a forward generic type alias is available when indexed access sinks are evaluated",
        code: 'const STATUSES = ["draft", "published"] as const;\nexport type Status = Identity<typeof STATUSES>[number];\ntype Identity<Value> = Value;',
        errors: [{ messageId: "ownedVocabulary" }],
      },
      {
        name: "a JSON Schema enum object is unconditional",
        code: 'export const schema = { enum: ["draft", "published"] };',
        errors: [{ messageId: "vocabulary" }],
      },
      {
        name: "a statically computed JSON Schema enum key is recognized",
        code: 'const key = "enum";\nexport const schema = { [key]: ["draft", "published"] };',
        errors: [{ messageId: "vocabulary" }],
      },
      {
        name: "a direct JSON Schema enum assignment is unconditional",
        code: 'const schema = {};\nschema.enum = ["draft", "published"];',
        errors: [{ messageId: "vocabulary" }],
      },
      {
        name: "a computed JSON Schema enum assignment is recognized",
        code: 'const schema = {};\nconst key = "enum";\nschema[key] = ["draft", "published"];',
        errors: [{ messageId: "vocabulary" }],
      },
      {
        name: "array destructuring preserves the JSON Schema enum source",
        code: 'const schema = {};\n[schema.enum] = [["draft", "published"]];',
        errors: [{ messageId: "vocabulary" }],
      },
      {
        name: "array rest assignment preserves the JSON Schema enum source",
        code: 'const schema = {};\n[...schema.enum] = ["draft", "published"];',
        errors: [{ messageId: "vocabulary" }],
      },
      {
        name: "object destructuring preserves the JSON Schema enum source",
        code: 'const schema = {};\n({ statuses: schema.enum } = { statuses: ["draft", "published"] });',
        errors: [{ messageId: "vocabulary" }],
      },
      {
        name: "Reflect.set preserves the JSON Schema enum source",
        code: 'const schema = {};\nReflect.set(schema, "enum", ["draft", "published"]);',
        errors: [{ messageId: "vocabulary" }],
      },
      {
        name: "Object.defineProperty preserves the JSON Schema enum source",
        code: 'const schema = {};\nObject.defineProperty(schema, "enum", { value: ["draft", "published"] });',
        errors: [{ messageId: "vocabulary" }],
      },
      {
        name: "Object.defineProperties preserves the JSON Schema enum source",
        code: 'const schema = {};\nObject.defineProperties(schema, { enum: { value: ["draft", "published"] } });',
        errors: [{ messageId: "vocabulary" }],
      },
      {
        name: "Reflect.defineProperty preserves the JSON Schema enum source",
        code: 'const schema = {};\nReflect.defineProperty(schema, "enum", { value: ["draft", "published"] });',
        errors: [{ messageId: "vocabulary" }],
      },
      {
        name: "an indexed relative import remains an unregistered route",
        code: 'import { STATUSES } from "./statuses.ts";\nexport type Status = (typeof STATUSES)[number];',
        filename: "/repo/packages/example/src/status.ts",
        cwd: "/repo",
        errors: [{ messageId: "importRoute" }],
      },
      {
        name: "destructuring cannot hide an unregistered JSON Schema enum source",
        code: 'import * as shadow from "./shadow.ts";\nconst schema = {};\n[schema.enum] = [shadow.STATUSES];',
        filename: "/repo/packages/example/src/status.ts",
        cwd: "/repo",
        errors: [{ messageId: "importRoute" }],
      },
    ],
  });
});

describe("canonical value static sinks with a registered route", () => {
  testLintRule(createStaticSinkRule(REGISTERED_CATALOG), {
    valid: [
      {
        name: "a registered indexed access remains derived",
        code: 'import { BASE } from "@mst/static-sink-vocabulary";\nexport type Status = (typeof BASE)[number];',
        filename: "/repo/packages/example/src/status.ts",
        cwd: "/repo",
      },
      {
        name: "an identity array rest over a registered route remains derived",
        code: 'import { BASE } from "@mst/static-sink-vocabulary";\nconst [...COPY] = BASE;\nexport type Status = (typeof COPY)[number];',
        filename: "/repo/packages/example/src/status.ts",
        cwd: "/repo",
      },
      {
        name: "a direct TypeScript import type keeps its registered route",
        code: 'export type Status = (typeof import("@mst/static-sink-vocabulary").BASE)[number];',
        filename: "/repo/packages/example/src/status.ts",
        cwd: "/repo",
      },
    ],
    invalid: [
      {
        name: "local values added to a registered indexed access are unconditional",
        code: 'import { BASE } from "@mst/static-sink-vocabulary";\nconst ALL = [...BASE, "gamma"] as const;\nexport type Status = (typeof ALL)[number];',
        filename: "/repo/packages/example/src/status.ts",
        cwd: "/repo",
        errors: [{ messageId: "vocabulary" }],
      },
      {
        name: "a named registered route projected to an array tail becomes local",
        code: 'import { BASE } from "@mst/static-sink-vocabulary";\nconst [, ...TAIL] = BASE;\nexport type Status = (typeof TAIL)[number];',
        filename: "/repo/packages/example/src/status.ts",
        cwd: "/repo",
        errors: [{ messageId: "vocabulary" }],
      },
      {
        name: "a namespace route projected to an array tail becomes local",
        code: 'import * as vocabulary from "@mst/static-sink-vocabulary";\nconst [, ...TAIL] = vocabulary.BASE;\nexport type Status = (typeof TAIL)[number];',
        filename: "/repo/packages/example/src/status.ts",
        cwd: "/repo",
        errors: [{ messageId: "vocabulary" }],
      },
      {
        name: "a nested forward alias shadows its outer registered alias lexically",
        code: 'import { BASE } from "@mst/static-sink-vocabulary";\ntype Values = typeof BASE;\nfunction useLocal() {\n  const LOCAL = ["draft", "published"] as const;\n  type Status = Values[number];\n  type Values = typeof LOCAL;\n}\nexport type Outside = Values[number];',
        filename: "/repo/packages/example/src/status.ts",
        cwd: "/repo",
        errors: [{ messageId: "ownedVocabulary" }],
      },
      {
        name: "a nested forward generic alias resolves in its lexical scope",
        code: 'function useLocal() {\n  const LOCAL = ["draft", "published"] as const;\n  type Status = Identity<typeof LOCAL>[number];\n  type Identity<Value> = Value;\n}',
        filename: "/repo/packages/example/src/status.ts",
        cwd: "/repo",
        errors: [{ messageId: "ownedVocabulary" }],
      },
      {
        name: "a direct TypeScript import type cannot hide an unregistered route",
        code: 'export type Status = (typeof import("@mst/static-sink-vocabulary/shadow").BASE)[number];',
        filename: "/repo/packages/example/src/status.ts",
        cwd: "/repo",
        errors: [{ messageId: "importRoute" }],
      },
    ],
  });
});
