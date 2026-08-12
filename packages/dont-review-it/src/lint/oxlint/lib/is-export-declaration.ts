export const isExportDeclaration = (node: { readonly type: string } | null): boolean =>
  node?.type === "ExportNamedDeclaration" || node?.type === "ExportDefaultDeclaration";
