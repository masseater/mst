import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultIntentSkillsConfig } from "./config.ts";
import { writeSkillVersions } from "./write-skill-versions.ts";

const SKILL_PATH = "packages/versioned/skills/core/SKILL.md";

const PUBLISHED_MANIFEST = `{
  "name": "@example/versioned",
  "version": "0.2.0"
}
`;

const SKILL_NAMING_AN_OLDER_VERSION = `---
name: core
metadata:
  library_version: "0.0.9"
---
`;

const SKILL_NAMING_THE_PACKAGE_VERSION = `---
name: core
metadata:
  library_version: "0.2.0"
---
`;

describe("writeSkillVersions", () => {
  describe("a skill naming a version other than the one its package declares", () => {
    const staleSkillTest = test.extend("staleSkillRoot", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "dont-review-it-skill-versions-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/versioned/skills/core"), { recursive: true });
      writeFileSync(join(root, "packages/versioned/package.json"), PUBLISHED_MANIFEST, "utf8");
      writeFileSync(join(root, SKILL_PATH), SKILL_NAMING_AN_OLDER_VERSION, "utf8");
      return root;
    });

    describe("the report handed back", () => {
      const it = staleSkillTest.extend("writeReport", ({ staleSkillRoot }) =>
        writeSkillVersions({ repositoryRoot: staleSkillRoot, config: defaultIntentSkillsConfig }),
      );

      it("names no failure", ({ writeReport }) => {
        expect(writeReport).toStrictEqual({ failures: [] });
      });
    });

    describe("the skill file left behind", () => {
      const it = staleSkillTest.extend("skillSource", ({ staleSkillRoot }) => {
        writeSkillVersions({ repositoryRoot: staleSkillRoot, config: defaultIntentSkillsConfig });
        return readFileSync(join(staleSkillRoot, SKILL_PATH), "utf8");
      });

      it("names the version its package declares", ({ skillSource }) => {
        expect(skillSource).toBe(SKILL_NAMING_THE_PACKAGE_VERSION);
      });
    });
  });

  describe("a skill already naming the version its package declares", () => {
    const currentSkillTest = test.extend("currentSkillRoot", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "dont-review-it-skill-versions-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/versioned/skills/core"), { recursive: true });
      writeFileSync(join(root, "packages/versioned/package.json"), PUBLISHED_MANIFEST, "utf8");
      writeFileSync(join(root, SKILL_PATH), SKILL_NAMING_THE_PACKAGE_VERSION, "utf8");
      return root;
    });

    describe("the report handed back", () => {
      const it = currentSkillTest.extend("writeReport", ({ currentSkillRoot }) =>
        writeSkillVersions({ repositoryRoot: currentSkillRoot, config: defaultIntentSkillsConfig }),
      );

      it("names no failure", ({ writeReport }) => {
        expect(writeReport).toStrictEqual({ failures: [] });
      });
    });

    describe("the skill file left behind", () => {
      const it = currentSkillTest.extend("skillSource", ({ currentSkillRoot }) => {
        writeSkillVersions({ repositoryRoot: currentSkillRoot, config: defaultIntentSkillsConfig });
        return readFileSync(join(currentSkillRoot, SKILL_PATH), "utf8");
      });

      it("reads exactly as it did before", ({ skillSource }) => {
        expect(skillSource).toBe(SKILL_NAMING_THE_PACKAGE_VERSION);
      });
    });
  });

  describe("a skill shipped by a package marked private", () => {
    const privateSkillTest = test.extend("privateSkillRoot", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "dont-review-it-skill-versions-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/internal/skills/core"), { recursive: true });
      writeFileSync(
        join(root, "packages/internal/package.json"),
        `{
  "name": "@example/internal",
  "version": "0.2.0",
  "private": true
}
`,
        "utf8",
      );
      writeFileSync(
        join(root, "packages/internal/skills/core/SKILL.md"),
        SKILL_NAMING_AN_OLDER_VERSION,
        "utf8",
      );
      return root;
    });

    describe("the report handed back", () => {
      const it = privateSkillTest.extend("writeReport", ({ privateSkillRoot }) =>
        writeSkillVersions({ repositoryRoot: privateSkillRoot, config: defaultIntentSkillsConfig }),
      );

      it("names no failure", ({ writeReport }) => {
        expect(writeReport).toStrictEqual({ failures: [] });
      });
    });

    describe("the skill file left behind", () => {
      const it = privateSkillTest.extend("skillSource", ({ privateSkillRoot }) => {
        writeSkillVersions({ repositoryRoot: privateSkillRoot, config: defaultIntentSkillsConfig });
        return readFileSync(
          join(privateSkillRoot, "packages/internal/skills/core/SKILL.md"),
          "utf8",
        );
      });

      it("still names the older version", ({ skillSource }) => {
        expect(skillSource).toBe(SKILL_NAMING_AN_OLDER_VERSION);
      });
    });
  });

  describe("a skill shipped beside a manifest that declares no package name", () => {
    const namelessManifestTest = test.extend("namelessManifestRoot", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "dont-review-it-skill-versions-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "fixtures/fragment/skills/core"), { recursive: true });
      writeFileSync(
        join(root, "fixtures/fragment/package.json"),
        `{ "version": "0.2.0" }
`,
        "utf8",
      );
      writeFileSync(
        join(root, "fixtures/fragment/skills/core/SKILL.md"),
        SKILL_NAMING_AN_OLDER_VERSION,
        "utf8",
      );
      return root;
    });

    describe("the report handed back", () => {
      const it = namelessManifestTest.extend("writeReport", ({ namelessManifestRoot }) =>
        writeSkillVersions({
          repositoryRoot: namelessManifestRoot,
          config: defaultIntentSkillsConfig,
        }),
      );

      it("names no failure", ({ writeReport }) => {
        expect(writeReport).toStrictEqual({ failures: [] });
      });
    });

    describe("the skill file left behind", () => {
      const it = namelessManifestTest.extend("skillSource", ({ namelessManifestRoot }) => {
        writeSkillVersions({
          repositoryRoot: namelessManifestRoot,
          config: defaultIntentSkillsConfig,
        });
        return readFileSync(
          join(namelessManifestRoot, "fixtures/fragment/skills/core/SKILL.md"),
          "utf8",
        );
      });

      it("still names the older version", ({ skillSource }) => {
        expect(skillSource).toBe(SKILL_NAMING_AN_OLDER_VERSION);
      });
    });
  });

  describe("a skill shipped beside a manifest that declares no version", () => {
    const versionlessManifestTest = test.extend("versionlessManifestRoot", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "dont-review-it-skill-versions-"));
      onCleanup(() => {
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/open/skills/core"), { recursive: true });
      writeFileSync(
        join(root, "packages/open/package.json"),
        `{ "name": "@example/open" }
`,
        "utf8",
      );
      writeFileSync(
        join(root, "packages/open/skills/core/SKILL.md"),
        SKILL_NAMING_AN_OLDER_VERSION,
        "utf8",
      );
      return root;
    });

    describe("the report handed back", () => {
      const it = versionlessManifestTest.extend("writeReport", ({ versionlessManifestRoot }) =>
        writeSkillVersions({
          repositoryRoot: versionlessManifestRoot,
          config: defaultIntentSkillsConfig,
        }),
      );

      it("names no failure", ({ writeReport }) => {
        expect(writeReport).toStrictEqual({ failures: [] });
      });
    });

    describe("the skill file left behind", () => {
      const it = versionlessManifestTest.extend("skillSource", ({ versionlessManifestRoot }) => {
        writeSkillVersions({
          repositoryRoot: versionlessManifestRoot,
          config: defaultIntentSkillsConfig,
        });
        return readFileSync(
          join(versionlessManifestRoot, "packages/open/skills/core/SKILL.md"),
          "utf8",
        );
      });

      it("still names the older version", ({ skillSource }) => {
        expect(skillSource).toBe(SKILL_NAMING_AN_OLDER_VERSION);
      });
    });
  });

  describe("a skill file the writer is not allowed to open for writing", () => {
    const sealedSkillTest = test.extend("sealedSkillRoot", ({}, { onCleanup }) => {
      const root = mkdtempSync(join(tmpdir(), "dont-review-it-skill-versions-"));
      onCleanup(() => {
        chmodSync(join(root, SKILL_PATH), 0o644);
        rmSync(root, { recursive: true, force: true });
      });
      mkdirSync(join(root, "packages/versioned/skills/core"), { recursive: true });
      writeFileSync(join(root, "packages/versioned/package.json"), PUBLISHED_MANIFEST, "utf8");
      writeFileSync(join(root, SKILL_PATH), SKILL_NAMING_AN_OLDER_VERSION, "utf8");
      chmodSync(join(root, SKILL_PATH), 0o444);
      return root;
    });

    const it = sealedSkillTest.extend("writeReport", ({ sealedSkillRoot }) =>
      writeSkillVersions({ repositoryRoot: sealedSkillRoot, config: defaultIntentSkillsConfig }),
    );

    it("names the skill file and why it stayed as it was", ({ writeReport, sealedSkillRoot }) => {
      expect(writeReport).toStrictEqual({
        failures: [
          `${SKILL_PATH} could not be rewritten: EACCES: permission denied, open '${join(sealedSkillRoot, SKILL_PATH)}'`,
        ],
      });
    });
  });
});
