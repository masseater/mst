import { createDontReviewItRule } from "../../../../create-rule.ts";
import { mockNamespaceFrom, spellingsFrom } from "../../lib/configured-spellings.ts";
import { SUBPATH_SEPARATOR } from "../../lib/path-segments.ts";
import { resolveBinding } from "../../lib/resolved-bindings.ts";
import {
  DEFAULT_MODULE_REPLACEMENT_MEMBERS,
  MODULE_REPLACEMENT_MEMBERS_OPTION,
} from "../../lib/spec-syntax/mock-namespace.ts";
import { moduleExportSpelling } from "../../lib/spec-syntax/module-declarations.ts";
import { isSpecFile, specFileSuffixesFrom } from "../../lib/spec-syntax/spec-files.ts";
import {
  staticMemberName,
  staticPropertyName,
  staticSpelling,
} from "../../lib/spec-syntax/static-names.ts";
import { unwrapSubject } from "../../lib/spec-syntax/subject-expressions.ts";

import type { Definition, ESTree, Scope, Variable } from "@oxlint/plugins";
import type { RuleMessage } from "../../lib/rule-message.ts";

const FILE_SYSTEM_MODULES_OPTION = "fileSystemModules";

const IN_MEMORY_FILE_SYSTEM_PACKAGES_OPTION = "inMemoryFileSystemPackages";

const DEFAULT_FILE_SYSTEM_MODULES: readonly string[] = [
  "fs",
  "fs/promises",
  "node:fs",
  "node:fs/promises",
];

const DEFAULT_IN_MEMORY_FILE_SYSTEM_PACKAGES: readonly string[] = ["memfs"];

type Reading = {
  readonly scopeAt: (node: ESTree.Node) => Scope;
  readonly namespace: string;
  readonly replacementMembers: ReadonlySet<string>;
  readonly fileSystemModules: ReadonlySet<string>;
  readonly inMemoryPackages: ReadonlySet<string>;
  readonly followed: readonly Variable[];
};

const constInitializerOf = (definition: Definition): ESTree.Expression | null => {
  const declared = definition.node;
  if (declared.type !== "VariableDeclarator" || declared.init === null) return null;
  if (declared.id.type !== "Identifier") return null;
  if (declared.parent.type !== "VariableDeclaration" || declared.parent.kind !== "const") {
    return null;
  }
  return declared.init;
};

const definitionReachesNamespace = (definition: Definition, reading: Reading): boolean => {
  if (definition.node.type === "ImportSpecifier") {
    return moduleExportSpelling(definition.node.imported) === reading.namespace;
  }
  const initializer = constInitializerOf(definition);
  return initializer !== null && reachesNamespace(initializer, reading);
};

const reachesNamespace = (node: ESTree.Expression, reading: Reading): boolean => {
  const written = unwrapSubject(node);
  if (written.type !== "Identifier") return false;

  const binding = resolveBinding(reading.scopeAt(written), written.name);
  if (binding === null) return written.name === reading.namespace;
  if (reading.followed.includes(binding)) return false;

  const traced = { ...reading, followed: [...reading.followed, binding] };
  return binding.defs.some((definition) => definitionReachesNamespace(definition, traced));
};

const replacementMemberOf = (node: ESTree.Expression, reading: Reading): string | null => {
  const written = unwrapSubject(node);
  if (written.type === "MemberExpression") {
    const member = staticMemberName(written);
    if (member === null || !reading.replacementMembers.has(member)) return null;
    return reachesNamespace(written.object, reading) ? member : null;
  }
  if (written.type !== "Identifier") return null;

  const binding = resolveBinding(reading.scopeAt(written), written.name);
  if (binding === null || reading.followed.includes(binding)) return null;

  const traced = { ...reading, followed: [...reading.followed, binding] };
  return (
    binding.defs
      .map((definition) => {
        const initializer = constInitializerOf(definition);
        return initializer === null ? null : replacementMemberOf(initializer, traced);
      })
      .find((found) => found !== null) ?? null
  );
};

const LOCAL_DOUBLE_MESSAGE = "localFileSystemDouble";

