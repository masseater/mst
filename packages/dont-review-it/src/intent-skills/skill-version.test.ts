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
  test("the version declared under metadata is read", () => {
    expect(libraryVersionOf(SKILL_SOURCE)).toBe("0.1.0");
  });

  test("a source without frontmatter has no version", () => {
    expect(libraryVersionOf("# a skill\n")).toBeNull();
  });

  test("frontmatter that does not parse has no version", () => {
    expect(libraryVersionOf('---\nname: "unterminated\n---\n')).toBeNull();
  });

  test("frontmatter without metadata has no version", () => {
    expect(libraryVersionOf("---\nname: core\n---\n")).toBeNull();
  });

  test("metadata without the version has no version", () => {
    expect(libraryVersionOf("---\nmetadata:\n  type: core\n---\n")).toBeNull();
  });

  test("a version written as a number has no version", () => {
    expect(libraryVersionOf("---\nmetadata:\n  library_version: 1\n---\n")).toBeNull();
  });
});

describe("lineOfLibraryVersion", () => {
  test("the line the version sits on is reported", () => {
    expect(lineOfLibraryVersion(SKILL_SOURCE)).toBe(5);
  });

  test("a source without the version has no line", () => {
    expect(lineOfLibraryVersion("---\nname: core\n---\n")).toBeNull();
  });
});

describe("withLibraryVersion", () => {
  test("the declared version is replaced and the indentation kept", () => {
    expect(withLibraryVersion({ source: SKILL_SOURCE, version: "0.2.0" })).toContain(
      '  library_version: "0.2.0"',
    );
  });

  test("a source without the version is returned unchanged", () => {
    const source = "---\nname: core\n---\n";
    expect(withLibraryVersion({ source, version: "0.2.0" })).toBe(source);
  });
});
