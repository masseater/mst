import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { runChecks } from "../src/run-checks.ts";

const repositoryWith = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "dont-review-it-canonical-"));
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

describe("値の正典の検査", () => {
  it("同じ概念を 2 か所で宣言していたら、先に宣言した場所を挙げて報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "src/order.ts": `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
      "src/status.ts": `/** @canonical-values order.status */
export const STATUSES = ["draft", "published"] as const;
`,
    });
    const reported = runChecks(repositoryRoot).problems.join("\n");
    expect(reported).toContain("A concept must be declared in one place");
    expect(reported).toContain("src/order.ts");
  });

  it("同じ値の集合を別々の概念が宣言していたら、両方の概念を挙げて報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "src/article.ts": `/** @canonical-values article.status */
export const ARTICLE_STATUSES = ["published", "draft"] as const;
`,
      "src/order.ts": `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft", "published"] as const;
`,
    });
    const reported = runChecks(repositoryRoot).problems.join("\n");
    expect(reported).toContain("article.status");
    expect(reported).toContain("order.status");
  });

  it("概念を名指ししない注釈を報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "src/order.ts": `/** @canonical-values */
export const ORDER_STATUSES = ["draft"] as const;
`,
    });
    const reported = runChecks(repositoryRoot).problems.join("\n");
    expect(reported).toContain("must name the concept it declares");
  });

  it("退役した注釈タグが残っていたら報告する", async () => {
    const repositoryRoot = await repositoryWith({
      "src/order.ts": `/** @canonical-values-exempt */
export const ORDER_STATUSES = ["draft"] as const;
`,
    });
    const reported = runChecks(repositoryRoot).problems.join("\n");
    expect(reported).toContain("@canonical-values-exempt");
  });

  it("テストファイルが繰り返す値の集合を二重宣言と数えない", async () => {
    const repositoryRoot = await repositoryWith({
      "src/order.ts": `/** @canonical-values order.status */
export const ORDER_STATUSES = ["draft"] as const;
`,
      "src/order.test.ts": `const FIXTURE_STATUSES = ["draft"] as const;
`,
    });
    const { problems, warnings, failures } = runChecks(repositoryRoot);

    expect(problems).toStrictEqual([]);
    expect(warnings).toStrictEqual([]);
    expect(failures).toStrictEqual([]);
  });
});
