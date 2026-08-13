import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, onTestFinished, test } from "vite-plus/test";

import { defaultIntentSkillsConfig } from "./config.ts";
import { writeSkillVersions } from "./write-skill-versions.ts";

describe("writeSkillVersions", () => {
  const rootHolding = (files: Readonly<Record<string, string>>): string => {
    const root = mkdtempSync(join(tmpdir(), "dont-review-it-skill-versions-"));
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

  const writeOn = (root: string) =>
    writeSkillVersions({ repositoryRoot: root, config: defaultIntentSkillsConfig }).failures;

  const SKILL_PATH = "packages/versioned/skills/core/SKILL.md";

  const VERSIONED_MANIFEST = `{
  "name": "@example/versioned",
  "version": "0.2.0"
}
`;

  const skillDeclaring = (version: string): string =>
    `---\nname: core\nmetadata:\n  library_version: "${version}"\n---\n`;

  test("a skill naming another version is rewritten to the declared one", () => {
    const root = rootHolding({
      "packages/versioned/package.json": VERSIONED_MANIFEST,
      [SKILL_PATH]: skillDeclaring("0.0.9"),
    });

    expect(writeOn(root)).toStrictEqual([]);
    expect(readFileSync(join(root, SKILL_PATH), "utf8")).toContain('  library_version: "0.2.0"');
  });

  test("a skill already naming the declared version is left untouched", () => {
    const root = rootHolding({
      "packages/versioned/package.json": VERSIONED_MANIFEST,
      [SKILL_PATH]: skillDeclaring("0.2.0"),
    });

    expect(writeOn(root)).toStrictEqual([]);
    expect(readFileSync(join(root, SKILL_PATH), "utf8")).toBe(skillDeclaring("0.2.0"));
  });

  test("a private package is left untouched", () => {
    const root = rootHolding({
      "packages/internal/package.json": `{
  "name": "@example/internal",
  "version": "0.2.0",
  "private": true
}
`,
      "packages/internal/skills/core/SKILL.md": skillDeclaring("0.0.9"),
    });

    expect(writeOn(root)).toStrictEqual([]);
    expect(readFileSync(join(root, "packages/internal/skills/core/SKILL.md"), "utf8")).toBe(
      skillDeclaring("0.0.9"),
    );
  });

  test("a manifest without a name is left untouched", () => {
    const root = rootHolding({
      "fixtures/fragment/package.json": `{ "version": "0.2.0" }
`,
      "fixtures/fragment/skills/core/SKILL.md": skillDeclaring("0.0.9"),
    });

    expect(writeOn(root)).toStrictEqual([]);
    expect(readFileSync(join(root, "fixtures/fragment/skills/core/SKILL.md"), "utf8")).toBe(
      skillDeclaring("0.0.9"),
    );
  });

  test("a manifest without a version is left untouched", () => {
    const root = rootHolding({
      "packages/open/package.json": `{ "name": "@example/open" }
`,
      "packages/open/skills/core/SKILL.md": skillDeclaring("0.0.9"),
    });

    expect(writeOn(root)).toStrictEqual([]);
    expect(readFileSync(join(root, "packages/open/skills/core/SKILL.md"), "utf8")).toBe(
      skillDeclaring("0.0.9"),
    );
  });

  test("a skill that cannot be rewritten is reported with its path", () => {
    const root = rootHolding({
      "packages/versioned/package.json": VERSIONED_MANIFEST,
      [SKILL_PATH]: skillDeclaring("0.0.9"),
    });
    const skillFile = join(root, SKILL_PATH);
    chmodSync(skillFile, 0o444);
    onTestFinished(() => {
      chmodSync(skillFile, 0o644);
    });

    const failures = writeOn(root);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain(SKILL_PATH);
    expect(failures[0]).toContain("could not be rewritten");
  });
});
