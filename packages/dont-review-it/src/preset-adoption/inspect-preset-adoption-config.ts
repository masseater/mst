import { parseSync } from "oxc-parser";

import {
  collectBinding,
  newBinding,
  type ImportedTarget,
} from "../lint/oxlint/lib/imported-binding.ts";
import { unwrapTransparentExpression } from "../lint/oxlint/lib/transparent-expression.ts";
import { inspectRuleBlock } from "./disabled-rule-declarations.ts";
import { problemAt } from "./inspection-problem.ts";
import { inspectionProgramOf } from "./inspection-program.ts";
import { inspectOverrides } from "./override-declarations.ts";
import { presetAdoptionProblems } from "./preset-reference.ts";
import {
  allValueImportBindingsIn,
  objectPassedDirectlyTo,
  staticDefaultExportedConfig,
} from "./static-import-reference.ts";
import { staticPropertyAt, uninspectableObjectProblem } from "./static-object-property.ts";

import type { ESTree } from "@oxlint/plugins";
import type { PresetAdoptionConfig } from "./config.ts";
import type { PresetAdoptionInspection, RuleBlockInspection } from "./inspection-types.ts";

const parsedProgram = ({
  source,
  config,
}: {
  readonly source: string;
  readonly config: PresetAdoptionConfig;
}): {
  readonly program: ESTree.Program | null;
  readonly problems: PresetAdoptionInspection["problems"];
} => {
  const parsed = parseSync(config.toolchainConfigFileName, source, { preserveParens: false });
  const [parseError] = parsed.errors;
  if (parseError !== undefined) {
    return {
      program: null,
      problems: [
        problemAt({
          source,
          start: Math.min(source.length, ...parseError.labels.map((label) => label.start)),
          config,
          message: `The toolchain configuration must parse before preset adoption can be inspected: ${parseError.message}`,
        }),
      ],
    };
  }
  return inspectionProgramOf({ held: parsed.program, source, config });
};

const collectImportedTargets = ({
  statement,
  preset,
  wrapper,
  factory,
  config,
}: {
  readonly statement: ESTree.ImportDeclaration;
  readonly preset: ImportedTarget;
  readonly wrapper: ImportedTarget;
  readonly factory: ImportedTarget;
  readonly config: PresetAdoptionConfig;
}): void => {
  if (statement.source.value === config.presetModuleSpecifier) {
    collectBinding(statement, preset);
    collectBinding(statement, wrapper);
  }
  if (statement.source.value === config.toolchainModuleSpecifier) {
    collectBinding(statement, factory);
  }
};

const importedTargetsIn = ({
  program,
  config,
}: {
  readonly program: ESTree.Program;
  readonly config: PresetAdoptionConfig;
}): {
  readonly preset: ImportedTarget;
  readonly wrapper: ImportedTarget;
  readonly factory: ImportedTarget;
} => {
  const preset = { exportedName: config.presetExportName, binding: newBinding() };
  const wrapper = { exportedName: config.lintWrapperExportName, binding: newBinding() };
  const factory = { exportedName: config.configFactoryExportName, binding: newBinding() };
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration") continue;
    collectImportedTargets({ statement, preset, wrapper, factory, config });
  }
  return { preset, wrapper, factory };
};

const inspectOptionalRules = ({
  lint,
  source,
  config,
}: {
  readonly lint: ESTree.ObjectExpression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
}): RuleBlockInspection => {
  const rules = staticPropertyAt({
    object: lint,
    key: config.rulesFieldName,
    source,
    config,
    subject: "The root lint configuration",
  });
  if (rules.kind === "present") {
    return inspectRuleBlock({ written: rules.property.value, source, config });
  }
  return {
    disabledDeclarations: [],
    problems: rules.kind === "problem" ? [rules.problem] : [],
  };
};

