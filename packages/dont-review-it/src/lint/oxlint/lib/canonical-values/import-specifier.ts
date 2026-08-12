export const isRelativeImportSpecifier = (specifier: string): boolean =>
  specifier.startsWith("./") || specifier.startsWith("../");
