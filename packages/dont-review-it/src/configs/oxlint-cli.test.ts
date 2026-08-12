import { LINT_SEVERITY } from "@mst/lint-rule-authoring";
import { describe, expect, test } from "vite-plus/test";

import { oxlint } from "./oxlint.ts";

describe("oxlint CLI config", () => {
  test("it adds only the CLI rules without changing the base config", async () => {
    const baseConfigBeforeImport = structuredClone(oxlint);
    const cliOnlyRules = {
      "dont-review-it/no-citty-parent-run--move-run-into-a-subcommand": LINT_SEVERITY.ERROR,
      "dont-review-it/no-handmade-standard-io-double--use-standard-io-test": LINT_SEVERITY.ERROR,
      "dont-review-it/require-standard-io-snapshot--pin-both-streams": LINT_SEVERITY.ERROR,
    };

    const { oxlintCli } = await import("./oxlint-cli.ts");

    expect(oxlint).toStrictEqual(baseConfigBeforeImport);
    expect(
      Object.fromEntries(
        Object.entries(oxlintCli.rules ?? {}).filter(
          ([ruleName]) => !Object.hasOwn(baseConfigBeforeImport.rules ?? {}, ruleName),
        ),
      ),
    ).toStrictEqual(cliOnlyRules);
    expect(oxlintCli).toStrictEqual({
      ...baseConfigBeforeImport,
      rules: {
        ...baseConfigBeforeImport.rules,
        ...cliOnlyRules,
      },
    });
  });
});
