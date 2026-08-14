export type ShippablePackagesConfig = {
  readonly dependencyKeys: readonly string[];
  readonly publishConfigKey: string;
  readonly binKey: string;
  readonly exportsKey: string;
  readonly filesKey: string;
  readonly typesCondition: string;
  readonly alwaysPackedEntry: string;
  readonly typeStrippedExtensions: readonly string[];
  readonly declarationInfix: string;
};

export const defaultShippablePackagesConfig: ShippablePackagesConfig = {
  dependencyKeys: ["dependencies", "peerDependencies", "optionalDependencies"],
  publishConfigKey: "publishConfig",
  binKey: "bin",
  exportsKey: "exports",
  filesKey: "files",
  typesCondition: "types",
  alwaysPackedEntry: "./package.json",
  typeStrippedExtensions: [".ts", ".mts", ".cts", ".tsx"],
  declarationInfix: ".d.",
};
