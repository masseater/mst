export type EntryCompositionLayer = {
  readonly required: boolean;
  readonly entryNames: readonly string[];
  readonly wrappers: readonly string[];
};

export type EntryCompositionConfig = {
  readonly manifestFileName: string;
  readonly workspaceDefinitionFileName: string;
  readonly workspacePatternsKey: string;
  readonly scriptsKey: string;
  readonly wrapperSeparator: string;
  readonly placeholderBody: string;
  readonly rootLayer: EntryCompositionLayer;
  readonly workspaceLayer: EntryCompositionLayer;
};

export const defaultEntryCompositionConfig: EntryCompositionConfig = {
  manifestFileName: "package.json",
  workspaceDefinitionFileName: "pnpm-workspace.yaml",
  workspacePatternsKey: "packages",
  scriptsKey: "scripts",
  wrapperSeparator: " -- ",
  placeholderBody: "exit 0",
  rootLayer: {
    required: true,
    entryNames: ["guard"],
    wrappers: ["throttle --timeout 1800", "spool"],
  },
  workspaceLayer: {
    required: false,
    entryNames: ["test", "build", "check"],
    wrappers: ["spool"],
  },
};

export const composedPrefixOf = ({
  layer,
  config,
}: {
  readonly layer: EntryCompositionLayer;
  readonly config: EntryCompositionConfig;
}): string => layer.wrappers.map((wrapper) => `${wrapper}${config.wrapperSeparator}`).join("");

export const wrapperNameOf = (wrapper: string): string => wrapper.replace(/ .*$/u, "");
