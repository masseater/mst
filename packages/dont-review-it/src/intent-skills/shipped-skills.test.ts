import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { defaultIntentSkillsConfig } from "./config.ts";
import { shippedSkillsProblems } from "./shipped-skills.ts";

describe("shippedSkillsProblems", () => {
  describe("a published package that carries a skill, packs it, and keywords it", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-intent-skills-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "packages/shipped/package.json");
      const skill = join(repositoryRoot, "packages/shipped/skills/core/SKILL.md");
      mkdirSync(dirname(skill), { recursive: true });
      writeFileSync(
        manifest,
        `{
  "name": "@example/shipped",
  "files": ["dist", "skills"],
  "keywords": ["tanstack-intent"]
}
`,
        "utf8",
      );
      writeFileSync(skill, "---\nname: core\n---\n", "utf8");
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("is left alone", ({ scan }) => {
      expect(scan).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("a published package whose skill file sits below the first level", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-intent-skills-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "packages/shipped/package.json");
      const skill = join(repositoryRoot, "packages/shipped/skills/group/topic/SKILL.md");
      mkdirSync(dirname(skill), { recursive: true });
      writeFileSync(
        manifest,
        `{
  "name": "@example/shipped",
  "files": ["dist", "skills"],
  "keywords": ["tanstack-intent"]
}
`,
        "utf8",
      );
      writeFileSync(skill, "---\nname: topic\n---\n", "utf8");
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("is left alone, because the nested file still counts as a shipped skill", ({ scan }) => {
      expect(scan).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("a private package without any skill wiring", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-intent-skills-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "apps/site/package.json");
      mkdirSync(dirname(manifest), { recursive: true });
      writeFileSync(
        manifest,
        `{
  "name": "@example/site",
  "private": true
}
`,
        "utf8",
      );
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("is left alone", ({ scan }) => {
      expect(scan).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("a private package carrying a skill file", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-intent-skills-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "packages/internal/package.json");
      const skill = join(repositoryRoot, "packages/internal/skills/core/SKILL.md");
      mkdirSync(dirname(skill), { recursive: true });
      writeFileSync(
        manifest,
        `{
  "name": "@example/internal",
  "private": true
}
`,
        "utf8",
      );
      writeFileSync(skill, "---\nname: core\n---\n", "utf8");
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("is told at the private flag to delete the skills it can never ship", ({ scan }) => {
      expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/internal/package.json",
              "line": 3,
              "message": "A workspace-internal package must not carry TanStack Intent skills, because a skill that never ships trains agents on a surface nobody can install. Delete the skills directory, or let the package publish by removing "private": true.",
            },
          ],
          "scanned": 1,
        }
      `);
    });
  });

  describe("a private package naming skills in its files allowlist", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-intent-skills-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "packages/internal/package.json");
      mkdirSync(dirname(manifest), { recursive: true });
      writeFileSync(
        manifest,
        `{
  "name": "@example/internal",
  "private": true,
  "files": ["dist", "skills"]
}
`,
        "utf8",
      );
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("is told at the files allowlist to remove the entry", ({ scan }) => {
      expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/internal/package.json",
              "line": 4,
              "message": "The files allowlist of a workspace-internal package must not name the skills directory, because nothing is ever packed from a package that npm cannot publish. Remove "skills" from files.",
            },
          ],
          "scanned": 1,
        }
      `);
    });
  });

  describe("a private package carrying the discovery keyword", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-intent-skills-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "packages/internal/package.json");
      mkdirSync(dirname(manifest), { recursive: true });
      writeFileSync(
        manifest,
        `{
  "name": "@example/internal",
  "private": true,
  "keywords": ["tanstack-intent"]
}
`,
        "utf8",
      );
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("is told to remove the keyword that announces skills it never ships", ({ scan }) => {
      expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/internal/package.json",
              "line": 4,
              "message": "A workspace-internal package must not carry the tanstack-intent keyword, because discovery would announce skills the package never ships. Remove "tanstack-intent" from keywords.",
            },
          ],
          "scanned": 1,
        }
      `);
    });
  });

  describe("a private package carrying the skill file, the files entry, and the keyword", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-intent-skills-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "packages/internal/package.json");
      const skill = join(repositoryRoot, "packages/internal/skills/core/SKILL.md");
      mkdirSync(dirname(skill), { recursive: true });
      writeFileSync(
        manifest,
        `{
  "name": "@example/internal",
  "private": true,
  "files": ["skills"],
  "keywords": ["tanstack-intent"]
}
`,
        "utf8",
      );
      writeFileSync(skill, "---\nname: core\n---\n", "utf8");
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("has every unnecessary piece reported separately", ({ scan }) => {
      expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/internal/package.json",
              "line": 3,
              "message": "A workspace-internal package must not carry TanStack Intent skills, because a skill that never ships trains agents on a surface nobody can install. Delete the skills directory, or let the package publish by removing "private": true.",
            },
            {
              "file": "packages/internal/package.json",
              "line": 4,
              "message": "The files allowlist of a workspace-internal package must not name the skills directory, because nothing is ever packed from a package that npm cannot publish. Remove "skills" from files.",
            },
            {
              "file": "packages/internal/package.json",
              "line": 5,
              "message": "A workspace-internal package must not carry the tanstack-intent keyword, because discovery would announce skills the package never ships. Remove "tanstack-intent" from keywords.",
            },
          ],
          "scanned": 1,
        }
      `);
    });
  });

  describe("an empty manifest", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-intent-skills-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "fixtures/empty/package.json");
      mkdirSync(dirname(manifest), { recursive: true });
      writeFileSync(manifest, "", "utf8");
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("is left alone", ({ scan }) => {
      expect(scan).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("a manifest without a name", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-intent-skills-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "fixtures/fragment/package.json");
      mkdirSync(dirname(manifest), { recursive: true });
      writeFileSync(
        manifest,
        `{ "sideEffects": false }
`,
        "utf8",
      );
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("is left alone", ({ scan }) => {
      expect(scan).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("a published package without any skill file", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-intent-skills-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "packages/bare/package.json");
      mkdirSync(dirname(manifest), { recursive: true });
      writeFileSync(
        manifest,
        `{
  "name": "@example/bare",
  "files": ["dist", "skills"],
  "keywords": ["tanstack-intent"]
}
`,
        "utf8",
      );
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("is told at its name to scaffold the skill it publishes nothing to load", ({ scan }) => {
      expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/bare/package.json",
              "line": 2,
              "message": "A package that npm can publish must not ship without a TanStack Intent skill, because an agent that installs it finds nothing to load. Create skills/<topic>/SKILL.md with npx @tanstack/intent scaffold, or mark the package "private": true.",
            },
          ],
          "scanned": 1,
        }
      `);
    });
  });

  describe("a files allowlist that drops the skills directory", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-intent-skills-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "packages/dropped/package.json");
      const skill = join(repositoryRoot, "packages/dropped/skills/core/SKILL.md");
      mkdirSync(dirname(skill), { recursive: true });
      writeFileSync(
        manifest,
        `{
  "name": "@example/dropped",
  "files": ["dist"],
  "keywords": ["tanstack-intent"]
}
`,
        "utf8",
      );
      writeFileSync(skill, "---\nname: core\n---\n", "utf8");
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("is told at the files allowlist to add the entry back", ({ scan }) => {
      expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/dropped/package.json",
              "line": 3,
              "message": "The files allowlist must not leave out the skills directory, because npm packs only what files names and the published archive would drop every SKILL.md. Add "skills" to files.",
            },
          ],
          "scanned": 1,
        }
      `);
    });
  });

  describe("a published package without a files allowlist", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-intent-skills-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "packages/open/package.json");
      const skill = join(repositoryRoot, "packages/open/skills/core/SKILL.md");
      mkdirSync(dirname(skill), { recursive: true });
      writeFileSync(
        manifest,
        `{
  "name": "@example/open",
  "keywords": ["tanstack-intent"]
}
`,
        "utf8",
      );
      writeFileSync(skill, "---\nname: core\n---\n", "utf8");
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("is left alone, because a manifest without the allowlist ships everything", ({ scan }) => {
      expect(scan).toStrictEqual({ problems: [], scanned: 1 });
    });
  });

  describe("a published package without the discovery keyword", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-intent-skills-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "packages/unlisted/package.json");
      const skill = join(repositoryRoot, "packages/unlisted/skills/core/SKILL.md");
      mkdirSync(dirname(skill), { recursive: true });
      writeFileSync(
        manifest,
        `{
  "name": "@example/unlisted",
  "files": ["dist", "skills"]
}
`,
        "utf8",
      );
      writeFileSync(skill, "---\nname: core\n---\n", "utf8");
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("is told to add the keyword discovery detects it by", ({ scan }) => {
      expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/unlisted/package.json",
              "line": 1,
              "message": "The manifest must not omit the tanstack-intent keyword, because TanStack Intent detects skill-shipping packages by it. Add "tanstack-intent" to keywords.",
            },
          ],
          "scanned": 1,
        }
      `);
    });
  });

  describe("a published package missing the skill file, the files entry, and the keyword", () => {
    const it = test.extend("scan", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "dont-review-it-intent-skills-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      const manifest = join(repositoryRoot, "packages/missing/package.json");
      mkdirSync(dirname(manifest), { recursive: true });
      writeFileSync(
        manifest,
        `{
  "name": "@example/missing",
  "files": ["dist"]
}
`,
        "utf8",
      );
      return shippedSkillsProblems({ repositoryRoot, config: defaultIntentSkillsConfig });
    });

    it("has every missing piece reported separately", ({ scan }) => {
      expect(scan).toMatchInlineSnapshot(`
        {
          "problems": [
            {
              "file": "packages/missing/package.json",
              "line": 2,
              "message": "A package that npm can publish must not ship without a TanStack Intent skill, because an agent that installs it finds nothing to load. Create skills/<topic>/SKILL.md with npx @tanstack/intent scaffold, or mark the package "private": true.",
            },
            {
              "file": "packages/missing/package.json",
              "line": 3,
              "message": "The files allowlist must not leave out the skills directory, because npm packs only what files names and the published archive would drop every SKILL.md. Add "skills" to files.",
            },
            {
              "file": "packages/missing/package.json",
              "line": 1,
              "message": "The manifest must not omit the tanstack-intent keyword, because TanStack Intent detects skill-shipping packages by it. Add "tanstack-intent" to keywords.",
            },
          ],
          "scanned": 1,
        }
      `);
    });
  });
});
