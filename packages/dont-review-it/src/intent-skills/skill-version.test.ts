import { describe, expect, test } from "vite-plus/test";

import { libraryVersionOf, lineOfLibraryVersion, withLibraryVersion } from "./skill-version.ts";

const SKILL_SOURCE = `---
name: core
metadata:
  type: core
  library_version: "0.1.0"
---

# a skill
`;

describe("libraryVersionOf", () => {
  describe("a source declaring the version under metadata", () => {
    const it = test.extend("versionOfCompleteSkill", () => libraryVersionOf(SKILL_SOURCE));

    it("reads the version declared under metadata", ({ versionOfCompleteSkill }) => {
      expect(versionOfCompleteSkill).toBe("0.1.0");
    });
  });

  describe("a source without frontmatter", () => {
    const it = test.extend("versionOfSourceWithoutFrontmatter", () =>
      libraryVersionOf("# a skill\n"));

    it("has no version", ({ versionOfSourceWithoutFrontmatter }) => {
      expect(versionOfSourceWithoutFrontmatter).toBe(null);
    });
  });

  describe("a source whose frontmatter does not parse", () => {
    const it = test.extend("versionOfUnparsableFrontmatter", () =>
      libraryVersionOf('---\nname: "unterminated\n---\n'));

    it("has no version", ({ versionOfUnparsableFrontmatter }) => {
      expect(versionOfUnparsableFrontmatter).toBe(null);
    });
  });

  describe("a source whose frontmatter carries no metadata", () => {
    const it = test.extend("versionOfFrontmatterWithoutMetadata", () =>
      libraryVersionOf("---\nname: core\n---\n"));

    it("has no version", ({ versionOfFrontmatterWithoutMetadata }) => {
      expect(versionOfFrontmatterWithoutMetadata).toBe(null);
    });
  });

  describe("a source whose metadata carries no version", () => {
    const it = test.extend("versionOfMetadataWithoutTheKey", () =>
      libraryVersionOf("---\nmetadata:\n  type: core\n---\n"));

    it("has no version", ({ versionOfMetadataWithoutTheKey }) => {
      expect(versionOfMetadataWithoutTheKey).toBe(null);
    });
  });

  describe("a source declaring the version as a number", () => {
    const it = test.extend("versionOfNumericDeclaration", () =>
      libraryVersionOf("---\nmetadata:\n  library_version: 1\n---\n"));

    it("has no version", ({ versionOfNumericDeclaration }) => {
      expect(versionOfNumericDeclaration).toBe(null);
    });
  });
});

describe("lineOfLibraryVersion", () => {
  describe("a source declaring the version under metadata", () => {
    const it = test.extend("lineOfCompleteSkill", () => lineOfLibraryVersion(SKILL_SOURCE));

    it("reports the line the version sits on", ({ lineOfCompleteSkill }) => {
      expect(lineOfCompleteSkill).toBe(5);
    });
  });

  describe("a source without the version", () => {
    const it = test.extend("lineOfSourceWithoutVersion", () =>
      lineOfLibraryVersion("---\nname: core\n---\n"));

    it("has no line", ({ lineOfSourceWithoutVersion }) => {
      expect(lineOfSourceWithoutVersion).toBe(null);
    });
  });
});

describe("withLibraryVersion", () => {
  describe("a source declaring the version under metadata", () => {
    const it = test.extend("skillSourceCarryingTheNewVersion", () =>
      withLibraryVersion({ source: SKILL_SOURCE, version: "0.2.0" }));

    it("replaces the declared version and keeps the indentation", ({
      skillSourceCarryingTheNewVersion,
    }) => {
      expect(skillSourceCarryingTheNewVersion).toBe(
        '---\nname: core\nmetadata:\n  type: core\n  library_version: "0.2.0"\n---\n\n# a skill\n',
      );
    });
  });

  describe("a source without the version", () => {
    const it = test.extend("sourceWithoutVersionAfterRewrite", () =>
      withLibraryVersion({ source: "---\nname: core\n---\n", version: "0.2.0" }));

    it("returns the source unchanged", ({ sourceWithoutVersionAfterRewrite }) => {
      expect(sourceWithoutVersionAfterRewrite).toBe("---\nname: core\n---\n");
    });
  });
});
