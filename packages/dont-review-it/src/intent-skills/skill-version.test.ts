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

const SKILL_SOURCE_WITH_DECOYS = `---
name: core
library_version: "frontmatter root"
"metadata": { type: core, "library_version": '0.1.0' }
---

library_version: "body"

\`\`\`yaml
metadata:
  library_version: "code fence"
\`\`\`
`;

const UPDATED_SKILL_SOURCE_WITH_DECOYS = `---
name: core
library_version: "frontmatter root"
"metadata": { type: core, "library_version": '0.2.0' }
---

library_version: "body"

\`\`\`yaml
metadata:
  library_version: "code fence"
\`\`\`
`;

describe("libraryVersionOf", () => {
  describe("a source declaring the version under metadata", () => {
    const it = test.extend("versionOfCompleteSkill", () => libraryVersionOf(SKILL_SOURCE));

    it("reads the version declared under metadata", ({ versionOfCompleteSkill }) => {
      expect(versionOfCompleteSkill).toBe("0.1.0");
    });
  });

  describe("quoted keys in an inline metadata map beside decoy declarations", () => {
    const it = test.extend("versionAtTheSemanticPath", () =>
      libraryVersionOf(SKILL_SOURCE_WITH_DECOYS));

    it("reads only the scalar under metadata", ({ versionAtTheSemanticPath }) => {
      expect(versionAtTheSemanticPath).toBe("0.1.0");
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

  describe("a version-like line outside frontmatter", () => {
    const it = test.extend("lineOfBodyDecoy", () =>
      lineOfLibraryVersion("---\nname: core\n---\n\nlibrary_version: body\n"));

    it("has no declaration line", ({ lineOfBodyDecoy }) => {
      expect(lineOfBodyDecoy).toBe(null);
    });
  });

  describe("quoted keys in an inline metadata map beside decoy declarations", () => {
    const it = test.extend("lineOfSemanticDeclaration", () =>
      lineOfLibraryVersion(SKILL_SOURCE_WITH_DECOYS));

    it("reports the line of the scalar under metadata", ({ lineOfSemanticDeclaration }) => {
      expect(lineOfSemanticDeclaration).toBe(4);
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

  describe("quoted keys in an inline metadata map beside decoy declarations", () => {
    const it = test.extend("skillSourceCarryingOnlyOneNewScalar", () =>
      withLibraryVersion({ source: SKILL_SOURCE_WITH_DECOYS, version: "0.2.0" }));

    it("rewrites only the scalar at metadata.library_version", ({
      skillSourceCarryingOnlyOneNewScalar,
    }) => {
      expect(skillSourceCarryingOnlyOneNewScalar).toBe(UPDATED_SKILL_SOURCE_WITH_DECOYS);
    });
  });

  describe("a numeric scalar at the semantic path", () => {
    const it = test.extend("skillSourceCarryingAStringVersion", () =>
      withLibraryVersion({
        source: "---\nmetadata: { library_version: 1, type: core }\n---\n",
        version: "0.2.0",
      }));

    it("replaces that scalar without reserializing the map", ({
      skillSourceCarryingAStringVersion,
    }) => {
      expect(skillSourceCarryingAStringVersion).toBe(
        "---\nmetadata: { library_version: 0.2.0, type: core }\n---\n",
      );
    });
  });

  describe("unparsable frontmatter carrying a version-like line", () => {
    const source = '---\nmetadata:\n  library_version: "unterminated\n---\n';
    const it = test.extend("sourceAfterRewrite", () =>
      withLibraryVersion({ source, version: "0.2.0" }));

    it("returns the source unchanged", ({ sourceAfterRewrite }) => {
      expect(sourceAfterRewrite).toBe(source);
    });
  });
});
