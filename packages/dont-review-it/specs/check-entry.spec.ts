import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { EXIT_MISUSE, EXIT_PROBLEMS_FOUND, EXIT_SUCCESS } from "@mst/repository-checks";
import { runCommand } from "citty";
import { describe, expect, onTestFinished, it } from "vite-plus/test";

import { dontReviewItCommand } from "../src/dont-review-it-command.ts";
import { runChecks } from "../src/run-checks.ts";

const repositoryWith = (files: Readonly<Record<string, string>>): string => {
  const root = mkdtempSync(join(tmpdir(), "dont-review-it-spec-"));
  onTestFinished(() => {
    rmSync(root, { recursive: true, force: true });
  });
  for (const [path, source] of Object.entries(files)) {
    const fixturePath = join(root, path);
    mkdirSync(dirname(fixturePath), { recursive: true });
    writeFileSync(fixturePath, source, "utf8");
  }
  return root;
};

describe("リポジトリ検査の入口", () => {
  it("check 以外の命令を名指しで拒否する", async () => {
    await expect(runCommand(dontReviewItCommand, { rawArgs: ["deploy"] })).rejects.toThrow(
      /Unknown command/u,
    );
  });

  it("存在しない場所を検査対象に取らない", async () => {
    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--repository-root", "/nonexistent/verified-specifications-probe"],
    });

    expect(process.exitCode).toBe(EXIT_MISUSE);
    process.exitCode = 0;
  });

  it("依存バージョンの食い違いを報告して失敗する", async () => {
    const repositoryRoot = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\ncatalog:\n  react: ^19.0.0\n",
      "packages/legacy/package.json": `{"dependencies": {"react": "^18.0.0"}}`,
      "packages/site/package.json": `{"dependencies": {"react": "catalog:"}, "devDependencies": {"typescript": "^5.5.0"}}`,
      "packages/web/package.json": `{"dependencies": {"react": "catalog:"}, "devDependencies": {"typescript": "^5.0.0"}}`,
    });

    const reported = runChecks(repositoryRoot).problems.join("\n");
    expect(reported).toContain("react is pinned to ^18.0.0 here while the catalog pins ^19.0.0");
    expect(reported).toContain("typescript is pinned to different specifiers");

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    process.exitCode = 0;
  });

  it("vite.config.ts が dontReviewItPreset.lint を直接呼ばなければ報告して失敗する", async () => {
    const repositoryRoot = repositoryWith({
      "vite.config.ts": `export default { lint: {} };`,
    });

    expect(runChecks(repositoryRoot).problems.join("\n")).toContain(
      "exactly one direct call to dontReviewItPreset.lint",
    );

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    process.exitCode = 0;
  });

  it("vite.config.ts が値 import した dontReviewItPreset.lint を直接呼べば check を成功させる", async () => {
    const repositoryRoot = repositoryWith({
      "vite.config.ts": `import { dontReviewItPreset } from "@mst/dont-review-it";
export default { lint: dontReviewItPreset.lint({}) };`,
    });

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(EXIT_SUCCESS);
    process.exitCode = 0;
  });

  it("test command が config を差し替える経路を報告して失敗する", async () => {
    const repositoryRoot = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "package.json": `{"private": true, "scripts": {"test": "vp test --config arbitrary.ts"}}`,
    });

    expect(runChecks(repositoryRoot).problems.join("\n")).toContain(
      "The test script must not select a test config with `--config` or `-c`",
    );

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    process.exitCode = 0;
  });

  it("test command が coverage 設定を上書きするか対象を変更ファイルだけに絞る経路を報告して失敗する", async () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{"private": true, "scripts": {"test": "vp test --changed HEAD --coverage.exclude=src/**"}}`,
    });

    const reported = runChecks(repositoryRoot).problems.join("\n");
    expect(reported).toContain("must not override coverage settings");
    expect(reported).toContain("reduce the coverage source universe");

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    process.exitCode = 0;
  });

  it("root guard が再帰 test へ安全な coverage と worker 上限以外を転送する経路を報告して失敗する", async () => {
    const repositoryRoot = repositoryWith({
      "package.json": JSON.stringify({
        private: true,
        scripts: {
          guard: "throttle --timeout 1800 -- spool -- vp run guard:all",
          "guard:all":
            "vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2 --config alternate.ts",
        },
      }),
    });

    const reported = runChecks(repositoryRoot).problems.join("\n");
    expect(reported).toContain("The root `guard:all` script must not omit, delegate");
    expect(reported).toContain("only `--coverage` and `--maxWorkers 2` may be forwarded");

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    process.exitCode = 0;
  });

  it("test entry が別 package へ委譲する経路と通常run以外のrunner引数を報告して失敗する", async () => {
    const repositoryRoot = repositoryWith({
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "package.json": `{"private":true}`,
      "packages/delegated/package.json": `{"private":true,"scripts":{"test":"spool -- vp run other#test"}}`,
      "packages/non-run/package.json": `{"private":true,"scripts":{"test":"vp test --help"}}`,
      "packages/filtered/package.json": `{"private":true,"scripts":{"test":"vitest run run"}}`,
    });

    const reported = runChecks(repositoryRoot).problems.join("\n");
    expect(reported).toContain("must expose exactly one normal test run in the current package");
    expect(reported).toContain(
      "must not select a test subset, alternate root or project, non-run mode",
    );

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    process.exitCode = 0;
  });

  it("test entry の前後に pretest と posttest の別経路を置く構成を報告して失敗する", async () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{"private":true,"scripts":{"guard":"throttle --timeout 1800 -- spool -- vp run guard:all"}}`,
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/app/package.json": `{"private":true,"scripts":{"pretest":"node prepare.mjs","test":"spool -- vp test","posttest":"node cleanup.mjs"}}`,
    });

    const reported = runChecks(repositoryRoot).problems.join("\n");
    expect(reported).toContain("`scripts.pretest` lifecycle entry must not run");
    expect(reported).toContain("`scripts.posttest` lifecycle entry must not run");

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    process.exitCode = 0;
  });

  it("test config を持つ workspace の scripts.test 欠落と非文字列を報告して失敗する", async () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{"private":true,"scripts":{"guard":"throttle --timeout 1800 -- spool -- vp run guard:all"}}`,
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/missing/package.json": `{"private":true,"scripts":{}}`,
      "packages/missing/vite.config.ts": "export default {};\n",
      "packages/non-string/package.json": `{"private":true,"scripts":{"test":false}}`,
      "packages/non-string/vitest.config.cjs": "module.exports = {};\n",
    });

    const reported = runChecks(repositoryRoot).problems.join("\n");
    expect(reported).toContain("must not omit `scripts.test`");
    expect(reported).toContain("must not declare `scripts.test` as a non-string value");

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    process.exitCode = 0;
  });

  it("wrapper prefix が欠けた entry を報告して失敗する", async () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{"scripts": {"guard": "vp run guard:all"}}`,
    });

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    process.exitCode = 0;
  });

  it("check --write が安全な entry composition を修復して再検査を通す", async () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{"scripts":{"guard":"vp run guard:all","guard:all":"vp run -r --concurrency-limit 1 test --coverage --maxWorkers 2"}}`,
    });

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--write", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(0);
    expect(readFileSync(join(repositoryRoot, "package.json"), "utf8")).toContain(
      "throttle --timeout 1800 -- spool -- vp run guard:all",
    );
  });

  it("check --write が本体の無い guard を生成せず問題として残す", async () => {
    const original = `{"private":true}`;
    const repositoryRoot = repositoryWith({ "package.json": original });

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--write", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    expect(readFileSync(join(repositoryRoot, "package.json"), "utf8")).toBe(original);
    expect(runChecks(repositoryRoot).problems.join("\n")).toContain(
      'The scripts section holding the required "guard" entry must not be missing',
    );
    process.exitCode = 0;
  });

  it("check --write が command body の空の guard を補完せず問題として残す", async () => {
    const original = `{"scripts":{"guard":"spool --"}}`;
    const repositoryRoot = repositoryWith({ "package.json": original });

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--write", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    expect(readFileSync(join(repositoryRoot, "package.json"), "utf8")).toBe(original);
    expect(runChecks(repositoryRoot).problems.join("\n")).toContain(
      'The "guard" script must not end before its command body',
    );
    process.exitCode = 0;
  });

  it("check --write が他 layer の wrapper を自動修復せず問題として残す", async () => {
    const repositoryRoot = repositoryWith({
      "package.json": `{"scripts": {"guard": "throttle --timeout 1800 -- spool -- vp run guard:all"}}`,
      "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "packages/app/package.json": `{"scripts": {"test": "throttle -- vp test"}}`,
    });

    const entryCompositionProblem =
      'The "test" script must not start with "throttle ". Rewrite the value to start with the required prefix "spool -- ".';
    expect(runChecks(repositoryRoot).problems.join("\n")).toContain(entryCompositionProblem);

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--write", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(EXIT_PROBLEMS_FOUND);
    expect(readFileSync(join(repositoryRoot, "packages/app/package.json"), "utf8")).toContain(
      "throttle -- vp test",
    );
    expect(runChecks(repositoryRoot).problems.join("\n")).toContain(entryCompositionProblem);
    process.exitCode = 0;
  });

  it("check --write が解釈できない manifest を書き換えず misuse として失敗する", async () => {
    const repositoryRoot = repositoryWith({ "package.json": "{ invalid" });

    process.exitCode = 0;
    await runCommand(dontReviewItCommand, {
      rawArgs: ["check", "--write", "--repository-root", repositoryRoot],
    });

    expect(process.exitCode).toBe(EXIT_MISUSE);
    expect(readFileSync(join(repositoryRoot, "package.json"), "utf8")).toBe("{ invalid");
    process.exitCode = 0;
  });
});
