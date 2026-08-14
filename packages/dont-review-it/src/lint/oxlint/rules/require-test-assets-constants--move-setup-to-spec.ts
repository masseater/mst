import { createDontReviewItRule } from "../../../create-rule.ts";
import { unwrapExpression } from "../lib/canonical-values/finite-value-syntax.ts";
import { assetsNameMarkersFrom, assetsStemOf } from "../lib/spec-syntax/assets-files.ts";
import {
  moduleDeclarationsOf,
  moduleExportSpelling,
} from "../lib/spec-syntax/module-declarations.ts";

import type { ESTree } from "@oxlint/plugins";
import type { RuleMessage } from "../lib/rule-message.ts";
import type { SpecStatement } from "../lib/spec-syntax/subject-expressions.ts";

type Reading = {
  readonly declared: ReadonlyMap<string, ESTree.Expression>;
  readonly reached: ReadonlySet<string>;
};

const writtenOut = (node: ESTree.Expression): ESTree.Expression => {
  return unwrapExpression(node);
};

type AssetsFinding = RuleMessage & { readonly node: ESTree.Node };

const firstFinding = (found: readonly (AssetsFinding | null)[]): AssetsFinding | null =>
  found.find((finding) => finding !== null) ?? null;

const assembledFinding = (node: ESTree.Node, shape: string): AssetsFinding => ({
  node,
  messageId: "assetsAssembledValue",
  data: { shape },
});

const LOADING_SHAPE = "a value this file works out as it loads";

const ASSEMBLED_SHAPES: ReadonlyMap<string, string> = new Map([
  ["ArrowFunctionExpression", "a function"],
  ["AwaitExpression", "an awaited value"],
  ["CallExpression", "a call"],
  ["ClassExpression", "a class"],
  ["FunctionDeclaration", "a function"],
  ["FunctionExpression", "a function"],
  ["ImportExpression", "an import"],
  ["MemberExpression", "a read off another value"],
  ["NewExpression", "a value a constructor builds"],
  ["TaggedTemplateExpression", "a tagged template"],
  ["ThisExpression", "a value the caller supplies"],
]);

const groupedValueIn = (written: ESTree.Expression, reading: Reading): AssetsFinding | null => {
  if (written.type === "TemplateLiteral") {
    return firstFinding(written.expressions.map((embedded) => assembledValueIn(embedded, reading)));
  }
  if (written.type === "ArrayExpression") {
    return firstFinding(written.elements.map((held) => elementValueIn(held, reading)));
  }
  if (written.type === "ObjectExpression") {
    return firstFinding(written.properties.map((property) => propertyValueIn(property, reading)));
  }
  return assembledFinding(written, ASSEMBLED_SHAPES.get(written.type) ?? LOADING_SHAPE);
};

const assembledValueIn = (node: ESTree.Expression, reading: Reading): AssetsFinding | null => {
  const written = writtenOut(node);
  if (written.type === "Literal") return null;
  if (written.type === "UnaryExpression") return assembledValueIn(written.argument, reading);
  if (written.type === "Identifier") {
    return boundValueIn({ name: written.name, node: written }, reading);
  }
  return groupedValueIn(written, reading);
};

const CIRCULAR_NAME_SHAPE = "a chain of names that leads back to itself";

const boundValueIn = (
  named: { readonly name: string; readonly node: ESTree.Node },
  reading: Reading,
): AssetsFinding | null => {
  const { name, node } = named;
  if (reading.reached.has(name)) return assembledFinding(node, CIRCULAR_NAME_SHAPE);

  const bound = reading.declared.get(name);
  if (bound === undefined) {
    return assembledFinding(node, `the name \`${name}\`, which this file does not declare`);
  }

  const finding = assembledValueIn(bound, {
    declared: reading.declared,
    reached: new Set([...reading.reached, name]),
  });
  return finding === null ? null : { ...finding, node };
};

const SPREAD_SHAPE = "a spread of another value";

const elementValueIn = (
  held: ESTree.ArrayExpressionElement,
  reading: Reading,
): AssetsFinding | null => {
  if (held === null) return null;
  if (held.type === "SpreadElement") return assembledFinding(held, SPREAD_SHAPE);
  return assembledValueIn(held, reading);
};

const keyValueIn = (named: ESTree.PropertyKey, reading: Reading): AssetsFinding | null => {
  if (named.type !== "Identifier" && named.type !== "PrivateIdentifier") {
    return assembledValueIn(named, reading);
  }
  return boundValueIn({ name: named.name, node: named }, reading);
};

const propertyValueIn = (
  property: ESTree.ObjectPropertyKind,
  reading: Reading,
): AssetsFinding | null => {
  if (property.type === "SpreadElement") return assembledFinding(property, SPREAD_SHAPE);

  const keyFinding = property.computed ? keyValueIn(property.key, reading) : null;
  return keyFinding ?? assembledValueIn(property.value, reading);
};

const forwardedSpecifierOf = (statement: SpecStatement): string | null => {
  if (statement.type === "ExportAllDeclaration") return statement.source.value;
  if (statement.type === "ExportNamedDeclaration") return statement.source?.value ?? null;
  return null;
};