const staticSpecifierOf = (node: ESTree.Expression, reading: Reading): string | null => {
  const written = unwrapSubject(node);
  if (written.type === "ImportExpression") return staticSpecifierOf(written.source, reading);

  const spelled = staticSpelling(written);
  if (spelled !== null) return spelled;
  if (written.type !== "Identifier") return null;

  const binding = resolveBinding(reading.scopeAt(written), written.name);
  if (binding === null || reading.followed.includes(binding)) return null;

  const traced = { ...reading, followed: [...reading.followed, binding] };
  return (
    binding.defs
      .map((definition) => {
        const initializer = constInitializerOf(definition);
        return initializer === null ? null : staticSpecifierOf(initializer, traced);
      })
      .find((found) => found !== null) ?? null
  );
};

const handedArgument = (
  call: ESTree.CallExpression,
  position: number,
): ESTree.Expression | null => {
  const handed = call.arguments[position];
  return handed === undefined || handed.type === "SpreadElement" ? null : handed;
};

const isTrueLiteral = (node: ESTree.Expression): boolean => {
  const written = unwrapSubject(node);
  return written.type === "Literal" && written.value === true;
};

const ORIGINAL_WRAPPING_OPTION = "spy";

const wrapsOriginal = (node: ESTree.Expression): boolean => {
  const written = unwrapSubject(node);
  if (written.type !== "ObjectExpression") return false;

  return written.properties.some(
    (property) =>
      property.type === "Property" &&
      staticPropertyName(property) === ORIGINAL_WRAPPING_OPTION &&
      isTrueLiteral(property.value),
  );
};

const replacementMessage = (
  called: { readonly call: ESTree.CallExpression; readonly member: string },
  reading: Reading,
): RuleMessage | null => {
  const { call, member } = called;
  const checked = handedArgument(call, 0);
  const specifier = checked === null ? null : staticSpecifierOf(checked, reading);
  if (specifier === null) return { messageId: "unreadableModuleSpecifier", data: { member } };
  if (!reading.fileSystemModules.has(specifier)) return null;

  const ruleOptions = handedArgument(call, 1);
  return ruleOptions !== null && wrapsOriginal(ruleOptions)
    ? { messageId: "wrappedFileSystemModule", data: { member, specifier } }
    : { messageId: LOCAL_DOUBLE_MESSAGE, data: { member, specifier } };
};

const namesInMemoryPackage = (specifier: string, reading: Reading): boolean =>
  [...reading.inMemoryPackages].some(
    (named) => specifier === named || specifier.startsWith(`${named}${SUBPATH_SEPARATOR}`),
  );

const inMemoryMessage = (specifier: string | null, reading: Reading): RuleMessage | null =>
  specifier === null || !namesInMemoryPackage(specifier, reading)
    ? null
    : { messageId: "inMemoryFileSystemTaken", data: { specifier } };

const TYPE_IMPORT_KIND = "type";

const carriesOnlyTypes = (node: ESTree.ImportDeclaration): boolean => {
  if (node.importKind === TYPE_IMPORT_KIND) return true;
  if (node.specifiers.length === 0) return false;
  return node.specifiers.every(
    (specifier) =>
      specifier.type === "ImportSpecifier" && specifier.importKind === TYPE_IMPORT_KIND,
  );
};

const SYNCHRONOUS_READ_CALLEE = "require";

const readCallSpecifier = (call: ESTree.CallExpression): ESTree.Expression | null => {
  const callee = unwrapSubject(call.callee);
  if (callee.type !== "Identifier" || callee.name !== SYNCHRONOUS_READ_CALLEE) return null;
  return handedArgument(call, 0);
};

const isRemovableStatement = (call: ESTree.CallExpression, complaint: RuleMessage): boolean =>
  complaint.messageId === LOCAL_DOUBLE_MESSAGE &&
  call.arguments.length === 1 &&
  call.parent.type === "ExpressionStatement";

