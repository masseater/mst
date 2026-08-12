import { createDontReviewItRule } from "../../../create-rule.ts";
import {
  objectPropertyOf,
  objectValueOf,
  propertyKeyOf,
  removeObjectPropertyFix,
} from "../lib/object-literal.ts";
import {
  resolveTestConfig,
  staticallyClosedObject,
  staticObjectPathAt,
  staticTestTaskAt,
  type StaticObjectResolution,
  type TestConfigResolution,
} from "../lib/static-test-config.ts";
import { unwrapTransparentExpression } from "../lib/transparent-expression.ts";

import type { ESTree, FixFn, Options, SourceCode } from "@oxlint/plugins";

const DEFAULT_PRODUCTION_SOURCE_PATTERN = "src/**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}";

type DeclaredPattern = {
  readonly node: ESTree.StringLiteral;
  readonly value: string;
};

const requiredPatternsFrom = (options: Readonly<Options>): readonly string[] => {
  const [first] = options as readonly { readonly include?: readonly string[] }[];
  return first?.include ?? [DEFAULT_PRODUCTION_SOURCE_PATTERN];
};

const declaredPatternOf = (
  element: ESTree.Expression | ESTree.SpreadElement | null,
): DeclaredPattern | null => {
  if (element === null || element.type === "SpreadElement") return null;
  const unwrapped = unwrapTransparentExpression(element);
  if (unwrapped.type !== "Literal" || typeof unwrapped.value !== "string") return null;
  return { node: unwrapped, value: unwrapped.value };
};

const declaredPatternsOf = (
  expression: ESTree.ArrayExpression | null,
): readonly DeclaredPattern[] | null => {
  if (expression === null) return [];
  const patterns = expression.elements.map(declaredPatternOf);
  return patterns.every((pattern): pattern is DeclaredPattern => pattern !== null)
    ? patterns
    : null;
};

const declaredCoverageOf = (
  coverage: ESTree.ObjectExpression,
): {
  readonly include: ESTree.ArrayExpression | null;
  readonly patterns: readonly DeclaredPattern[];
} | null => {
  const include = objectValueOf({ object: coverage, key: "include" });
  const unwrapped = include === null ? null : unwrapTransparentExpression(include);
  if (unwrapped !== null && unwrapped.type !== "ArrayExpression") return null;
  const patterns = declaredPatternsOf(unwrapped);
  return patterns === null ? null : { include: unwrapped, patterns };
};

type ChangedSetting =
  | { readonly kind: "absent-or-disabled" }
  | { readonly kind: "dynamic"; readonly property: ESTree.ObjectProperty }
  | {
      readonly kind: "enabled";
      readonly fixable: boolean;
      readonly property: ESTree.ObjectProperty;
    };

const changedValueKindOf = (expression: ESTree.Expression): "disabled" | "dynamic" | "enabled" => {
  const changedExpression = unwrapTransparentExpression(expression);
  if (changedExpression.type !== "Literal") return "dynamic";
  if (changedExpression.value === false || changedExpression.value === "") return "disabled";
  return changedExpression.value === true || typeof changedExpression.value === "string"
    ? "enabled"
    : "dynamic";
};

const changedSettingOf = (object: ESTree.ObjectExpression): ChangedSetting => {
  const properties = object.properties.filter(
    (property): property is ESTree.ObjectProperty =>
      property.type === "Property" && propertyKeyOf(property) === "changed",
  );
  const property = properties.at(-1);
  if (property === undefined) return { kind: "absent-or-disabled" };
  const kind = changedValueKindOf(property.value);
  if (kind === "disabled") return { kind: "absent-or-disabled" };
  if (kind === "dynamic") return { kind, property };
  const previous = properties.at(-2);
  return {
    kind,
    property,
    fixable: previous === undefined || changedValueKindOf(previous.value) === "disabled",
  };
};

const changedProblemFor = ({
  setting,
  sourceCode,
}: {
  readonly setting: ChangedSetting;
  readonly sourceCode: SourceCode;
}): {
  readonly node: ESTree.ObjectProperty;
  readonly messageId: "changedCoverageSourceUniverse" | "dynamicChangedCoverageSourceUniverse";
  readonly fix?: FixFn;
} | null => {
  if (setting.kind === "absent-or-disabled") return null;
  if (setting.kind === "dynamic") {
    return { node: setting.property, messageId: "dynamicChangedCoverageSourceUniverse" };
  }
  return {
    node: setting.property,
    messageId: "changedCoverageSourceUniverse",
    fix: setting.fixable
      ? removeObjectPropertyFix({ property: setting.property, sourceCode })
      : undefined,
  };
};

