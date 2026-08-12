import { describe, expect, test } from "vite-plus/test";

import { buildRunMetadata, runMetadataLogFields } from "./run-metadata.ts";

const baseBuild = {
  mode: "reviewer" as const,
  engine: "claude" as const,
  ghUser: "review-bot",
  ghUserSource: "auto" as const,
  ghTokenSource: "github-cli" as const,
  concurrency: 3,
  dryRun: false,
  dangerouslySkipPermissions: false,
  targetPrs: [7],
  excludedPrs: [9],
};

const it = test
  .extend("defaultMetadata", () => buildRunMetadata(baseBuild))
  .extend("overriddenMetadata", () =>
    buildRunMetadata({ ...baseBuild, engineOverride: "wrapper claude" }),
  )
  .extend("copiedTargets", () => {
    const mutableTargets = new Set([7]);
    const metadata = buildRunMetadata({ ...baseBuild, targetPrs: [...mutableTargets] });
    mutableTargets.add(11);
    return metadata.targetPrs;
  })
  .extend("logFields", () => runMetadataLogFields(buildRunMetadata(baseBuild)))
  .extend("logFieldNames", () => Object.keys(runMetadataLogFields(buildRunMetadata(baseBuild))));

describe("buildRunMetadata", () => {
  it("上書きが無ければ起動コマンドはエンジン名そのものになる", ({ defaultMetadata }) => {
    expect(defaultMetadata.engineCommand).toStrictEqual("claude");
  });

  it("上書きが無ければ由来は default になる", ({ defaultMetadata }) => {
    expect(defaultMetadata.engineOverrideSource).toStrictEqual("default");
  });

  it("上書きがあれば起動コマンドはその文字列になる", ({ overriddenMetadata }) => {
    expect(overriddenMetadata.engineCommand).toStrictEqual("wrapper claude");
  });

  it("上書きがあれば由来は override になる", ({ overriddenMetadata }) => {
    expect(overriddenMetadata.engineOverrideSource).toStrictEqual("override");
  });

  it("PR 番号のリストは複製されて後の変更を受けない", ({ copiedTargets }) => {
    expect(copiedTargets).toStrictEqual([7]);
  });
});

describe("runMetadataLogFields", () => {
  it("ログ用フィールドに GitHub ログインを含めない", ({ logFieldNames }) => {
    expect(logFieldNames).not.toContain("ghUser");
  });

  it("ログ用フィールドに identity の由来は含める", ({ logFields }) => {
    expect(logFields.ghUserSource).toStrictEqual("auto");
  });

  it("ログ用フィールドに token の取得経路は含める", ({ logFields }) => {
    expect(logFields.ghTokenSource).toStrictEqual("github-cli");
  });
});
