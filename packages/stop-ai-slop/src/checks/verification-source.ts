import { posix } from "node:path";

import {
  parseSync,
  type Argument,
  type CallExpression,
  type Expression,
  type Node,
  type ParseResult,
} from "oxc-parser";

import { scopedCallExpressionsIn } from "./scoped-call-expressions.ts";

type FileAbsenceVerification = {
  readonly kind: "file";
  readonly locator: string;
  readonly subjectPath: string;
  readonly file: string;
  readonly line: number;
  readonly endLine: number;
};

type ExportAbsenceVerification = {
  readonly kind: "export";
  readonly locator: string;
  readonly modulePath: string;
  readonly exportName: string;
  readonly file: string;
  readonly line: number;
  readonly endLine: number;
};

export type AbsenceVerification = FileAbsenceVerification | ExportAbsenceVerification;

const parsedSource = (file: string, source: string): ParseResult => {
  const parsedNode = parseSync(file, source, { preserveParens: false });
  const [problem] = parsedNode.errors;
  if (problem !== undefined) throw new Error(`${file}: ${problem.message}`);
  return parsedNode;
};

const namedImportBindings = ({
  parsed,
  moduleRequest,
  importedName,
}: {
  readonly parsed: ParseResult;
  readonly moduleRequest: string;
  readonly importedName: string;
}): readonly string[] =>
  parsed.module.staticImports
    .filter((declaration) => declaration.moduleRequest.value === moduleRequest)
    .flatMap((declaration) => declaration.entries)
    .filter((listed) => {
      const importKind: string = listed.importName.kind;
      return !listed.isType && importKind === "Name" && listed.importName.name === importedName;
    })
    .map((listed) => listed.localName.value);

const namespaceImports = (parsedNode: ParseResult): ReadonlyMap<string, string> =>
  new Map(
    parsedNode.module.staticImports.flatMap((declaration) =>
      declaration.entries.flatMap((listed): readonly (readonly [string, string])[] => {
        const importKind: string = listed.importName.kind;
        return !listed.isType && importKind === "NamespaceObject"
          ? [[listed.localName.value, declaration.moduleRequest.value]]
          : [];
      }),
    ),
  );

const callExpression = (held: Argument | Expression | null): CallExpression | null =>
  held?.type === "CallExpression" ? held : null;

const literalValue = (held: Argument | null): unknown =>
  held?.type === "Literal" ? held.value : null;

const identifierName = (held: Node | null): string | null =>
  held?.type === "Identifier" ? held.name : null;

const staticMember = (
  held: Expression,
  propertyName: string,
): { readonly object: Expression } | null => {
  if (held.type !== "MemberExpression" || held.computed) return null;
  return identifierName(held.property) === propertyName ? { object: held.object } : null;
};

const repositoryPath = (held: string): string | null => {
  if (held.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(held)) return null;
  const normalizedText = posix.normalize(held);
  if (normalizedText === "." || normalizedText === ".." || normalizedText.startsWith("../"))
    return null;
  return normalizedText;
};

const importedBindingIsUnshadowed = ({
  importedBindings,
  localBindings,
  candidate,
}: {
  readonly importedBindings: readonly string[];
  readonly localBindings: ReadonlySet<string>;
  readonly candidate: string | null;
}): boolean =>
  candidate !== null && importedBindings.includes(candidate) && !localBindings.has(candidate);

const onlyArgument = (call: CallExpression): Argument | null =>
  call.arguments.length === 1 ? (call.arguments[0] as Argument) : null;

const argumentOfImportedCall = ({
  call,
  importedBindings,
  localBindings,
}: {
  readonly call: CallExpression | null;
  readonly importedBindings: readonly string[];
  readonly localBindings: ReadonlySet<string>;
}): Argument | null => {
  if (call === null) return null;
  return importedBindingIsUnshadowed({
    importedBindings,
    localBindings,
    candidate: identifierName(call.callee),
  })
    ? onlyArgument(call)
    : null;
};

const lineAtOffset = (source: string, offset: number): number =>
  source.slice(0, offset).split("\n").length;

const sourceRangeFor = (
  source: string,
  call: CallExpression,
): { readonly line: number; readonly endLine: number } => {
  return {
    line: lineAtOffset(source, call.start),
    endLine: lineAtOffset(source, Math.max(call.start, call.end - 1)),
  };
};

const fileVerificationFrom = ({
  file,
  source,
  call,
  expectBindings,
  existsBindings,
  localBindings,
}: {
  readonly file: string;
  readonly source: string;
  readonly call: CallExpression;
  readonly expectBindings: readonly string[];
  readonly existsBindings: readonly string[];
  readonly localBindings: ReadonlySet<string>;
}): FileAbsenceVerification | null => {
  const toBe = staticMember(call.callee, "toBe");
  if (toBe === null || literalValue(onlyArgument(call)) !== false) return null;
  const existenceCall = callExpression(
    argumentOfImportedCall({
      call: callExpression(toBe.object),
      importedBindings: expectBindings,
      localBindings,
    }),
  );
  if (existenceCall === null) return null;
  const pathValue = argumentOfImportedCall({
    call: existenceCall,
    importedBindings: existsBindings,
    localBindings,
  });

  const literalPath = literalValue(pathValue);
  const subjectPath = typeof literalPath === "string" ? repositoryPath(literalPath) : null;
  if (subjectPath === null) return null;
  return {
    kind: "file",
    locator: `file:${subjectPath}`,
    subjectPath,
    file,
    ...sourceRangeFor(source, call),
  };
};

