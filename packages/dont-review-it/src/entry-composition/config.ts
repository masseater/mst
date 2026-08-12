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
  readonly rootLayer: EntryCompositionLayer;
  readonly workspaceLayer: EntryCompositionLayer;
};

export const defaultEntryCompositionConfig: EntryCompositionConfig = {
  manifestFileName: "package.json",
  workspaceDefinitionFileName: "pnpm-workspace.yaml",
  workspacePatternsKey: "packages",
  scriptsKey: "scripts",
  wrapperSeparator: " -- ",
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

export const entryBodyOf = ({
  value,
  layer,
  config,
}: {
  readonly value: string;
  readonly layer: EntryCompositionLayer;
  readonly config: EntryCompositionConfig;
}): string => {
  const separatorIndex = value.indexOf(config.wrapperSeparator);
  if (separatorIndex === -1) {
    const terminalSeparator = config.wrapperSeparator.trimEnd();
    const trimmedValue = value.trimEnd();
    const wrapperHead = trimmedValue.endsWith(terminalSeparator)
      ? trimmedValue.slice(0, -terminalSeparator.length)
      : null;
    const wrapperOnly =
      wrapperHead !== null &&
      layer.wrappers.some((wrapper) => wrapperNameOf(wrapper) === wrapperNameOf(wrapperHead));
    return wrapperOnly ? "" : value;
  }
  const headName = wrapperNameOf(value.slice(0, separatorIndex));
  return layer.wrappers.map(wrapperNameOf).includes(headName)
    ? entryBodyOf({
        value: value.slice(separatorIndex + config.wrapperSeparator.length),
        layer,
        config,
      })
    : value;
};
