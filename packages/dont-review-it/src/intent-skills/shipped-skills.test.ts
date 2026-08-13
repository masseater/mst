import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { defaultIntentSkillsConfig } from "./config.ts";
import { shippedSkillsProblems } from "./shipped-skills.ts";

describe("shippedSkillsProblems", () => {
  const repositoryWith = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "dont-review-it-intent-skills-"));
    onTestFinished(() => {
      rmSync(root, { recursive: true, force: true });
    });
    for (const [path, source] of Object.entries(files)) {
      const absolutePath = join(root, path);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, source, "utf8");
    }
    return root;
  };

  const checkOn = (files: Readonly<Record<string, string>>) =>
    shippedSkillsProblems({
      repositoryRoot: repositoryWith(files),
      config: defaultIntentSkillsConfig,
    }).problems;

  const SHIPPED_MANIFEST = `{
  "name": "@example/shipped",
  "files": ["dist", "skills"],
  "keywords": ["tanstack-intent"]
}
`;

  test("a package that ships a skill, lists it, and keywords it is silent", () => {
    expect(
      checkOn({
        "packages/shipped/package.json": SHIPPED_MANIFEST,
        "packages/shipped/skills/core/SKILL.md": "---\nname: core\n---\n",
      }),
    ).toStrictEqual([]);
  });

  test("a skill file nested below the first level still counts", () => {
    expect(
      checkOn({
        "packages/shipped/package.json": SHIPPED_MANIFEST,
        "packages/shipped/skills/group/topic/SKILL.md": "---\nname: topic\n---\n",
      }),
    ).toStrictEqual([]);
  });

  test("a private package without any skill wiring is left alone", () => {
    expect(
      checkOn({
        "apps/site/package.json": `{
  "name": "@example/site",
  "private": true
}
`,
      }),
    ).toStrictEqual([]);
  });

  test("a private package carrying a skill file is reported at private", () => {
    const problems = checkOn({
      "packages/internal/package.json": `{
  "name": "@example/internal",
  "private": true
}
`,
      "packages/internal/skills/core/SKILL.md": "---\nname: core\n---\n",
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]?.line).toBe(3);
    expect(problems[0]?.message).toContain("must not carry TanStack Intent skills");
  });

  test("a private package naming skills in its files allowlist is reported", () => {
    const problems = checkOn({
      "packages/internal/package.json": `{
  "name": "@example/internal",
  "private": true,
  "files": ["dist", "skills"]
}
`,
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]?.line).toBe(4);
    expect(problems[0]?.message).toContain('Remove "skills" from files');
  });

  test("a private package carrying the discovery keyword is reported", () => {
    const problems = checkOn({
      "packages/internal/package.json": `{
  "name": "@example/internal",
  "private": true,
  "keywords": ["tanstack-intent"]
}
`,
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('Remove "tanstack-intent" from keywords');
  });

  test("every unnecessary piece of one private package is reported separately", () => {
    const problems = checkOn({
      "packages/internal/package.json": `{
  "name": "@example/internal",
  "private": true,
  "files": ["skills"],
  "keywords": ["tanstack-intent"]
}
`,
      "packages/internal/skills/core/SKILL.md": "---\nname: core\n---\n",
    });

    expect(problems).toHaveLength(3);
  });

  test("an empty manifest is left alone", () => {
    expect(
      checkOn({
        "fixtures/empty/package.json": "",
      }),
    ).toStrictEqual([]);
  });

  test("a manifest without a name is left alone", () => {
    expect(
      checkOn({
        "fixtures/fragment/package.json": `{ "sideEffects": false }
`,
      }),
    ).toStrictEqual([]);
  });

  test("a published package without any skill file is reported at its name", () => {
    const problems = checkOn({
      "packages/bare/package.json": `{
  "name": "@example/bare",
  "files": ["dist", "skills"],
  "keywords": ["tanstack-intent"]
}
`,
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]?.file).toBe("packages/bare/package.json");
    expect(problems[0]?.line).toBe(2);
    expect(problems[0]?.message).toContain("TanStack Intent skill");
    expect(problems[0]?.message).toContain("npx @tanstack/intent scaffold");
  });

  test("a files allowlist that drops the skills directory is reported at files", () => {
    const problems = checkOn({
      "packages/dropped/package.json": `{
  "name": "@example/dropped",
  "files": ["dist"],
  "keywords": ["tanstack-intent"]
}
`,
      "packages/dropped/skills/core/SKILL.md": "---\nname: core\n---\n",
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]?.line).toBe(3);
    expect(problems[0]?.message).toContain('Add "skills" to files');
  });

  test("a manifest without a files allowlist ships everything and passes that check", () => {
    expect(
      checkOn({
        "packages/open/package.json": `{
  "name": "@example/open",
  "keywords": ["tanstack-intent"]
}
`,
        "packages/open/skills/core/SKILL.md": "---\nname: core\n---\n",
      }),
    ).toStrictEqual([]);
  });

  test("a manifest without the discovery keyword is reported", () => {
    const problems = checkOn({
      "packages/unlisted/package.json": `{
  "name": "@example/unlisted",
  "files": ["dist", "skills"]
}
`,
      "packages/unlisted/skills/core/SKILL.md": "---\nname: core\n---\n",
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('Add "tanstack-intent" to keywords');
  });

  test("every missing piece of one package is reported separately", () => {
    const problems = checkOn({
      "packages/missing/package.json": `{
  "name": "@example/missing",
  "files": ["dist"]
}
`,
    });

    expect(problems).toHaveLength(3);
  });

  const VERSIONED_MANIFEST = `{
  "name": "@example/versioned",
  "version": "0.1.0",
  "files": ["dist", "skills"],
  "keywords": ["tanstack-intent"]
}
`;

  const skillDeclaring = (version: string): string =>
    `---\nname: core\nmetadata:\n  library_version: "${version}"\n---\n`;

  test("a version described by the changelog and named by the skill is silent", () => {
    expect(
      checkOn({
        "packages/versioned/package.json": VERSIONED_MANIFEST,
        "packages/versioned/skills/CHANGELOG.md": "## 0.1.0\n\n- a change\n",
        "packages/versioned/skills/core/SKILL.md": skillDeclaring("0.1.0"),
      }),
    ).toStrictEqual([]);
  });

  test("a published package without a changelog is reported at its name", () => {
    const problems = checkOn({
      "packages/versioned/package.json": VERSIONED_MANIFEST,
      "packages/versioned/skills/core/SKILL.md": skillDeclaring("0.1.0"),
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]?.file).toBe("packages/versioned/package.json");
    expect(problems[0]?.line).toBe(2);
    expect(problems[0]?.message).toContain("without a changelog beside them");
  });

  test("a changelog that leaves the declared version undescribed is reported at the changelog", () => {
    const problems = checkOn({
      "packages/versioned/package.json": VERSIONED_MANIFEST,
      "packages/versioned/skills/CHANGELOG.md": "## 0.0.9\n\n- an older change\n",
      "packages/versioned/skills/core/SKILL.md": skillDeclaring("0.1.0"),
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]?.file).toBe("packages/versioned/skills/CHANGELOG.md");
    expect(problems[0]?.line).toBeNull();
    expect(problems[0]?.message).toContain('Add a "## 0.1.0" heading');
  });

  test("a skill naming another version is reported at its library_version", () => {
    const problems = checkOn({
      "packages/versioned/package.json": VERSIONED_MANIFEST,
      "packages/versioned/skills/CHANGELOG.md": "## 0.1.0\n\n- a change\n",
      "packages/versioned/skills/core/SKILL.md": skillDeclaring("0.0.9"),
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]?.file).toBe("packages/versioned/skills/core/SKILL.md");
    expect(problems[0]?.line).toBe(4);
    expect(problems[0]?.message).toContain('Set metadata.library_version to "0.1.0"');
  });

  test("every shipped skill is checked against the declared version", () => {
    const problems = checkOn({
      "packages/versioned/package.json": VERSIONED_MANIFEST,
      "packages/versioned/skills/CHANGELOG.md": "## 0.1.0\n\n- a change\n",
      "packages/versioned/skills/core/SKILL.md": skillDeclaring("0.0.9"),
      "packages/versioned/skills/extra/SKILL.md": skillDeclaring("0.0.8"),
    });

    expect(problems).toHaveLength(2);
  });

  test("a manifest without a version is left alone by the version checks", () => {
    expect(
      checkOn({
        "packages/open/package.json": `{
  "name": "@example/open",
  "keywords": ["tanstack-intent"]
}
`,
        "packages/open/skills/core/SKILL.md": "---\nname: core\n---\n",
      }),
    ).toStrictEqual([]);
  });

  test("a private package carrying a changelog is reported at private", () => {
    const problems = checkOn({
      "packages/internal/package.json": `{
  "name": "@example/internal",
  "private": true
}
`,
      "packages/internal/skills/CHANGELOG.md": "## 0.1.0\n\n- a change\n",
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]?.file).toBe("packages/internal/package.json");
    expect(problems[0]?.line).toBe(3);
    expect(problems[0]?.message).toContain("must not carry a changelog beside its skills");
  });
});