const importedModulePath = (testFile: string, moduleRequest: string): string | null => {
  if (!moduleRequest.startsWith("./") && !moduleRequest.startsWith("../")) return null;
  if (!/\.[cm]?[jt]sx?$/u.test(moduleRequest)) return null;
  return repositoryPath(posix.join(posix.dirname(testFile), moduleRequest));
};

const negatedExpectationFrom = (
  call: CallExpression,
  matcherName: string,
): CallExpression | null => {
  const matcher = staticMember(call.callee, matcherName);
  if (matcher === null) return null;
  const not = staticMember(matcher.object, "not");
  return not === null ? null : callExpression(not.object);
};

type ExportVerificationTarget = Readonly<{
  namespaceBinding: string;
  exportName: string;
}>;

const missingPropertyTargetFrom = ({
  call,
  expectBindings,
  localBindings,
}: {
  readonly call: CallExpression;
  readonly expectBindings: readonly string[];
  readonly localBindings: ReadonlySet<string>;
}): ExportVerificationTarget | null => {
  const namespaceBinding = identifierName(
    argumentOfImportedCall({
      call: negatedExpectationFrom(call, "toHaveProperty"),
      importedBindings: expectBindings,
      localBindings,
    }),
  );
  const exportName = literalValue(onlyArgument(call));
  return namespaceBinding === null || typeof exportName !== "string"
    ? null
    : { namespaceBinding, exportName };
};

const undefinedPropertyTargetFrom = ({
  call,
  expectBindings,
  localBindings,
}: {
  readonly call: CallExpression;
  readonly expectBindings: readonly string[];
  readonly localBindings: ReadonlySet<string>;
}): ExportVerificationTarget | null => {
  const toBeUndefined = staticMember(call.callee, "toBeUndefined");
  if (toBeUndefined === null || call.arguments.length !== 0) {
    return null;
  }
  const expectedValue = argumentOfImportedCall({
    call: callExpression(toBeUndefined.object),
    importedBindings: expectBindings,
    localBindings,
  });
  if (expectedValue?.type !== "MemberExpression" || expectedValue.computed) {
    return null;
  }
  const namespaceBinding = identifierName(expectedValue.object);
  const exportName = identifierName(expectedValue.property);
  return namespaceBinding === null || exportName === null ? null : { namespaceBinding, exportName };
};

export const exportVerificationLocator = ({
  modulePath,
  exportName,
}: {
  readonly modulePath: string;
  readonly exportName: string;
}): string => JSON.stringify(["declaration", modulePath, exportName]);

const exportVerificationFrom = ({
  file,
  source,
  call,
  expectBindings,
  namespaces,
  localBindings,
}: {
  readonly file: string;
  readonly source: string;
  readonly call: CallExpression;
  readonly expectBindings: readonly string[];
  readonly namespaces: ReadonlyMap<string, string>;
  readonly localBindings: ReadonlySet<string>;
}): ExportAbsenceVerification | null => {
  const checked =
    missingPropertyTargetFrom({ call, expectBindings, localBindings }) ??
    undefinedPropertyTargetFrom({ call, expectBindings, localBindings });
  if (checked === null || localBindings.has(checked.namespaceBinding)) return null;
  const moduleRequest = namespaces.get(checked.namespaceBinding);
  if (moduleRequest === undefined) return null;
  const modulePath = importedModulePath(file, moduleRequest);
  if (modulePath === null) return null;
  return {
    kind: "export",
    locator: exportVerificationLocator({ modulePath, exportName: checked.exportName }),
    modulePath,
    exportName: checked.exportName,
    file,
    ...sourceRangeFor(source, call),
  };
};

export const absenceVerificationsIn = ({
  file,
  source,
}: {
  readonly file: string;
  readonly source: string;
}): readonly AbsenceVerification[] => {
  const parsedNode = parsedSource(file, source);
  const expectBindings = namedImportBindings({
    parsed: parsedNode,
    moduleRequest: "vite-plus/test",
    importedName: "expect",
  });
  const existsBindings = namedImportBindings({
    parsed: parsedNode,
    moduleRequest: "node:fs",
    importedName: "existsSync",
  });
  const namespaces = namespaceImports(parsedNode);

  return scopedCallExpressionsIn(parsedNode.program).flatMap(
    ({ call, localBindings }): readonly AbsenceVerification[] => {
      const fileVerification = fileVerificationFrom({
        file,
        source,
        call,
        expectBindings,
        existsBindings,
        localBindings,
      });
      if (fileVerification !== null) return [fileVerification];
      const exportVerification = exportVerificationFrom({
        file,
        source,
        call,
        expectBindings,
        namespaces,
        localBindings,
      });
      return exportVerification === null ? [] : [exportVerification];
    },
  );
};

export const valueExportsIn = ({
  file,
  source,
}: {
  readonly file: string;
  readonly source: string;
}): readonly string[] =>
  parsedSource(file, source).module.staticExports.flatMap((declaration) =>
    declaration.entries.flatMap((listed) => {
      const exportKind: string = listed.exportName.kind;
      return !listed.isType &&
        exportKind === "Name" &&
        listed.exportName.name !== null &&
        listed.exportName.name !== "default"
        ? [listed.exportName.name]
        : [];
    }),
  );
