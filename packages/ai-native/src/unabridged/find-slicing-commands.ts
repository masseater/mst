import { parse, type ParseEntry } from "shell-quote";

const slicingCommands: ReadonlySet<string> = new Set(["head", "tail"]);

const commandStartingOperators: ReadonlySet<string> = new Set([
  "&",
  "&&",
  "(",
  ";",
  ";;",
  "<(",
  "|",
  "|&",
  "||",
]);

type CommandScan = {
  readonly atCommandPosition: boolean;
  readonly slicers: ReadonlySet<string>;
};

const scannedWith = (scan: CommandScan, parsedEntry: ParseEntry): CommandScan => {
  if (typeof parsedEntry === "string") {
    const executable = parsedEntry.slice(parsedEntry.lastIndexOf("/") + 1);
    return {
      atCommandPosition: false,
      slicers:
        scan.atCommandPosition && slicingCommands.has(executable)
          ? new Set([...scan.slicers, executable])
          : scan.slicers,
    };
  }
  return "op" in parsedEntry
    ? { atCommandPosition: commandStartingOperators.has(parsedEntry.op), slicers: scan.slicers }
    : scan;
};

export const findSlicingCommands = (commandLine: string): readonly string[] => [
  ...parse(commandLine).reduce(scannedWith, {
    atCommandPosition: true,
    slicers: new Set<string>(),
  }).slicers,
];
