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

const isJsonObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const aliasTargetOf = (declaredVersion: string): string | null => {
  const target = declaredVersion.slice(ALIAS_PROTOCOL.length);
  const rangeAt = target.lastIndexOf("@");
  const targetName = rangeAt > 0 ? target.slice(0, rangeAt) : target;
  return targetName === "" ? null : targetName;
};

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
  if (!isJsonObject(section)) return [];

  return Object.entries(section).flatMap(([declaredName, declaredValue]) => {
    if (typeof declaredValue !== "string") return [];
    const packageName = packageNameOf({ declaredName, declaredVersion: declaredValue });
    return packageName === null ? [] : [{ packageName, declaredVersion: declaredValue }];
  });
};

export const declaredDependenciesIn = (manifest: unknown): readonly DeclaredDependency[] =>
  isJsonObject(manifest)
    ? DEPENDENCY_SECTIONS.flatMap((section) => sectionDependencies(manifest[section]))
    : [];