const detachedExportFinding = (statement: ESTree.ExportNamedDeclaration): AssetsFinding => ({
  node: statement,
  messageId: "assetsDetachedExport",
  data: {
    names: statement.specifiers
      .map((exported) => `\`${moduleExportSpelling(exported.exported)}\``)
      .join(", "),
  },
});

const declaratorFinding = (
  declarator: ESTree.VariableDeclarator,
  declared: Reading["declared"],
): AssetsFinding | null => {
  if (declarator.id.type !== "Identifier") {
    return { node: declarator.id, messageId: "assetsDestructuredBinding", data: {} };
  }
  if (declarator.init === null) {
    return {
      node: declarator,
      messageId: "assetsForeignStatement",
      data: { shape: "a `const` declaration carrying no value" },
    };
  }
  return assembledValueIn(declarator.init, {
    declared,
    reached: new Set([declarator.id.name]),
  });
};

const declarationFinding = (
  declaration: ESTree.VariableDeclaration,
  declared: Reading["declared"],
): AssetsFinding | null => {
  if (declaration.kind !== "const") {
    return {
      node: declaration,
      messageId: "assetsForeignStatement",
      data: { shape: `a \`${declaration.kind}\` declaration` },
    };
  }
  return firstFinding(
    declaration.declarations.map((declarator) => declaratorFinding(declarator, declared)),
  );
};

const RUNNING_STATEMENT_SHAPE = "a statement that runs";

const FOREIGN_STATEMENT_SHAPES: ReadonlyMap<string, string> = new Map([
  ["ClassDeclaration", "a class declaration"],
  ["ExportDefaultDeclaration", "a default export"],
  ["FunctionDeclaration", "a function declaration"],
  ["TSDeclareFunction", "a function signature"],
  ["TSEnumDeclaration", "an enum declaration"],
  ["TSExportAssignment", "an export assignment"],
  ["TSGlobalDeclaration", "a global declaration"],
  ["TSImportEqualsDeclaration", "an import assignment"],
  ["TSModuleDeclaration", "a module declaration"],
]);

const writtenStatementFinding = (
  statement: SpecStatement,
  declared: Reading["declared"],
): AssetsFinding | null => {
  if (statement.type === "TSTypeAliasDeclaration" || statement.type === "TSInterfaceDeclaration") {
    return {
      node: statement,
      messageId: "assetsTypeDeclaration",
      data: { name: statement.id.name },
    };
  }
  if (statement.type === "VariableDeclaration") return declarationFinding(statement, declared);
  return {
    node: statement,
    messageId: "assetsForeignStatement",
    data: { shape: FOREIGN_STATEMENT_SHAPES.get(statement.type) ?? RUNNING_STATEMENT_SHAPE },
  };
};

const statementFinding = (
  statement: SpecStatement,
  declared: Reading["declared"],
): AssetsFinding | null => {
  if (statement.type === "ImportDeclaration") {
    return {
      node: statement,
      messageId: "assetsImport",
      data: { specifier: statement.source.value },
    };
  }
  const forwarded = forwardedSpecifierOf(statement);
  if (forwarded !== null) {
    return { node: statement, messageId: "assetsReExport", data: { specifier: forwarded } };
  }
  if (statement.type === "ExportNamedDeclaration") {
    return statement.declaration === null
      ? detachedExportFinding(statement)
      : statementFinding(statement.declaration, declared);
  }
  return writtenStatementFinding(statement, declared);
};

export const requireTestAssetsConstants = createDontReviewItRule({
  name: "require-test-assets-constants--move-setup-to-spec",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require an assets file to carry nothing but const declarations of written-out data, so setup cannot leave the spec that owns it under the name of test data",
      relatedGuidelines: [],
    },
    messages: {
      assetsImport:
        "An assets file must not import anything. This file imports `{{specifier}}`. Move the work behind that import into the fixture of the spec that owns this file.",
      assetsReExport:
        "An assets file must not forward another module. This statement re-exports from `{{specifier}}`. Delete it and write out the data this file holds.",
      assetsDetachedExport:
        "An assets file must not publish a name away from its declaration. This statement exports {{names}}. Write `export` on each declaration and delete this statement.",
      assetsTypeDeclaration:
        "An assets file must not declare a type. This file declares `{{name}}`. Move the type to the spec that reads this file and keep the data here written out.",
      assetsForeignStatement:
        "An assets file must not carry anything but a `const` declaration of written-out data. This file carries {{shape}}. Move it into the fixture of the spec that owns this file.",
      assetsDestructuredBinding:
        "An assets file must not bind a pattern. This declaration takes its names out of another value. Declare each value on a `const` of its own and write that value out.",
      assetsAssembledValue:
        "An assets file must not hold a value assembled as the file loads. This declaration holds {{shape}}. Move that work into the fixture of the spec that owns this file and write the settled value out here.",
    },
    schema: [
      {
        type: "object",
        properties: {
          assetsNameMarkers: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(inspection) {
    const markers = assetsNameMarkersFrom(inspection.options);
    if (assetsStemOf(inspection.filename, markers) === null) return {};

    return {
      Program(node: ESTree.Program) {
        const declared = moduleDeclarationsOf(inspection.filename, node.body).initializerByName;
        const findings = node.body.flatMap(
          (statement) => statementFinding(statement, declared) ?? [],
        );
        for (const finding of findings) inspection.report(finding);
      },
    };
  },
});
