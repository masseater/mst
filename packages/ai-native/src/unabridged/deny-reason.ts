import { findSlicingCommands } from "./find-slicing-commands.ts";
import { denyReasonFor } from "./message.ts";

const commandOf = (toolInput: unknown): string =>
  typeof toolInput === "object" &&
  toolInput !== null &&
  "command" in toolInput &&
  typeof toolInput.command === "string"
    ? toolInput.command
    : "";

export const denyReasonOf = (toolName: string, toolInput: unknown): string | undefined => {
  const found = toolName === "Bash" ? findSlicingCommands(commandOf(toolInput)) : [];
  return found.length === 0 ? undefined : denyReasonFor(found);
};
