import { EXIT_MISUSE, type CliResult } from "@mst/utils";

const USAGE = `Usage: auto-develop <command>
`;

export const runAutoDevelop = (): CliResult => ({ exitCode: EXIT_MISUSE, out: "", error: USAGE });
