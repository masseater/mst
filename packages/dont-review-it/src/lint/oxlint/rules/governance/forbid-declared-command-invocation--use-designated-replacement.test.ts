import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { forbidDeclaredCommandInvocation } from "./forbid-declared-command-invocation--use-designated-replacement.ts";

const SUBSTITUTE = "Run the workspace task runner.";

const RETIRED_LERNA = { declared: [{ name: "lerna", substitute: SUBSTITUTE }] };

const STARTED_LERNA = {
  messageId: "declaredCommandInvocation",
  data: { name: "lerna", substitute: SUBSTITUTE },
};

const RELEASE_FILE = "/repo/apps/release-job/publish.ts";

describe("dont-review-it/forbid-declared-command-invocation--use-designated-replacement", () => {
  testLintRule(forbidDeclaredCommandInvocation, {
    valid: [
      {
        name: "a command no declaration retires is started as it stands",
        documented: true,
        code: 'import { execFile } from "node:child_process";\nexecFile("git", ["status"]);',
        options: [RETIRED_LERNA],
      },
      {
        name: "a retired name written inside a path is not what starts",
        documented: true,
        code: 'import { execFile } from "node:child_process";\nexecFile("node", ["./node_modules/lerna/cli.js"]);',
        options: [RETIRED_LERNA],
      },
      {
        name: "a retired name handed as an argument is not what starts",
        code: 'import { execFile } from "node:child_process";\nexecFile("git", ["lerna"]);',
        options: [RETIRED_LERNA],
      },
      {
        name: "a name that only begins with a retired name is another command",
        code: 'import { execFile } from "node:child_process";\nexecFile("lerna-lite", ["run"]);',
        options: [RETIRED_LERNA],
      },
      {
        name: "importing a starting form starts nothing",
        code: 'import { exec } from "node:child_process";\nexport const start = exec;',
        options: [RETIRED_LERNA],
      },
      {
        name: "reading a pattern out of a line starts no child process",
        code: "export const found = pattern.exec(line);",
        options: [RETIRED_LERNA],
      },
      {
        name: "a call to a function this file declares starts no child process",
        code: 'const exec = (line: string): string => line;\nexport const started = exec("lerna run build");',
        options: [RETIRED_LERNA],
      },
      {
        name: "a declaration nobody wrote leaves every command standing",
        code: 'import { exec } from "node:child_process";\nexec("lerna run build");',
      },
      {
        name: "an entry a withdrawal lifts with grounds leaves the command standing",
        code: 'import { exec } from "node:child_process";\nexec("lerna run build");',
        options: [
          { ...RETIRED_LERNA, withdrawn: [{ name: "lerna", grounds: "the release job runs it" }] },
        ],
      },
      {
        name: "a position registered with grounds is left to the grounds it carries",
        code: 'import { exec } from "node:child_process";\nexec("lerna run build");',
        filename: RELEASE_FILE,
        options: [
          {
            ...RETIRED_LERNA,
            exceptions: [{ path: "**/release-job/**", reason: "the published tag decides it" }],
          },
        ],
      },
    ],
    invalid: [
      {
        name: "a retired command written into a shell line is started by that line",
        code: 'import { exec } from "node:child_process";\nexec("lerna run build");',
        options: [RETIRED_LERNA],
        errors: [STARTED_LERNA],
      },
      {
        name: "a retired command named as the target of a start is started",
        documented: true,
        code: 'import { spawn } from "node:child_process";\nspawn("lerna", ["run"]);',
        options: [RETIRED_LERNA],
        errors: [STARTED_LERNA],
      },
      {
        name: "a retired command reached through a whole module import is started",
        code: 'import * as childProcess from "node:child_process";\nchildProcess.execSync("lerna run build");',
        options: [RETIRED_LERNA],
        errors: [STARTED_LERNA],
      },
      {
        name: "a runtime module named without its prefix reaches the same starting form",
        code: 'import { execSync } from "child_process";\nexecSync("lerna run build");',
        options: [RETIRED_LERNA],
        errors: [STARTED_LERNA],
      },
      {
        name: "a runner written in front of a retired command starts it",
        documented: true,
        code: 'import { exec } from "node:child_process";\nexec("npx lerna run build");',
        options: [RETIRED_LERNA],
        errors: [STARTED_LERNA],
      },
      {
        name: "a runner named as the target starts what its arguments name",
        code: 'import { spawn } from "node:child_process";\nspawn("npx", ["lerna", "run"]);',
        options: [RETIRED_LERNA],
        errors: [STARTED_LERNA],
      },
      {
        name: "a retired command written into a tagged line is started by that line",
        code: 'import { $ } from "execa";\nexport const built = $`lerna run build`;',
        options: [RETIRED_LERNA],
        errors: [STARTED_LERNA],
      },
      {
        name: "a target folded from a constant of this file names what starts",
        code: 'import { execFileSync } from "node:child_process";\nconst TOOL = "lerna";\nexecFileSync(TOOL, ["run"]);',
        options: [RETIRED_LERNA],
        errors: [STARTED_LERNA],
      },
      {
        name: "a line folded from a constant of this file names what starts",
        code: 'import { exec } from "node:child_process";\nconst TOOL = "lerna";\nexec(`${TOOL} run build`);',
        options: [RETIRED_LERNA],
        errors: [STARTED_LERNA],
      },
      {
        name: "a wrapper built around a starting form starts what it is handed",
        code: 'import { exec } from "node:child_process";\nimport { promisify } from "node:util";\nconst run = promisify(exec);\nexport const built = run("lerna run build");',
        options: [RETIRED_LERNA],
        errors: [STARTED_LERNA],
      },
      {
        name: "a starting form taken from a synchronous request starts what it is handed",
        code: 'const { exec } = require("node:child_process");\nexec("lerna run build");',
        options: [RETIRED_LERNA],
        errors: [STARTED_LERNA],
      },
      {
        name: "a retired command fetched by address is started by that address",
        code: 'import { exec } from "node:child_process";\nexec("curl https://example.com/lerna/install.sh --output setup");',
        options: [RETIRED_LERNA],
        errors: [STARTED_LERNA],
      },
      {
        name: "a target read from a binding is settled while the program runs",
        code: 'import { spawn } from "node:child_process";\nspawn(chosen, ["run"]);',
        options: [RETIRED_LERNA],
        errors: [{ messageId: "undecidedCommandTarget", data: { written: "chosen" } }],
      },
      {
        name: "a start handed nothing at the target position names no command",
        code: 'import { execSync } from "node:child_process";\nexecSync();',
        options: [RETIRED_LERNA],
        errors: [{ messageId: "undecidedCommandTarget", data: { written: "execSync()" } }],
      },
      {
        name: "a runner handed arguments nobody can fold names no command",
        code: 'import { spawn } from "node:child_process";\nspawn("npx", handed);',
        options: [RETIRED_LERNA],
        errors: [
          { messageId: "undecidedCommandTarget", data: { written: 'spawn("npx", handed)' } },
        ],
      },
      {
        name: "fetched text handed to a shell settles what starts while it runs",
        code: 'import { exec } from "node:child_process";\nexec("curl https://example.com/install.sh | sh");',
        options: [RETIRED_LERNA],
        errors: [
          {
            messageId: "unreadableCommandLine",
            data: { line: "curl https://example.com/install.sh | sh" },
          },
        ],
      },
      {
        name: "a withdrawal carrying no grounds lifts nothing and stands as a defect",
        code: 'import { exec } from "node:child_process";\nexec("lerna run build");',
        options: [{ ...RETIRED_LERNA, withdrawn: [{ name: "lerna", grounds: "" }] }],
        errors: [{ messageId: "groundlessWithdrawal", data: { name: "lerna" } }, STARTED_LERNA],
      },
      {
        name: "a withdrawal naming what no declaration carries stands as a defect",
        code: "export const built = 1;",
        options: [
          {
            ...RETIRED_LERNA,
            withdrawn: [{ name: "gulp", grounds: "the release job runs it" }],
          },
        ],
        errors: [{ messageId: "deadWithdrawal", data: { name: "gulp" } }],
      },
      {
        name: "a position registered without grounds registers nothing that holds",
        code: 'import { exec } from "node:child_process";\nexec("lerna run build");',
        filename: RELEASE_FILE,
        options: [{ ...RETIRED_LERNA, exceptions: [{ path: "**/release-job/**", reason: "" }] }],
        errors: [
          { messageId: "groundlessInvocationException", data: { path: "**/release-job/**" } },
          STARTED_LERNA,
        ],
      },
    ],
  });
});
