import { describe, expect, it } from "vite-plus/test";

import { withGitExcludes } from "../src/configs/with-git-excludes.ts";

describe("設定への git 除外の注入", () => {
  it("呼び手が書いた除外パターンを、git 由来の除外の後ろに残す", () => {
    const wrapped = withGitExcludes({ ignorePatterns: ["caller-marker/**"] });
    expect(wrapped.ignorePatterns?.at(-1)).toBe("caller-marker/**");
  }, 30_000);

  it("除外を書いていない呼び手の設定にも、除外パターンの配列を与える", () => {
    const wrapped = withGitExcludes({});
    expect(Array.isArray(wrapped.ignorePatterns)).toBe(true);
  }, 30_000);
});