const inspectOptionalOverrides = ({
  lint,
  source,
  config,
}: {
  readonly lint: ESTree.ObjectExpression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
}): PresetAdoptionInspection => {
  const overrides = staticPropertyAt({
    object: lint,
    key: config.overridesFieldName,
    source,
    config,
    subject: "The root lint configuration",
  });
  if (overrides.kind === "present") {
    return inspectOverrides({ written: overrides.property.value, source, config });
  }
  return {
    disabledDeclarations: [],
    problems: overrides.kind === "problem" ? [overrides.problem] : [],
  };
};

const inspectLint = ({
  lint,
  source,
  config,
  preset,
  program,
}: {
  readonly lint: ESTree.ObjectExpression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
  readonly preset: ImportedTarget;
  readonly program: ESTree.Program;
}): PresetAdoptionInspection => {
  const uninspectable = uninspectableObjectProblem({
    object: lint,
    source,
    config,
    subject: "The root lint configuration",
  });
  if (uninspectable !== null) {
    return { disabledDeclarations: [], problems: [uninspectable] };
  }
  const adoptionProblems = presetAdoptionProblems({
    lint,
    source,
    config,
    preset,
    valueImports: allValueImportBindingsIn(program),
  });
  const rules = inspectOptionalRules({ lint, source, config });
  const overrides = inspectOptionalOverrides({ lint, source, config });
  return {
    disabledDeclarations: [
      ...rules.disabledDeclarations.map((declaration) => ({
        ...declaration,
        filePatterns: [],
        excludeFilePatterns: [],
        pathReachInspectable: true,
      })),
      ...overrides.disabledDeclarations,
    ],
    problems: [...adoptionProblems, ...rules.problems, ...overrides.problems],
  };
};

const inspectConfiguredObject = ({
  configured,
  program,
  source,
  config,
  preset,
  wrapper,
}: {
  readonly configured: ESTree.ObjectExpression;
  readonly program: ESTree.Program;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
  readonly preset: ImportedTarget;
  readonly wrapper: ImportedTarget;
}): PresetAdoptionInspection => {
  const lintProperty = staticPropertyAt({
    object: configured,
    key: config.lintFieldName,
    source,
    config,
    subject: "The root toolchain configuration",
  });
  if (lintProperty.kind === "problem") {
    return { disabledDeclarations: [], problems: [lintProperty.problem] };
  }
  if (lintProperty.kind === "missing") {
    return {
      disabledDeclarations: [],
      problems: [
        problemAt({
          source,
          start: configured.start,
          config,
          message: `The root toolchain configuration must declare a ${config.lintFieldName} block that directly adopts ${config.presetModuleSpecifier}'s ${config.presetExportName} preset.`,
        }),
      ],
    };
  }
  const written = unwrapTransparentExpression(lintProperty.property.value);
  const lint =
    written.type === "ObjectExpression"
      ? written
      : objectPassedDirectlyTo({ expression: written, target: wrapper });
  if (lint !== null) return inspectLint({ lint, source, config, preset, program });
  return {
    disabledDeclarations: [],
    problems: [
      problemAt({
        source,
        start: written.start,
        config,
        message: `The root lint block must be an object literal or one object literal passed directly to ${config.lintWrapperExportName} statically imported from ${config.presetModuleSpecifier}.`,
      }),
    ],
  };
};

export const inspectPresetAdoptionConfig = ({
  source,
  config,
}: {
  readonly source: string;
  readonly config: PresetAdoptionConfig;
}): PresetAdoptionInspection => {
  const parsed = parsedProgram({ source, config });
  if (parsed.program === null) return { disabledDeclarations: [], problems: parsed.problems };
  const targets = importedTargetsIn({ program: parsed.program, config });
  const configured = staticDefaultExportedConfig({
    program: parsed.program,
    factory: targets.factory,
  });
  if (configured !== null) {
    return inspectConfiguredObject({
      configured,
      program: parsed.program,
      source,
      config,
      preset: targets.preset,
      wrapper: targets.wrapper,
    });
  }
  return {
    disabledDeclarations: [],
    problems: [
      problemAt({
        source,
        start: 0,
        config,
        message: `The toolchain configuration must default-export an object literal directly or pass one directly to ${config.configFactoryExportName} statically imported from ${config.toolchainModuleSpecifier}.`,
      }),
    ],
  };
};