const changedProblemOf = (
  object: ESTree.ObjectExpression,
  sourceCode: SourceCode,
): ReturnType<typeof changedProblemFor> =>
  changedProblemFor({ setting: changedSettingOf(object), sourceCode });

const coverageBoundaryProblemsOf = (
  coverage: ESTree.ObjectExpression,
): readonly {
  readonly node: ESTree.ObjectProperty;
  readonly messageId: "excludedCoverageSource";
}[] => {
  const excluded = objectPropertyOf({ object: coverage, key: "exclude" });
  return excluded === null ? [] : [{ node: excluded, messageId: "excludedCoverageSource" }];
};

const renderedPatterns = (patterns: readonly string[]): string =>
  patterns.map((pattern) => JSON.stringify(pattern)).join(", ");

const appendPatternsFix = ({
  include,
  patterns,
  sourceCode,
}: {
  readonly include: ESTree.ArrayExpression;
  readonly patterns: string;
  readonly sourceCode: SourceCode;
}): FixFn => {
  const lastElement = include.elements.findLast((element) => element !== null);
  if (lastElement !== undefined) {
    return (fixer) => fixer.insertTextAfter(lastElement, `, ${patterns}`);
  }
  const source = sourceCode.getText(include);
  return (fixer) => fixer.replaceText(include, `${source.slice(0, -1)}${patterns}]`);
};

const addIncludePropertyFix = ({
  coverage,
  patterns,
  sourceCode,
}: {
  readonly coverage: ESTree.ObjectExpression;
  readonly patterns: string;
  readonly sourceCode: SourceCode;
}): FixFn => {
  const includeProperty = `include: [${patterns}]`;
  const lastProperty = coverage.properties.at(-1);
  if (lastProperty !== undefined) {
    return (fixer) => fixer.insertTextAfter(lastProperty, `, ${includeProperty}`);
  }
  const source = sourceCode.getText(coverage);
  return (fixer) => fixer.replaceText(coverage, `${source.slice(0, -1)}${includeProperty}}`);
};

const includeFixFor = ({
  coverage,
  include,
  missingPatterns,
  sourceCode,
}: {
  readonly coverage: ESTree.ObjectExpression;
  readonly include: ESTree.ArrayExpression | null;
  readonly missingPatterns: readonly string[];
  readonly sourceCode: SourceCode;
}): FixFn => {
  const patterns = renderedPatterns(missingPatterns);
  return include === null
    ? addIncludePropertyFix({ coverage, patterns, sourceCode })
    : appendPatternsFix({ include, patterns, sourceCode });
};

