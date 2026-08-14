import { describe, expect, it } from "vite-plus/test";

import { oxfmt } from "../src/configs/oxfmt.ts";
import { specDirectoryOverrides } from "../src/configs/spec-directory-overrides.ts";
import { withGitExcludes } from "../src/configs/with-git-excludes.ts";

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

describe("ツールチェーン設定の preset", () => {
  it("呼び手が書いた除外パターンを、git 由来の除外の後ろに残す", () => {
    const wrapped = withGitExcludes({ ignorePatterns: ["caller-marker/**"] });
    expect(wrapped.ignorePatterns?.at(-1)).toBe("caller-marker/**");
  });

  it("除外を書いていない呼び手の設定にも、除外パターンの配列を与える", () => {
    const wrapped = withGitExcludes({});
    expect(Array.isArray(wrapped.ignorePatterns)).toBe(true);
  });

  it("markdown の段落を折り返さない整形を、呼び手が書かなくても与える", () => {
    expect(oxfmt.proseWrap).toBe("never");
  });

  it("specs ディレクトリのテストに .spec.ts の名前を要求し、ソース隣接の要求から外す設定を配る", () => {
    expect(specDirectoryOverrides).toContainEqual(SPECS_DIRECTORY_OVERRIDE);
  });

  it("仕様担保テストの describe の入れ子を 1 段に制限する設定を配る", () => {
    expect(specDirectoryOverrides).toContainEqual(SPEC_FILE_OVERRIDE);
  });
});
