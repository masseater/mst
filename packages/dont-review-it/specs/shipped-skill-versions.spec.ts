import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, it, onTestFinished } from "vite-plus/test";

import { defaultIntentSkillsConfig } from "../src/intent-skills/config.ts";
import { writeSkillVersions } from "../src/intent-skills/write-skill-versions.ts";
import { runChecks } from "../src/run-checks.ts";

const MANIFEST_PATH = "packages/versioned/package.json";

const CHANGELOG_PATH = "packages/versioned/skills/CHANGELOG.md";

const SKILL_PATH = "packages/versioned/skills/core/SKILL.md";

const PUBLISHED_MANIFEST = `{
  "name": "@example/versioned",
  "version": "0.1.0",
  "files": ["dist", "skills"],
  "keywords": ["tanstack-intent"]
}
`;

const skillDeclaring = (version: string): string =>
  `---\nname: core\nmetadata:\n  library_version: "${version}"\n---\n`;

const repositoryWith = async (files: Readonly<Record<string, string>>): Promise<string> => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "dont-review-it-skill-versions-"));
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

const reportedFor = async (files: Readonly<Record<string, string>>): Promise<string> =>
  runChecks(await repositoryWith(files)).problems.join("\n");

describe("出荷する skill と宣言した版の突き合わせ", () => {
  it("npm へ公開できるパッケージが skill の隣に changelog を持たなければ報告する", async () => {
    const reported = await reportedFor({
      [MANIFEST_PATH]: PUBLISHED_MANIFEST,
      [SKILL_PATH]: skillDeclaring("0.1.0"),
    });

    expect(reported).toContain(`${MANIFEST_PATH}:`);
    expect(reported).toContain("without a changelog beside them");
  });

  it("changelog が宣言された版を書いていなければ、その changelog を指して報告する", async () => {
    const reported = await reportedFor({
      [MANIFEST_PATH]: PUBLISHED_MANIFEST,
      [CHANGELOG_PATH]: "## 0.0.9\n\n- 前の版の変更\n",
      [SKILL_PATH]: skillDeclaring("0.1.0"),
    });

    expect(reported).toContain(CHANGELOG_PATH);
    expect(reported).toContain('Add a "## 0.1.0" heading');
  });

  it("frontmatter と code block に版の見出しらしい文字列があっても、実 Markdown の見出しでなければ報告する", async () => {
    const reported = await reportedFor({
      [MANIFEST_PATH]: PUBLISHED_MANIFEST,
      [CHANGELOG_PATH]: `---
## 0.1.0
---

\`\`\`markdown
## 0.1.0
\`\`\`

    ## 0.1.0
`,
      [SKILL_PATH]: skillDeclaring("0.1.0"),
    });

    expect(reported).toContain('Add a "## 0.1.0" heading');
  });

  it("changelog の level-2 heading が宣言版以外の文字を伴えば、完全一致する見出しを要求する", async () => {
    const reported = await reportedFor({
      [MANIFEST_PATH]: PUBLISHED_MANIFEST,
      [CHANGELOG_PATH]: "## 0.1.0 - 2026-08-14\n",
      [SKILL_PATH]: skillDeclaring("0.1.0"),
    });

    expect(reported).toContain('Add a "## 0.1.0" heading');
  });

  it("同梱する skill が別の版を名乗っていれば、その skill を指して報告する", async () => {
    const reported = await reportedFor({
      [MANIFEST_PATH]: PUBLISHED_MANIFEST,
      [CHANGELOG_PATH]: "## 0.1.0\n\n- この版の変更\n",
      [SKILL_PATH]: skillDeclaring("0.0.9"),
    });

    expect(reported).toContain(`${SKILL_PATH}:`);
    expect(reported).toContain('Set metadata.library_version to "0.1.0"');
  });

  it("changelog が版を書き、skill が同じ版を名乗っていれば何も報告しない", async () => {
    const reported = await reportedFor({
      [MANIFEST_PATH]: PUBLISHED_MANIFEST,
      [CHANGELOG_PATH]: "## 0.1.0\n\n- この版の変更\n",
      [SKILL_PATH]: skillDeclaring("0.1.0"),
    });

    expect(reported).toBe("");
  });

  it("公開しないパッケージが skill の隣に changelog を持てば報告する", async () => {
    const reported = await reportedFor({
      "packages/internal/package.json": `{
  "name": "@example/internal",
  "version": "0.1.0",
  "private": true
}
`,
      "packages/internal/skills/CHANGELOG.md": "## 0.1.0\n\n- この版の変更\n",
    });

    expect(reported).toContain("must not carry a changelog beside its skills");
  });

  it("自動修正は skill frontmatter の metadata.library_version だけを宣言へ揃え、本文と changelog には触れない", async () => {
    const changelog = "## 0.0.9\n\n- 前の版の変更\n";
    const skill = `---
name: core
library_version: "metadata outside"
"metadata": { type: core, "library_version": '0.0.9' }
---

library_version: "body"

\`\`\`yaml
metadata:
  library_version: "code fence"
\`\`\`
`;
    const expectedSkill = `---
name: core
library_version: "metadata outside"
"metadata": { type: core, "library_version": '0.1.0' }
---

library_version: "body"

\`\`\`yaml
metadata:
  library_version: "code fence"
\`\`\`
`;
    const repositoryRoot = await repositoryWith({
      [MANIFEST_PATH]: PUBLISHED_MANIFEST,
      [CHANGELOG_PATH]: changelog,
      [SKILL_PATH]: skill,
    });

    const { failures } = writeSkillVersions({
      repositoryRoot,
      config: defaultIntentSkillsConfig,
    });

    expect(failures).toStrictEqual([]);
    expect(await readFile(join(repositoryRoot, SKILL_PATH), "utf-8")).toBe(expectedSkill);
    expect(await readFile(join(repositoryRoot, CHANGELOG_PATH), "utf-8")).toBe(changelog);
  });
});