export const noPartialCoverageSourceUniverse = createDontReviewItRule({
  name: "no-partial-coverage-source-universe--include-production-files",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every test config to include unimported production files in its coverage source universe and forbid local exclusions from that universe",
      relatedGuidelines: [],
    },
    messages: {
      missingProductionSourcePattern:
        "A coverage source universe must not omit production files. Add `{{pattern}}` to `test.coverage.include`.",
      excludedCoverageSource:
        "Production source must not be removed from the coverage universe with `test.coverage.exclude`. Delete this property and narrow `test.coverage.include` to the source roots that the package owns.",
      dynamicCoverageConfiguration:
        "A coverage source universe must not be assembled from merge calls, variables, spreads, computed properties, or nonliteral include entries. Export one static `defineConfig({...})` object and write every `test.coverage.include` pattern as a string literal.",
      commonJsTestConfig:
        "A CommonJS test config must not sit outside the static coverage guards. Rename this file to `vite.config.ts` or `vitest.config.ts`, import `defineConfig` from Vite, Vite Plus, or `vitest/config`, and export one ESM `defineConfig({...})` object as the default.",
      testTaskBypassesCoverageGuard:
        "A `run.tasks.test` task must not provide a second test entrypoint outside the package-script guard. Delete this task and put `spool -- vp test` in `package.json#scripts.test`, so test config and coverage command overrides are inspected before execution.",
      dynamicTestTaskConfiguration:
        "A Vite task configuration must not hide a test entrypoint behind variables, spreads, or computed properties. Write `run.tasks` as one static object, delete its `test` task, and put `spool -- vp test` in `package.json#scripts.test`.",
      negatedCoveragePattern:
        "A coverage include pattern must not subtract files from the production source universe. Delete `{{pattern}}` and keep every owned production file inside a positive include pattern.",
      changedCoverageSourceUniverse:
        "A test config must not reduce the coverage source universe with `test.changed: true`, a non-empty changed ref, or the equivalent `test.coverage.changed` value. Delete this property so every production file declared by `test.coverage.include` remains in the coverage gate.",
      dynamicChangedCoverageSourceUniverse:
        "A dynamic `test.changed` or `test.coverage.changed` value must not leave the coverage source universe indeterminate. Move any required side effect into a separate statement, then delete this property or replace it with literal `false` or an empty string.",
    },
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          include: {
            type: "array",
            items: { type: "string", minLength: 1, pattern: "^[^!]" },
            minItems: 1,
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const requiredPatterns = requiredPatternsFrom(context.options);
    const reportMissingPatterns = ({
      coverage,
      include,
      declaredPatterns,
    }: {
      readonly coverage: ESTree.ObjectExpression;
      readonly include: ESTree.ArrayExpression | null;
      readonly declaredPatterns: readonly DeclaredPattern[];
    }): void => {
      const declaredValues = declaredPatterns.map(({ value }) => value);
      const missingPatterns = requiredPatterns.filter(
        (pattern) => !declaredValues.includes(pattern),
      );
      const includeFix = includeFixFor({
        coverage,
        include,
        missingPatterns,
        sourceCode: context.sourceCode,
      });
      missingPatterns.forEach((pattern, index) => {
        context.report({
          node: coverage,
          messageId: "missingProductionSourcePattern",
          data: { pattern },
          fix: index === 0 ? includeFix : undefined,
        });
      });
    };
    const reportMissingCoverage = (node: ESTree.Program): void => {
      for (const pattern of requiredPatterns) {
        context.report({
          node,
          messageId: "missingProductionSourcePattern",
          data: { pattern },
        });
      }
    };
    const reportNegatedPatterns = (declaredPatterns: readonly DeclaredPattern[]): void => {
      for (const pattern of declaredPatterns) {
        if (!pattern.value.startsWith("!")) continue;
        context.report({
          node: pattern.node,
          messageId: "negatedCoveragePattern",
          data: { pattern: pattern.value },
        });
      }
    };
    const inspectCoverage = (coverage: ESTree.ObjectExpression): void => {
      const declared = declaredCoverageOf(coverage);
      if (declared === null) {
        context.report({ node: coverage, messageId: "dynamicCoverageConfiguration" });
        return;
      }
      reportNegatedPatterns(declared.patterns);
      reportMissingPatterns({
        coverage,
        include: declared.include,
        declaredPatterns: declared.patterns,
      });
      const changedProblem = changedProblemOf(coverage, context.sourceCode);
      if (changedProblem !== null) context.report(changedProblem);
      for (const problem of coverageBoundaryProblemsOf(coverage)) {
        context.report(problem);
      }
    };
    const inspectResolvedCoverage = (
      coverage: StaticObjectResolution,
      node: ESTree.Program,
    ): void => {
      if (coverage.kind === "dynamic") {
        context.report({ node, messageId: "dynamicCoverageConfiguration" });
        return;
      }
      if (coverage.kind === "missing") {
        reportMissingCoverage(node);
        return;
      }
      inspectCoverage(coverage.object);
    };
    const inspectTestTask = (config: ESTree.ObjectExpression, node: ESTree.Program): void => {
      const task = staticTestTaskAt(config);
      if (task.kind === "dynamic") {
        context.report({ node, messageId: "dynamicTestTaskConfiguration" });
      }
      if (task.kind === "present") {
        context.report({ node: task.property, messageId: "testTaskBypassesCoverageGuard" });
      }
    };
    const inspectStaticConfig = (config: ESTree.ObjectExpression, node: ESTree.Program): void => {
      const closed = staticallyClosedObject({ kind: "static", object: config });
      if (closed.kind !== "static") {
        inspectResolvedCoverage(closed, node);
        return;
      }
      inspectTestTask(closed.object, node);
      const test = staticObjectPathAt({ object: closed.object, path: ["test"] });
      const changedProblem =
        test.kind === "static" ? changedProblemOf(test.object, context.sourceCode) : null;
      if (changedProblem !== null) context.report(changedProblem);
      inspectResolvedCoverage(
        staticallyClosedObject(
          staticObjectPathAt({ object: closed.object, path: ["test", "coverage"] }),
        ),
        node,
      );
    };
    const inspectResolvedConfig = (resolved: TestConfigResolution, node: ESTree.Program): void => {
      if (resolved.kind === "not-test-config") return;
      if (resolved.kind === "commonjs") {
        context.report({ node, messageId: "commonJsTestConfig" });
        return;
      }
      if (resolved.kind === "dynamic") {
        context.report({ node, messageId: "dynamicCoverageConfiguration" });
        return;
      }
      inspectStaticConfig(resolved.config, node);
    };
    return {
      Program(node: ESTree.Program) {
        inspectResolvedConfig(
          resolveTestConfig({ filename: context.filename, program: node }),
          node,
        );
      },
    };
  },
});
