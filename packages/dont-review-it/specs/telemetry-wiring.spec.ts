import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { defaultTelemetryWiringConfig } from "../src/telemetry-wiring/config.ts";
import { runTelemetryWiringChecks } from "../src/telemetry-wiring/run-telemetry-wiring-checks.ts";

const config = defaultTelemetryWiringConfig;

const WORKSPACES = {
  "package.json": `{"spelled": "root"}`,
  "packages/measured/package.json": `{"spelled": "measured"}`,
};

const repositoryWith = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "dont-review-it-telemetry-wiring-"));
  onTestFinished(async () => rm(repositoryRoot, { recursive: true, force: true }));

  await Promise.all(
    Object.entries(files).map(async ([spelled, source]) => {
      const checked = join(repositoryRoot, spelled);
      await mkdir(dirname(checked), { recursive: true });
      await writeFile(checked, source, "utf-8");
    }),
  );
  return repositoryRoot;
};

describe("計測の配線の検査", () => {
  it("計測を宣言している test ブロックを黙って通す", async () => {
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
      "packages/measured/vite.config.ts": `export default defineConfig({
  test: { experimental: { openTelemetry: { enabled: true, sdkPath: "./sdk.ts" } } },
});`,
    });

    expect(runTelemetryWiringChecks({ repositoryRoot, config }).problems).toStrictEqual([]);
  });

  it("計測を宣言していない test ブロックを、宣言を足す指示とともに報告する", async () => {
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
      "packages/measured/vite.config.ts": `export default defineConfig({
  test: { testTimeout: 15000 },
});`,
    });

    expect(runTelemetryWiringChecks({ repositoryRoot, config }).problems).toStrictEqual([
      {
        file: "packages/measured/vite.config.ts",
        line: 1,
        message:
          "A test block must not run without telemetry, because a workspace nobody measures is indistinguishable from a workspace that is fast. Declare experimental.openTelemetry in this block.",
      },
    ]);
  });

  it("宣言の途中までしか書かれていない test ブロックも報告する", async () => {
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
      "packages/measured/vite.config.ts": `export default defineConfig({
  test: { experimental: { defaultBrowserPort: 63315 } },
});`,
    });

    expect(runTelemetryWiringChecks({ repositoryRoot, config }).problems).toHaveLength(1);
  });

  it("宣言された計測が無効にされていても、宣言があるものとして通す", async () => {
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
      "packages/measured/vite.config.ts": `export default defineConfig({
  test: { experimental: { openTelemetry: { enabled: false } } },
});`,
    });

    expect(runTelemetryWiringChecks({ repositoryRoot, config }).problems).toStrictEqual([]);
  });

  it("test ブロックを持たない設定を報告しない", async () => {
    const repositoryRoot = await repositoryWith({
      ...WORKSPACES,
      "packages/measured/vite.config.ts": `export default defineConfig({
  pack: { entry: ["src/index.ts"] },
});`,
    });

    expect(runTelemetryWiringChecks({ repositoryRoot, config }).problems).toStrictEqual([]);
  });

  it("ツールチェーンの設定を持たないワークスペースを報告しない", async () => {
    const repositoryRoot = await repositoryWith(WORKSPACES);

    expect(runTelemetryWiringChecks({ repositoryRoot, config }).problems).toStrictEqual([]);
  });

  it("マニフェストを持つディレクトリを、開いた対象として数える", async () => {
    const repositoryRoot = await repositoryWith(WORKSPACES);

    expect(runTelemetryWiringChecks({ repositoryRoot, config }).scanned).toBe(2);
  });
});
