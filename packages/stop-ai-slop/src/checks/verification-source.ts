import { posix } from "node:path";

import { lineAtOffset } from "@mst/utils";
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

export const exportVerificationLocator = ({
  modulePath,
  exportName,
}: {
  readonly modulePath: string;
  readonly exportName: string;
}): string => JSON.stringify(["declaration", modulePath, exportName]);

const parsedSource = (file: string, source: string): ParseResult => {
  const parsed = parseSync(file, source, { preserveParens: false });
  const [problem] = parsed.errors;
  if (problem !== undefined) throw new Error(`${file}: ${problem.message}`);
  return parsed;
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
    .filter((entry) => {
      const importKind: string = entry.importName.kind;
      return !entry.isType && importKind === "Name" && entry.importName.name === importedName;
    })
    .map((entry) => entry.localName.value);

const namespaceImports = (parsed: ParseResult): ReadonlyMap<string, string> =>
  new Map(
    parsed.module.staticImports.flatMap((declaration) =>
      declaration.entries.flatMap((entry): readonly (readonly [string, string])[] => {
        const importKind: string = entry.importName.kind;
        return !entry.isType && importKind === "NamespaceObject"
          ? [[entry.localName.value, declaration.moduleRequest.value]]
          : [];
      }),
    ),
  );

const callExpression = (value: Argument | Expression | null): CallExpression | null =>
  value?.type === "CallExpression" ? value : null;

const identifierName = (value: Node | null): string | null =>
  value?.type === "Identifier" ? value.name : null;

const literalValue = (value: Argument | null): unknown =>
  value?.type === "Literal" ? value.value : null;

const staticMember = (
  value: Expression,
  propertyName: string,
): { readonly object: Expression } | null => {
  if (value.type !== "MemberExpression" || value.computed) return null;
  return identifierName(value.property) === propertyName ? { object: value.object } : null;
};

const onlyArgument = (call: CallExpression): Argument | null =>
  call.arguments.length === 1 ? (call.arguments[0] as Argument) : null;

const repositoryPath = (value: string): string | null => {
  if (value.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(value)) return null;
  const normalized = posix.normalize(value);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) return null;
  return normalized;
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
  const target =
    missingPropertyTargetFrom({ call, expectBindings, localBindings }) ??
    undefinedPropertyTargetFrom({ call, expectBindings, localBindings });
  if (target === null || localBindings.has(target.namespaceBinding)) return null;
  const moduleRequest = namespaces.get(target.namespaceBinding);
  if (moduleRequest === undefined) return null;
  const modulePath = importedModulePath(file, moduleRequest);
  if (modulePath === null) return null;
  return {
    kind: "export",
    locator: exportVerificationLocator({ modulePath, exportName: target.exportName }),
    modulePath,
    exportName: target.exportName,
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
  const parsed = parsedSource(file, source);
  const expectBindings = namedImportBindings({
    parsed,
    moduleRequest: "vite-plus/test",
    importedName: "expect",
  });
  const existsBindings = namedImportBindings({
    parsed,
    moduleRequest: "node:fs",
    importedName: "existsSync",
  });
  const namespaces = namespaceImports(parsed);

  return scopedCallExpressionsIn(parsed.program).flatMap(
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
    declaration.entries.flatMap((entry) => {
      const exportKind: string = entry.exportName.kind;
      return !entry.isType &&
        exportKind === "Name" &&
        entry.exportName.name !== null &&
        entry.exportName.name !== "default"
        ? [entry.exportName.name]
        : [];
    }),
  );
