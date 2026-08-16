import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultIntentSkillsConfig } from "./config.ts";
import { shippedSkillsProblems } from "./shipped-skills.ts";

const PUBLISHED_MANIFEST = `{
  "name": "@example/shipped",
  "version": "1.2.3",
  "keywords": ["tanstack-intent"],
  "files": ["skills"]
}
`;

const UNVERSIONED_MANIFEST = `{
  "name": "@example/shipped",
  "keywords": ["tanstack-intent"],
  "files": ["skills"]
}
`;

const PRIVATE_MANIFEST = `{
  "name": "@example/kept",
  "private": true
}
`;

const SKILL_AT_THE_DECLARED_VERSION = "---\nname: core\nmetadata:\n  library_version: 1.2.3\n---\n";

const SKILL_AT_AN_OLDER_VERSION = "---\nname: core\nmetadata:\n  library_version: 1.0.0\n---\n";

describe("shippedSkillsProblems", () => {
  describe("a published package shipping skills with no changelog beside them", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "shipped-versions-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "skills/core"), { recursive: true });
      writeFileSync(join(repositoryRoot, "package.json"), PUBLISHED_MANIFEST, "utf8");
      writeFileSync(
        join(repositoryRoot, "skills/core/SKILL.md"),
        SKILL_AT_THE_DECLARED_VERSION,
        "utf8",
      );
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("asks for the changelog", ({ scan }) => {
      expect(scan).toStrictEqual({
        scanned: 1,
        problems: [
          {
            file: "package.json",
            line: 2,
            message:
              'A package that npm can publish must not ship its skills without a changelog beside them, because the agent that loads a skill cannot tell what the version it installed changed. Create skills/CHANGELOG.md with a "## <version>" heading for every published version.',
          },
        ],
      });
    });
  });

  describe("a changelog that never names the published version", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "shipped-versions-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "skills/core"), { recursive: true });
      writeFileSync(join(repositoryRoot, "package.json"), PUBLISHED_MANIFEST, "utf8");
      writeFileSync(join(repositoryRoot, "skills/CHANGELOG.md"), "# Changelog\n", "utf8");
      writeFileSync(
        join(repositoryRoot, "skills/core/SKILL.md"),
        SKILL_AT_THE_DECLARED_VERSION,
        "utf8",
      );
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("asks for the heading that names it", ({ scan }) => {
      expect(scan).toStrictEqual({
        scanned: 1,
        problems: [
          {
            file: "skills/CHANGELOG.md",
            line: null,
            message:
              'The changelog must not leave a published version undescribed, because the archive would carry a version nobody wrote down. Add a "## 1.2.3" heading stating what this version changes for the packages that install it.',
          },
        ],
      });
    });
  });

  describe("a skill naming a version the manifest no longer declares", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "shipped-versions-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "skills/core"), { recursive: true });
      writeFileSync(join(repositoryRoot, "package.json"), PUBLISHED_MANIFEST, "utf8");
      writeFileSync(join(repositoryRoot, "skills/CHANGELOG.md"), "## 1.2.3\n", "utf8");
      writeFileSync(
        join(repositoryRoot, "skills/core/SKILL.md"),
        SKILL_AT_AN_OLDER_VERSION,
        "utf8",
      );
      writeFileSync(join(repositoryRoot, "skills/core/NOTES.md"), "# notes\n", "utf8");
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("asks for the version the manifest declares", ({ scan }) => {
      expect(scan).toStrictEqual({
        scanned: 1,
        problems: [
          {
            file: "skills/core/SKILL.md",
            line: 4,
            message:
              'A shipped skill must not name a version its manifest no longer declares, because an agent reads library_version to decide whether the skill describes the package it installed. Set metadata.library_version to "1.2.3", or run dont-review-it check --write.',
          },
        ],
      });
    });
  });

  describe("a published package whose skills and changelog agree with its version", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "shipped-versions-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "skills/core"), { recursive: true });
      writeFileSync(join(repositoryRoot, "package.json"), PUBLISHED_MANIFEST, "utf8");
      writeFileSync(join(repositoryRoot, "skills/CHANGELOG.md"), "## 1.2.3\n", "utf8");
      writeFileSync(
        join(repositoryRoot, "skills/core/SKILL.md"),
        SKILL_AT_THE_DECLARED_VERSION,
        "utf8",
      );
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("says nothing about it", ({ scan }) => {
      expect(scan).toStrictEqual({ scanned: 1, problems: [] });
    });
  });

  describe("a published package declaring no version", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "shipped-versions-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "skills/core"), { recursive: true });
      writeFileSync(join(repositoryRoot, "package.json"), UNVERSIONED_MANIFEST, "utf8");
      writeFileSync(
        join(repositoryRoot, "skills/core/SKILL.md"),
        SKILL_AT_THE_DECLARED_VERSION,
        "utf8",
      );
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("asks nothing about the versions it ships", ({ scan }) => {
      expect(scan).toStrictEqual({ scanned: 1, problems: [] });
    });
  });

  describe("a package npm cannot publish, carrying a changelog beside its skills", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "shipped-versions-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "skills"), { recursive: true });
      writeFileSync(join(repositoryRoot, "package.json"), PRIVATE_MANIFEST, "utf8");
      writeFileSync(join(repositoryRoot, "skills/CHANGELOG.md"), "## 1.2.3\n", "utf8");
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("asks for the changelog to go", ({ scan }) => {
      expect(scan).toStrictEqual({
        scanned: 1,
        problems: [
          {
            file: "package.json",
            line: 3,
            message:
              'A workspace-internal package must not carry a changelog beside its skills, because nothing is ever packed from a package npm cannot publish. Delete skills/CHANGELOG.md, or let the package publish by removing "private": true.',
          },
        ],
      });
    });
  });

  describe("a package npm cannot publish, carrying nothing beside its skills", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "shipped-versions-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      writeFileSync(join(repositoryRoot, "package.json"), PRIVATE_MANIFEST, "utf8");
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("says nothing about it", ({ scan }) => {
      expect(scan).toStrictEqual({ scanned: 1, problems: [] });
    });
  });
});
