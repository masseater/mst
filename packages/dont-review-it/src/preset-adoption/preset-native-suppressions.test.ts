import { describe, expect, test } from "vite-plus/test";

import { defaultPresetAdoptionConfig } from "./config.ts";
import { presetNativeSuppressionProblems } from "./preset-native-suppressions.ts";

const GUARD_RULE =
  "no-inline-suppression-of-protected-rule--register-the-exception-in-configuration";

describe("presetNativeSuppressionProblems", () => {
  const it = test
    .extend("blanketProblems", () =>
      presetNativeSuppressionProblems({
        file: "src/order.ts",
        source: "// oxlint-disable-next-line\nconst order = readOrder();\n",
        config: defaultPresetAdoptionConfig,
      }))
    .extend("guardProblems", () =>
      presetNativeSuppressionProblems({
        file: "src/order.ts",
        source: `// oxlint-disable-next-line dont-review-it/${GUARD_RULE}, dont-review-it/no-rule-suppression--fix-the-violation
const order = readOrder();
`,
        config: defaultPresetAdoptionConfig,
      }),
    )
    .extend("unrelatedProblems", () =>
      presetNativeSuppressionProblems({
        file: "src/order.ts",
        source: [
          "// oxlint-disable-next-line no-console -- approved locally",
          "// eslint-disable-next-line dont-review-it/" + GUARD_RULE,
          "// This text mentions oxlint-disable",
          "// oxlint-disabled",
          `const written = "// oxlint-disable-next-line dont-review-it/${GUARD_RULE}";`,
          "const shown = `/* oxlint-disable */`;",
        ].join("\n"),
        config: defaultPresetAdoptionConfig,
      }),
    );

  it("rejects a native blanket directive without rule names", ({ blanketProblems }) => {
    expect(blanketProblems).toStrictEqual([
      {
        file: "src/order.ts",
        line: 1,
        message: `A native Oxlint disable directive must not suppress every rule or ${GUARD_RULE}, because that removes the guard that rejects protected-rule suppressions. Delete the directive and register an allowed deviation in configuration.`,
      },
    ]);
  });

  it("rejects a native directive that names the suppression guard", ({ guardProblems }) => {
    expect(guardProblems).toStrictEqual([
      {
        file: "src/order.ts",
        line: 1,
        message: `A native Oxlint disable directive must not suppress every rule or ${GUARD_RULE}, because that removes the guard that rejects protected-rule suppressions. Delete the directive and register an allowed deviation in configuration.`,
      },
    ]);
  });

  it("accepts unrelated native directives, eslint directives, prose, prefixes, strings, and templates", ({
    unrelatedProblems,
  }) => {
    expect(unrelatedProblems).toStrictEqual([]);
  });
});
