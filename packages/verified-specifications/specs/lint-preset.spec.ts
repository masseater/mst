import { describe, expect, it } from "vite-plus/test";

import { oxlint } from "../src/index.ts";

const SPECS_DIRECTORY_OVERRIDE = {
  files: ["**/specs/**"],
  rules: {
    "vitest/consistent-test-filename": ["error", { pattern: "\\.spec\\.tsx?$" }],
    "dont-review-it/no-detached-test-file--move-beside-source": "off",
  },
};

const SPEC_FILE_OVERRIDE = {
  files: ["**/*.spec.ts", "**/*.spec.tsx"],
  rules: {
    "vitest/max-nested-describe": ["error", { max: 1 }],
  },
};

describe("lint の配布設定", () => {
  it("specs ディレクトリに .spec.ts 以外のテストを置けない設定を配る", () => {
    expect(oxlint.overrides).toContainEqual(SPECS_DIRECTORY_OVERRIDE);
  });

  it("仕様担保テストの describe の入れ子を 1 段に制限する設定を配る", () => {
    expect(oxlint.overrides).toContainEqual(SPEC_FILE_OVERRIDE);
  });

  it("specs の中のテストを、ソース隣接の要求から外す設定を配る", () => {
    expect(
      SPECS_DIRECTORY_OVERRIDE.rules["dont-review-it/no-detached-test-file--move-beside-source"],
    ).toBe("off");
    expect(oxlint.overrides).toContainEqual(SPECS_DIRECTORY_OVERRIDE);
  });
});
