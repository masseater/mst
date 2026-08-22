import { parseSync } from "oxc-parser";

import {
  collectBinding,
  newBinding,
  type ImportedTarget,
} from "../lint/oxlint/lib/imported-binding.ts";
import { unwrapTransparentExpression } from "../lint/oxlint/lib/transparent-expression.ts";
import { inspectRuleBlock } from "./disabled-rule-declarations.ts";
import { lineAt, problemAt } from "./inspection-problem.ts";
import { inspectionProgramOf } from "./inspection-program.ts";
import { inspectOverrides } from "./override-declarations.ts";
import {
  objectPassedDirectlyToMember,
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
  const parsedConfig = parseSync(config.toolchainConfigFileName, source, { preserveParens: false });
  const [parseError] = parsedConfig.errors;
  if (parseError !== undefined) {
    return {
      program: null,
      problems: [
        problemAt({
          source,
          start: Math.min(
            source.length,
            ...parseError.labels.map((parseLabel) => parseLabel.start),
          ),
          config,
          message: `The toolchain configuration must parse before preset adoption can be inspected: ${parseError.message}`,
        }),
      ],
    };
  }
  return inspectionProgramOf({ held: parsedConfig.program, source, config });
};

const collectImportedTargets = ({
  statement,
  preset,
  factory,
  severityConstant,
  config,
}: {
  readonly statement: ESTree.ImportDeclaration;
  readonly preset: ImportedTarget;
  readonly factory: ImportedTarget;
  readonly severityConstant: ImportedTarget;
  readonly config: PresetAdoptionConfig;
}): void => {
  if (statement.source.value === config.presetModuleSpecifier) {
    collectBinding(statement, preset);
  }
  if (statement.source.value === config.toolchainModuleSpecifier) {
    collectBinding(statement, factory);
  }
  if (statement.source.value === config.severityModuleSpecifier) {
    collectBinding(statement, severityConstant);
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
  readonly factory: ImportedTarget;
  readonly severityConstant: ImportedTarget;
} => {
  const preset = { exportedName: config.presetExportName, binding: newBinding() };
  const factory = { exportedName: config.configFactoryExportName, binding: newBinding() };
  const severityConstant = { exportedName: config.severityExportName, binding: newBinding() };
  for (const statement of program.body) {
    if (statement.type !== "ImportDeclaration") continue;
    collectImportedTargets({ statement, preset, factory, severityConstant, config });
  }
  return { preset, factory, severityConstant };
};

const inspectOptionalRules = ({
  lint,
  source,
  config,
  severityConstant,
}: {
  readonly lint: ESTree.ObjectExpression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
  readonly severityConstant: ImportedTarget;
}): RuleBlockInspection => {
  const rules = staticPropertyAt({
    object: lint,
    key: config.rulesFieldName,
    source,
    config,
    subject: "The root lint configuration",
  });
  if (rules.kind === "present") {
    return inspectRuleBlock({
      written: rules.property.value,
      source,
      config,
      severityConstant,
    });
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
  severityConstant,
}: {
  readonly lint: ESTree.ObjectExpression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
  readonly severityConstant: ImportedTarget;
}): PresetAdoptionInspection => {
  const overrides = staticPropertyAt({
    object: lint,
    key: config.overridesFieldName,
    source,
    config,
    subject: "The root lint configuration",
  });
  if (overrides.kind === "present") {
    return inspectOverrides({
      written: overrides.property.value,
      source,
      config,
      severityConstant,
    });
  }
  return {
    disabledDeclarations: [],
    problems: overrides.kind === "problem" ? [overrides.problem] : [],
  };
};

const inspectCallerExtends = ({
  lint,
  source,
  config,
}: {
  readonly lint: ESTree.ObjectExpression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
}): PresetAdoptionInspection["problems"] => {
  const extended = staticPropertyAt({
    object: lint,
    key: config.extendsFieldName,
    source,
    config,
    subject: "The root lint configuration",
  });
  if (extended.kind === "missing") return [];
  if (extended.kind === "problem") return [extended.problem];
  return [
    problemAt({
      source,
      start: extended.property.start,
      config,
      message: `The root lint configuration must not declare ${config.extendsFieldName}; pass additions directly so preset rules cannot be weakened by an opaque extended override.`,
    }),
  ];
};

const isStringPatternLiteral = (
  candidate: ESTree.ArrayExpression["elements"][number],
): candidate is Extract<ESTree.Expression, { readonly type: "Literal" }> & {
  readonly value: string;
} => candidate?.type === "Literal" && typeof candidate.value === "string";

const inspectWrittenIgnorePatterns = ({
  written,
  propertyStart,
  source,
  config,
}: {
  readonly written: ESTree.Expression;
  readonly propertyStart: number;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
}): Pick<PresetAdoptionInspection, "ignorePatterns" | "problems"> => {
  const unwrapped = unwrapTransparentExpression(written);
  if (unwrapped.type !== "ArrayExpression") {
    return {
      problems: [
        problemAt({
          source,
          start: unwrapped.start,
          config,
          message: `The root lint.${config.ignorePatternsFieldName} value must be a literal array so lint reach can be proven.`,
        }),
      ],
    };
  }
  const unreadableEntry = unwrapped.elements.find(
    (candidate) => !isStringPatternLiteral(candidate),
  );
  if (unreadableEntry !== undefined) {
    return {
      problems: [
        problemAt({
          source,
          start: unreadableEntry?.start ?? unwrapped.start,
          config,
          message: `Every root lint.${config.ignorePatternsFieldName} entry must be a string literal so lint reach can be proven.`,
        }),
      ],
    };
  }
  const controlCharacterEntry = unwrapped.elements
    .filter(isStringPatternLiteral)
    .find(
      (candidate) =>
        candidate.value.includes("\0") ||
        candidate.value.includes("\n") ||
        candidate.value.includes("\r"),
    );
  if (controlCharacterEntry !== undefined) {
    return {
      problems: [
        problemAt({
          source,
          start: controlCharacterEntry.start,
          config,
          message: `Every root lint.${config.ignorePatternsFieldName} entry must be one Git ignore pattern without NUL, carriage return, or line feed characters.`,
        }),
      ],
    };
  }
  return {
    ignorePatterns: {
      line: lineAt({ source, start: propertyStart }),
      patterns: unwrapped.elements
        .filter(isStringPatternLiteral)
        .map((patternLiteral) => patternLiteral.value),
    },
    problems: [],
  };
};

const inspectOptionalIgnorePatterns = ({
  lint,
  source,
  config,
}: {
  readonly lint: ESTree.ObjectExpression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
}): Pick<PresetAdoptionInspection, "ignorePatterns" | "problems"> => {
  const ignored = staticPropertyAt({
    object: lint,
    key: config.ignorePatternsFieldName,
    source,
    config,
    subject: "The root lint configuration",
  });
  if (ignored.kind === "missing") return { problems: [] };
  if (ignored.kind === "problem") return { problems: [ignored.problem] };
  return inspectWrittenIgnorePatterns({
    written: ignored.property.value,
    propertyStart: ignored.property.start,
    source,
    config,
  });
};

const inspectLint = ({
  lint,
  source,
  config,
  severityConstant,
}: {
  readonly lint: ESTree.ObjectExpression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
  readonly severityConstant: ImportedTarget;
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
  const rules = inspectOptionalRules({ lint, source, config, severityConstant });
  const overrides = inspectOptionalOverrides({ lint, source, config, severityConstant });
  const callerExtendsProblems = inspectCallerExtends({ lint, source, config });
  const ignored = inspectOptionalIgnorePatterns({ lint, source, config });
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
    ...(ignored.ignorePatterns === undefined ? {} : { ignorePatterns: ignored.ignorePatterns }),
    problems: [
      ...rules.problems,
      ...overrides.problems,
      ...callerExtendsProblems,
      ...ignored.problems,
    ],
  };
};

const inspectConfiguredObject = ({
  configured,
  source,
  config,
  preset,
  severityConstant,
}: {
  readonly configured: ESTree.ObjectExpression;
  readonly source: string;
  readonly config: PresetAdoptionConfig;
  readonly preset: ImportedTarget;
  readonly severityConstant: ImportedTarget;
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
          message: `The root toolchain configuration must declare a ${config.lintFieldName} block that directly calls ${config.presetModuleSpecifier}'s statically imported ${config.presetExportName}.${config.presetLintFunctionName} function.`,
        }),
      ],
    };
  }
  const written = unwrapTransparentExpression(lintProperty.property.value);
  const lint = objectPassedDirectlyToMember({
    expression: written,
    target: preset,
    memberName: config.presetLintFunctionName,
  });
  if (lint !== null) return inspectLint({ lint, source, config, severityConstant });
  return {
    disabledDeclarations: [],
    problems: [
      problemAt({
        source,
        start: written.start,
        config,
        message: `The root lint block must be exactly one direct call to ${config.presetExportName}.${config.presetLintFunctionName} through a value import from ${config.presetModuleSpecifier}, with one object literal argument.`,
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
  const inspectedProgram = parsedProgram({ source, config });
  if (inspectedProgram.program === null) {
    return { disabledDeclarations: [], problems: inspectedProgram.problems };
  }
  const importedTargets = importedTargetsIn({ program: inspectedProgram.program, config });
  const configured = staticDefaultExportedConfig({
    program: inspectedProgram.program,
    factory: importedTargets.factory,
  });
  if (configured !== null) {
    return inspectConfiguredObject({
      configured,
      source,
      config,
      preset: importedTargets.preset,
      severityConstant: importedTargets.severityConstant,
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
