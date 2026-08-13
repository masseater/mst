import { isNamedFields } from "../named-fields.ts";

const DEPENDENCY_SECTIONS: readonly string[] = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
];

const LOCAL_REFERENCE_PROTOCOLS: readonly string[] = ["workspace:", "link:", "file:"];

const ALIAS_PROTOCOL = "npm:";

export type DeclaredDependency = {
  readonly packageName: string;
  readonly declaredVersion: string;
};

const aliasPartsOf = (
  declaredVersion: string,
): { readonly targetName: string; readonly range: string } => {
  const checked = declaredVersion.slice(ALIAS_PROTOCOL.length);
  const rangeAt = checked.lastIndexOf("@");
  return rangeAt > 0
    ? { targetName: checked.slice(0, rangeAt), range: checked.slice(rangeAt + 1) }
    : { targetName: checked, range: "" };
};

const aliasTargetOf = (declaredVersion: string): string | null => {
  const { targetName } = aliasPartsOf(declaredVersion);
  return targetName === "" ? null : targetName;
};

export const declaredRangeOf = (declaredVersion: string): string =>
  declaredVersion.startsWith(ALIAS_PROTOCOL)
    ? aliasPartsOf(declaredVersion).range
    : declaredVersion;

const packageNameOf = (declaration: {
  readonly declaredName: string;
  readonly declaredVersion: string;
}): string | null => {
  const { declaredName, declaredVersion } = declaration;
  if (LOCAL_REFERENCE_PROTOCOLS.some((protocol) => declaredVersion.startsWith(protocol))) {
    return null;
  }
  return declaredVersion.startsWith(ALIAS_PROTOCOL) ? aliasTargetOf(declaredVersion) : declaredName;
};

const sectionDependencies = (section: unknown): readonly DeclaredDependency[] => {
  if (!isNamedFields(section)) return [];

  return Object.entries(section).flatMap(([declaredName, declaredValue]) => {
    if (typeof declaredValue !== "string") return [];
    const packageName = packageNameOf({ declaredName, declaredVersion: declaredValue });
    return packageName === null ? [] : [{ packageName, declaredVersion: declaredValue }];
  });
};

export const declaredDependenciesIn = (manifest: unknown): readonly DeclaredDependency[] =>
  isNamedFields(manifest)
    ? DEPENDENCY_SECTIONS.flatMap((section) => sectionDependencies(manifest[section]))
    : [];
