import { objectPropertyOf, objectValueOf, propertyKeyOf } from "./object-literal.ts";
import { toPosixPath } from "./posix-path.ts";
import { unwrapTransparentExpression } from "./transparent-expression.ts";

import type { ESTree } from "@oxlint/plugins";

const TEST_CONFIG_PATH = /(?:^|\/)vite(?:st)?\.config\.[cm]?[jt]s$/u;

const COMMONJS_TEST_CONFIG_PATH = /(?:^|\/)vite(?:st)?\.config\.c(?:j|t)s$/u;

const CONFIG_MODULES = new Set(["vite", "vite-plus", "vitest/config"]);

type DefineConfigBindings = {
  readonly named: ReadonlySet<string>;
  readonly namespaces: ReadonlySet<string>;
};

export type TestConfigResolution =
  | { readonly kind: "not-test-config" }
  | { readonly kind: "commonjs"; readonly node: ESTree.Program }
  | { readonly kind: "dynamic"; readonly node: ESTree.Program }
  | { readonly kind: "static"; readonly config: ESTree.ObjectExpression };

export type StaticObjectResolution =
  | { readonly kind: "missing" }
  | { readonly kind: "dynamic" }
  | { readonly kind: "static"; readonly object: ESTree.ObjectExpression };

export type StaticTestTaskResolution =
  | { readonly kind: "missing" }
  | { readonly kind: "dynamic" }
  | { readonly kind: "present"; readonly property: ESTree.ObjectProperty };

const importsConfigFactory = (node: ESTree.ImportDeclaration): boolean =>
  node.importKind !== "type" && CONFIG_MODULES.has(node.source.value);

const importedDefineConfigBindings = (program: ESTree.Program): DefineConfigBindings => ({
  named: new Set(
    program.body.flatMap((node) => {
      if (node.type !== "ImportDeclaration" || !importsConfigFactory(node)) return [];
      return node.specifiers.flatMap((specifier) =>
        specifier.type === "ImportSpecifier" &&
        specifier.importKind !== "type" &&
        specifier.imported.type === "Identifier" &&
        specifier.imported.name === "defineConfig"
          ? [specifier.local.name]
          : [],
      );
    }),
  ),
  namespaces: new Set(
    program.body.flatMap((node) => {
      if (node.type !== "ImportDeclaration" || !importsConfigFactory(node)) return [];
      return node.specifiers.flatMap((specifier) =>
        specifier.type === "ImportNamespaceSpecifier" ? [specifier.local.name] : [],
      );
    }),
  ),
});

const isDefineConfigTarget = (
  expression: ESTree.Expression,
  bindings: DefineConfigBindings,
): boolean => {
  const configTarget = unwrapTransparentExpression(expression);
  if (configTarget.type === "Identifier") return bindings.named.has(configTarget.name);
  if (
    configTarget.type !== "MemberExpression" ||
    configTarget.computed ||
    configTarget.object.type === "Super"
  ) {
    return false;
  }
  const receiver = unwrapTransparentExpression(configTarget.object);
  return (
    receiver.type === "Identifier" &&
    bindings.namespaces.has(receiver.name) &&
    configTarget.property.type === "Identifier" &&
    configTarget.property.name === "defineConfig"
  );
};

const unwrappedDefaultDeclaration = (
  program: ESTree.Program,
): ESTree.ExportDefaultDeclaration["declaration"] | null => {
  const exported = program.body.findLast(
    (node): node is ESTree.ExportDefaultDeclaration => node.type === "ExportDefaultDeclaration",
  );
  if (exported === undefined) return null;
  const { declaration } = exported;
  switch (declaration.type) {
    case "TSAsExpression":
    case "TSNonNullExpression":
    case "TSSatisfiesExpression":
    case "TSTypeAssertion":
      return unwrapTransparentExpression(declaration);
    default:
      return declaration;
  }
};

