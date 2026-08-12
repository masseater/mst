import { describe, expect, test } from "vite-plus/test";

import { matchesAnchoredGlobPath, matchesGlobPath } from "./glob-path-match.ts";

const REPOSITORY_ROOT = "/repo";

const it = test
  .extend("verdictOnPatternSittingDeeper", () =>
    matchesGlobPath({
      pathSegments: ["repo", "src", "index.ts"],
      pattern: "src/index.ts",
      cwd: REPOSITORY_ROOT,
    }))
  .extend("verdictOnSingleSegmentPattern", () =>
    matchesGlobPath({
      pathSegments: ["repo", "src", "index.ts"],
      pattern: "index.ts",
      cwd: REPOSITORY_ROOT,
    }),
  )
  .extend("verdictOnDoubleStarAroundSegment", () =>
    matchesGlobPath({
      pathSegments: ["repo", "a", "b", "dist", "out.js"],
      pattern: "**/dist/**",
      cwd: REPOSITORY_ROOT,
    }),
  )
  .extend("verdictOnDoubleStarStandingForNothing", () =>
    matchesGlobPath({
      pathSegments: ["repo", "dist"],
      pattern: "dist/**",
      cwd: REPOSITORY_ROOT,
    }),
  )
  .extend("verdictOnStarInsideSegment", () =>
    matchesGlobPath({
      pathSegments: ["repo", "src", "reader.test.ts"],
      pattern: "**/*.test.ts",
      cwd: REPOSITORY_ROOT,
    }),
  )
  .extend("verdictOnStarMissingTheSegment", () =>
    matchesGlobPath({
      pathSegments: ["repo", "src", "reader.ts"],
      pattern: "**/*.test.ts",
      cwd: REPOSITORY_ROOT,
    }),
  )
  .extend("verdictOnPatternLongerThanPath", () =>
    matchesGlobPath({
      pathSegments: ["repo", "src"],
      pattern: "src/index.ts",
      cwd: REPOSITORY_ROOT,
    }),
  )
  .extend("verdictOnDotAnchoredPattern", () =>
    matchesGlobPath({
      pathSegments: ["repo", "src", "index.ts"],
      pattern: "./src/index.ts",
      cwd: REPOSITORY_ROOT,
    }),
  )
  .extend("verdictOnRootAnchoredPattern", () =>
    matchesGlobPath({
      pathSegments: ["repo", "src", "index.ts"],
      pattern: "/repo/src/index.ts",
      cwd: REPOSITORY_ROOT,
    }),
  )
  .extend("verdictOnParentAnchoredPattern", () =>
    matchesGlobPath({
      pathSegments: ["repo", "index.ts"],
      pattern: "../index.ts",
      cwd: "/repo/src",
    }),
  )
  .extend("verdictOnPatternAnchoredElsewhere", () =>
    matchesGlobPath({
      pathSegments: ["repo", "src", "index.ts"],
      pattern: "/other/src/index.ts",
      cwd: REPOSITORY_ROOT,
    }),
  )
  .extend("verdictOnEmptyPath", () =>
    matchesGlobPath({ pathSegments: [], pattern: "src", cwd: REPOSITORY_ROOT }),
  )
  .extend("verdictOnAnchoredPathReadFromItsHead", () =>
    matchesAnchoredGlobPath({ relativePath: "docs/lint/rule.md", pattern: "docs/lint/*.md" }),
  )
  .extend("verdictOnAnchoredPathBuriedDeeper", () =>
    matchesAnchoredGlobPath({
      relativePath: "packages/alpha/docs/lint/rule.md",
      pattern: "docs/lint/*.md",
    }),
  )
  .extend("verdictOnAnchoredPatternSpanningDirectories", () =>
    matchesAnchoredGlobPath({ relativePath: "packages/alpha/README.md", pattern: "**/README.md" }),
  )
  .extend("verdictOnAnchoredRootAgainstRoot", () =>
    matchesAnchoredGlobPath({ relativePath: ".", pattern: "." }),
  )
  .extend("verdictOnAnchoredRootAgainstDirectory", () =>
    matchesAnchoredGlobPath({ relativePath: "packages/alpha", pattern: "." }),
  );

describe("glob-path-match", () => {
  it("an unanchored pattern matches wherever it sits in the path", ({
    verdictOnPatternSittingDeeper,
  }) => {
    expect(verdictOnPatternSittingDeeper).toBe(true);
  });

  it("a pattern of one segment matches the name at the end of the path", ({
    verdictOnSingleSegmentPattern,
  }) => {
    expect(verdictOnSingleSegmentPattern).toBe(true);
  });

  it("a double star stands for any number of segments", ({ verdictOnDoubleStarAroundSegment }) => {
    expect(verdictOnDoubleStarAroundSegment).toBe(true);
  });

  it("a double star stands for no segment at all", ({ verdictOnDoubleStarStandingForNothing }) => {
    expect(verdictOnDoubleStarStandingForNothing).toBe(true);
  });

  it("a star stands for any run of characters inside one segment", ({
    verdictOnStarInsideSegment,
  }) => {
    expect(verdictOnStarInsideSegment).toBe(true);
  });

  it("a star does not reach past the run of characters it stands for", ({
    verdictOnStarMissingTheSegment,
  }) => {
    expect(verdictOnStarMissingTheSegment).toBe(false);
  });

  it("a pattern with more segments than the path matches nothing", ({
    verdictOnPatternLongerThanPath,
  }) => {
    expect(verdictOnPatternLongerThanPath).toBe(false);
  });

  it("a pattern anchored with a leading dot is resolved against the directory", ({
    verdictOnDotAnchoredPattern,
  }) => {
    expect(verdictOnDotAnchoredPattern).toBe(true);
  });

  it("a pattern anchored at the root is resolved against the root", ({
    verdictOnRootAnchoredPattern,
  }) => {
    expect(verdictOnRootAnchoredPattern).toBe(true);
  });

  it("a pattern anchored above the directory is resolved against the parent", ({
    verdictOnParentAnchoredPattern,
  }) => {
    expect(verdictOnParentAnchoredPattern).toBe(true);
  });

  it("an anchored pattern that resolves elsewhere matches nothing", ({
    verdictOnPatternAnchoredElsewhere,
  }) => {
    expect(verdictOnPatternAnchoredElsewhere).toBe(false);
  });

  it("an empty path is matched by nothing", ({ verdictOnEmptyPath }) => {
    expect(verdictOnEmptyPath).toBe(false);
  });

  it("an anchored relative path is read from its first segment", ({
    verdictOnAnchoredPathReadFromItsHead,
  }) => {
    expect(verdictOnAnchoredPathReadFromItsHead).toBe(true);
  });

  it("an anchored pattern does not reach a path that starts elsewhere", ({
    verdictOnAnchoredPathBuriedDeeper,
  }) => {
    expect(verdictOnAnchoredPathBuriedDeeper).toBe(false);
  });

  it("an anchored pattern still spans directories where it says so", ({
    verdictOnAnchoredPatternSpanningDirectories,
  }) => {
    expect(verdictOnAnchoredPatternSpanningDirectories).toBe(true);
  });

  it("the root pattern reaches the root itself", ({ verdictOnAnchoredRootAgainstRoot }) => {
    expect(verdictOnAnchoredRootAgainstRoot).toBe(true);
  });

  it("the root pattern reaches nothing below the root", ({
    verdictOnAnchoredRootAgainstDirectory,
  }) => {
    expect(verdictOnAnchoredRootAgainstDirectory).toBe(false);
  });
});