export const noLocalFileSystemMock = createDontReviewItRule({
  name: "no-local-file-system-mock--use-shared-fs",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow a spec standing up its own file system double or naming the in-memory implementation behind the standard API, so every spec reads and writes through one abstraction that the shared setup rebuilds before each test",
      relatedGuidelines: ["docs/guidelines/tests.md"],
    },
    messages: {
      localFileSystemDouble:
        "A spec must not stand up its own file system double. Delete this `{{member}}` declaration for `{{specifier}}` and create whatever files the test needs through the standard file system API before calling the subject. The shared test setup already puts an in-memory implementation behind that specifier and rebuilds it before each test, so a double declared here is a second implementation that drifts from the shared one and carries file state across tests running beside it. Handing a factory, moving the specifier into a binding, and spelling the member out as a string subscript are all read as this same declaration.",
      wrappedFileSystemModule:
        "A file system replacement must not keep the real implementation. Delete this `{{member}}` declaration for `{{specifier}}` instead of asking for the original to be wrapped. Wrapping leaves the real disk in place, so the spec walks straight past the in-memory implementation the shared setup put behind that specifier and writes to a surface no per-test rebuild reaches. Create the files the test needs through the standard file system API and call the subject.",
      unreadableModuleSpecifier:
        "A module replacement declaration must not take a target that only settles at run time. Write the module out as a string literal at this `{{member}}` call. The declaration is hoisted above the imports and evaluated before any of them, so a specifier assembled at run time cannot be the module it replaces, and a target nobody can read cannot be held against the file system modules the shared setup owns.",
      inMemoryFileSystemTaken:
        "A spec must not take the in-memory file system implementation as a value. Drop this reach for `{{specifier}}` and go through the standard file system API instead. Which implementation stands behind that API is the shared setup's to choose and the spec's not to see: naming it here ties the spec to a choice that will change under it, and the region reached this way sits outside the rebuild the shared setup runs before each test.",
    },
    schema: [
      {
        type: "object",
        properties: {
          mockNamespace: { type: "string" },
          moduleReplacementMembers: { type: "array", items: { type: "string" } },
          fileSystemModules: { type: "array", items: { type: "string" } },
          inMemoryFileSystemPackages: { type: "array", items: { type: "string" } },
          specFileSuffixes: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    fixable: "code",
  },
  create(inspection) {
    if (!isSpecFile(inspection.filename, specFileSuffixesFrom(inspection.options))) return {};

    const reading: Reading = {
      scopeAt: (node) => inspection.sourceCode.getScope(node),
      namespace: mockNamespaceFrom(inspection.options),
      replacementMembers: spellingsFrom(inspection.options, {
        option: MODULE_REPLACEMENT_MEMBERS_OPTION,
        fallback: DEFAULT_MODULE_REPLACEMENT_MEMBERS,
      }),
      fileSystemModules: spellingsFrom(inspection.options, {
        option: FILE_SYSTEM_MODULES_OPTION,
        fallback: DEFAULT_FILE_SYSTEM_MODULES,
      }),
      inMemoryPackages: spellingsFrom(inspection.options, {
        option: IN_MEMORY_FILE_SYSTEM_PACKAGES_OPTION,
        fallback: DEFAULT_IN_MEMORY_FILE_SYSTEM_PACKAGES,
      }),
      followed: [],
    };

    const reportFound = (node: ESTree.Node, complaint: RuleMessage | null): void => {
      if (complaint === null) return;
      inspection.report({ node, messageId: complaint.messageId, data: complaint.data });
    };

    const reportCall = (call: ESTree.CallExpression, complaint: RuleMessage | null): void => {
      if (complaint === null) return;
      inspection.report({
        node: call,
        messageId: complaint.messageId,
        data: complaint.data,
        fix: isRemovableStatement(call, complaint)
          ? (fixer) => fixer.remove(call.parent)
          : undefined,
      });
    };

    return {
      ImportDeclaration(node: ESTree.ImportDeclaration) {
        if (carriesOnlyTypes(node)) return;
        reportFound(node, inMemoryMessage(node.source.value, reading));
      },

      ImportExpression(node: ESTree.ImportExpression) {
        reportFound(node, inMemoryMessage(staticSpecifierOf(node.source, reading), reading));
      },

      CallExpression(node: ESTree.CallExpression) {
        const member = replacementMemberOf(node.callee, reading);
        if (member !== null) {
          reportCall(node, replacementMessage({ call: node, member }, reading));
          return;
        }

        const read = readCallSpecifier(node);
        if (read === null) return;
        reportFound(node, inMemoryMessage(staticSpecifierOf(read, reading), reading));
      },
    };
  },
});
