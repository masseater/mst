import { EXIT_MISUSE, EXIT_SUCCESS, type CliResult } from "@mst/utils";

import { isParseFailure, parseArgs, type Command } from "./cli/parse-args.ts";

const USAGE = `Usage: auto-develop <command> [options]

Commands:
  reviewer           run the reviewer runtime against the relay
  author             run the author runtime against the relay
  prepare-review     regenerate the reviewer run context in this worktree
  prepare-author     regenerate the author run context in this worktree
  build-pr-context   collect the PR context into JSON and Markdown

Options:
  --concurrency <n>  how many PR jobs run at once (default: 3)
  --dry-run          skip every write to GitHub
  --pr <n>           limit the run to one PR (repeatable)
  --exclude-pr <n>   keep one PR out of the run (repeatable)
  --gh-user <login>  act as this GitHub login instead of resolving it
  --engine <name>    which agent CLI to launch (default: claude)
`;

export type CommandRunner = (run: {
  readonly command: Command;
  readonly flags: Readonly<Record<string, string | boolean>>;
}) => CliResult;

export const runAutoDevelop = (
  argv: readonly string[] = process.argv.slice(2),
  runCommand?: CommandRunner,
): CliResult => {
  const parsed = parseArgs(argv);
  if (isParseFailure(parsed)) {
    return { exitCode: EXIT_MISUSE, out: "", error: `${parsed.message}\n\n${USAGE}` };
  }
  if (runCommand === undefined) {
    return {
      exitCode: EXIT_SUCCESS,
      out: `auto-develop ${parsed.command} is wired but has no runner attached in this build\n`,
      error: "",
    };
  }
  return runCommand({ command: parsed.command, flags: parsed.flags });
};