const staticDefineConfigArgument = (
  declaration: ESTree.ExportDefaultDeclaration["declaration"],
  bindings: DefineConfigBindings,
): ESTree.ObjectExpression | null => {
  if (declaration.type !== "CallExpression") return null;
  const { callee } = declaration;
  if (
    callee.type === "Super" ||
    callee.type === "V8IntrinsicExpression" ||
    !isDefineConfigTarget(callee, bindings) ||
    declaration.arguments.length !== 1
  ) {
    return null;
  }
  const [argument] = declaration.arguments;
  if (argument === undefined || argument.type === "SpreadElement") return null;
  const unwrapped = unwrapTransparentExpression(argument);
  return unwrapped.type === "ObjectExpression" ? unwrapped : null;
};

const staticDefaultExportedObject = (program: ESTree.Program): ESTree.ObjectExpression | null => {
  const declaration = unwrappedDefaultDeclaration(program);
  if (declaration === null) return null;
  if (declaration.type === "ObjectExpression") return declaration;
  return staticDefineConfigArgument(declaration, importedDefineConfigBindings(program));
};

const memberNameOf = (member: ESTree.MemberExpression): string | null => {
  const { property } = member;
  if (!member.computed && property.type === "Identifier") return property.name;
  return member.computed && property.type === "Literal" && typeof property.value === "string"
    ? property.value
    : null;
};

const isModuleExports = (assignmentTarget: ESTree.AssignmentTarget): boolean =>
  assignmentTarget.type === "MemberExpression" &&
  assignmentTarget.object.type === "Identifier" &&
  assignmentTarget.object.name === "module" &&
  memberNameOf(assignmentTarget) === "exports";

const assignsModuleExports = (program: ESTree.Program): boolean =>
  program.body.some(
    (node) =>
      node.type === "ExpressionStatement" &&
      node.expression.type === "AssignmentExpression" &&
      isModuleExports(node.expression.left),
  );

const hasDynamicProperty = (candidateObject: ESTree.ObjectExpression): boolean =>
  candidateObject.properties.some(
    (property) => property.type === "SpreadElement" || propertyKeyOf(property) === null,
  );

export const staticallyClosedObject = (
  resolution: StaticObjectResolution,
): StaticObjectResolution =>
  resolution.kind === "static" && hasDynamicProperty(resolution.object)
    ? { kind: "dynamic" }
    : resolution;

export const resolveTestConfig = ({
  filename,
  program,
}: {
  readonly filename: string;
  readonly program: ESTree.Program;
}): TestConfigResolution => {
  const path = toPosixPath(filename);
  if (!TEST_CONFIG_PATH.test(path)) return { kind: "not-test-config" };
  if (COMMONJS_TEST_CONFIG_PATH.test(path) || assignsModuleExports(program)) {
    return { kind: "commonjs", node: program };
  }
  const config = staticDefaultExportedObject(program);
  return config === null ? { kind: "dynamic", node: program } : { kind: "static", config };
};

const staticObjectAt = ({
  object,
  key,
}: {
  readonly object: StaticObjectResolution;
  readonly key: string;
}): StaticObjectResolution => {
  if (object.kind !== "static") return object;
  if (hasDynamicProperty(object.object)) return { kind: "dynamic" };
  const configuredEntry = objectValueOf({ object: object.object, key });
  if (configuredEntry === null) return { kind: "missing" };
  const unwrapped = unwrapTransparentExpression(configuredEntry);
  return unwrapped.type === "ObjectExpression"
    ? { kind: "static", object: unwrapped }
    : { kind: "dynamic" };
};

export const staticObjectPathAt = ({
  object,
  path,
}: {
  readonly object: ESTree.ObjectExpression;
  readonly path: readonly string[];
}): StaticObjectResolution =>
  path.reduce<StaticObjectResolution>(
    (resolvedObject, pathSegment) => staticObjectAt({ object: resolvedObject, key: pathSegment }),
    {
      kind: "static",
      object,
    },
  );

export const staticTestTaskAt = (config: ESTree.ObjectExpression): StaticTestTaskResolution => {
  const tasks = staticallyClosedObject(
    staticObjectPathAt({ object: config, path: ["run", "tasks"] }),
  );
  if (tasks.kind !== "static") return tasks;
  const property = objectPropertyOf({ object: tasks.object, key: "test" });
  return property === null ? { kind: "missing" } : { kind: "present", property };
};
