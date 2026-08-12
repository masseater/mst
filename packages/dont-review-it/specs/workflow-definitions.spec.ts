import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { runChecks } from "../src/run-checks.ts";

const WORKFLOW_PATH = ".github/workflows/ci.yml";

const RENOVATE_PATH = "renovate.json";

const PINNED_SHA = "3d3c42e5aac5ba805825da76410c181273ba90b1";

const repositoryWith = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "dont-review-it-workflows-"));
  onTestFinished(async () => rm(repositoryRoot, { recursive: true, force: true }));

  await Promise.all(
    Object.entries(files).map(async ([fileName, source]) => {
      const absolutePath = join(repositoryRoot, fileName);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, source, "utf-8");
    }),
  );
  return repositoryRoot;
};

const reportedForWorkflow = async (workflowSource: string): Promise<string> => {
  const repositoryRoot = await repositoryWith({ [WORKFLOW_PATH]: workflowSource });
  const { problems } = runChecks(repositoryRoot);
  expect(problems.length).toBeGreaterThan(0);
  return problems.join("\n");
};

describe("ワークフロー定義の検査", () => {
  it("解釈できない定義を、どの検査も素通りする前に場所を指して報告する", async () => {
    const reported = await reportedForWorkflow("on: [pull_request\n");
    expect(reported).toContain(`${WORKFLOW_PATH}:`);
    expect(reported).toContain("must not stay in the repository");
  });

  it("ゲートとして要求されうるトリガが、自分の起動をパスやブランチで絞り込んでいたら報告する", async () => {
    const reported = await reportedForWorkflow(`on:
  pull_request:
    paths: [src/**]
permissions:
  contents: read
jobs:
  ready:
    steps:
      - run: vp run guard
`);
    expect(reported).toContain("must not narrow its own start");
  });

  it("呼び出される部品が、自分を起動するトリガを併せ持っていたら報告する", async () => {
    const reported = await reportedForWorkflow(`on:
  workflow_call:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - run: vp run guard
`);
    expect(reported).toContain("must not own a trigger of its own");
  });

  it("別のワークフローの結果を受けて起動する連鎖を報告する", async () => {
    const reported = await reportedForWorkflow(`on:
  workflow_run:
    workflows: [CI]
    types: [completed]
permissions:
  contents: read
jobs:
  after:
    steps:
      - run: vp run deploy
`);
    expect(reported).toContain("must not be split across runs");
  });

  it("権限を宣言しないまま既定の権限で走るジョブを報告する", async () => {
    const reported = await reportedForWorkflow(`on:
  pull_request:
jobs:
  ready:
    steps:
      - run: vp run guard
`);
    expect(reported).toContain("Declare permissions");
  });

  it("1 つの実行ブロックに複数のコマンド呼び出しを詰めたステップを報告する", async () => {
    const reported = await reportedForWorkflow(`on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - run: vp install && vp run guard
`);
    expect(reported).toContain("must not hold more than one command call");
  });

  it("失敗を握りつぶす記述を実行ブロックに置けない", async () => {
    const reported = await reportedForWorkflow(`on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - run: vp run guard || true
`);
    expect(reported).toContain("must not be swallowed inside a run block");
  });

  it("タグで参照したアクションを報告する", async () => {
    const reported = await reportedForWorkflow(`on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - uses: actions/checkout@v5
`);
    expect(reported).toContain("must not end in a tag or a branch");
  });

  it("固定はしたが版を書き添えていないアクション参照を報告する", async () => {
    const reported = await reportedForWorkflow(`on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - uses: actions/checkout@${PINNED_SHA}
`);
    expect(reported).toContain("must not stand without the version it pins");
  });

  it("履歴を全部取りにいくチェックアウトを報告する", async () => {
    const reported = await reportedForWorkflow(`on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - uses: actions/checkout@${PINNED_SHA} # v5
        with:
          fetch-depth: 0
`);
    expect(reported).toContain("must not ask for the whole history");
  });

  it("固定した参照を引き上げる仕組みを持たないリポジトリを報告する", async () => {
    const reported = await reportedForWorkflow(`on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - run: vp run guard
`);
    expect(reported).toContain("must not leave the pins without");
  });

  it("失敗を成功として報告させる continue-on-error を置けない", async () => {
    const reported = await reportedForWorkflow(`on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    continue-on-error: true
    steps:
      - run: vp run guard
`);
    expect(reported).toContain("must not be reported as a pass");
  });

  it("すべての規律を守った定義を黙って通す", async () => {
    const repositoryRoot = await repositoryWith({
      [RENOVATE_PATH]: `{}\n`,
      [WORKFLOW_PATH]: `name: CI
on:
  pull_request:
permissions:
  contents: read
jobs:
  ready:
    steps:
      - uses: actions/checkout@${PINNED_SHA} # v5
      - run: vp run guard
`,
    });
    const { problems, warnings, failures } = runChecks(repositoryRoot);

    expect(problems).toStrictEqual([]);
    expect(warnings).toStrictEqual([]);
    expect(failures).toStrictEqual([]);
  });
});
