import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import {
  packageExportPatternCaptures,
  packageExportSourceFile,
  packageExportTargetPatterns,
  singleWildcardPattern,
  substitutePackageExportPattern,
  validPackageExportTargetPattern,
  winningPackageExportSubpath,
} from "./package-export-target.ts";

const PACKAGE_DIRECTORY = join(tmpdir(), "package-export-target-spec");

const PATH_ONLY_PACKAGE_DIRECTORY = "/packages/example";

describe("packageExportSourceFile", () => {
  const it = test
    .extend("sourceFileBehindAJsTarget", ({}, { onCleanup }) => {
      mkdirSync(join(PACKAGE_DIRECTORY, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(PACKAGE_DIRECTORY, { force: true, recursive: true });
      });
      writeFileSync(join(PACKAGE_DIRECTORY, "src/value.ts"), "export {};\n", "utf8");
      return packageExportSourceFile(PACKAGE_DIRECTORY, "./src/value.js");
    })
    .extend("sourceFileBehindAJsxTarget", ({}, { onCleanup }) => {
      mkdirSync(join(PACKAGE_DIRECTORY, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(PACKAGE_DIRECTORY, { force: true, recursive: true });
      });
      writeFileSync(join(PACKAGE_DIRECTORY, "src/view.tsx"), "export {};\n", "utf8");
      return packageExportSourceFile(PACKAGE_DIRECTORY, "./src/view.jsx");
    })
    .extend("sourceFileBehindAnMjsTarget", ({}, { onCleanup }) => {
      mkdirSync(join(PACKAGE_DIRECTORY, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(PACKAGE_DIRECTORY, { force: true, recursive: true });
      });
      writeFileSync(join(PACKAGE_DIRECTORY, "src/module.mts"), "export {};\n", "utf8");
      return packageExportSourceFile(PACKAGE_DIRECTORY, "./src/module.mjs");
    })
    .extend("sourceFileBehindACjsTarget", ({}, { onCleanup }) => {
      mkdirSync(join(PACKAGE_DIRECTORY, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(PACKAGE_DIRECTORY, { force: true, recursive: true });
      });
      writeFileSync(join(PACKAGE_DIRECTORY, "src/common.cts"), "export {};\n", "utf8");
      return packageExportSourceFile(PACKAGE_DIRECTORY, "./src/common.cjs");
    })
    .extend("sourceFileBehindAJsonTarget", ({}, { onCleanup }) => {
      mkdirSync(join(PACKAGE_DIRECTORY, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(PACKAGE_DIRECTORY, { force: true, recursive: true });
      });
      writeFileSync(join(PACKAGE_DIRECTORY, "src/exact.json"), "{}\n", "utf8");
      return packageExportSourceFile(PACKAGE_DIRECTORY, "./src/exact.json");
    })
    .extend("sourceFileBehindADirectoryTarget", ({}, { onCleanup }) => {
      mkdirSync(join(PACKAGE_DIRECTORY, "src/directory"), { recursive: true });
      onCleanup(() => {
        rmSync(PACKAGE_DIRECTORY, { force: true, recursive: true });
      });
      writeFileSync(join(PACKAGE_DIRECTORY, "src/directory/index.ts"), "export {};\n", "utf8");
      return packageExportSourceFile(PACKAGE_DIRECTORY, "./src/directory");
    })
    .extend("sourceFileBehindAnAbsentTarget", ({}, { onCleanup }) => {
      mkdirSync(join(PACKAGE_DIRECTORY, "src"), { recursive: true });
      onCleanup(() => {
        rmSync(PACKAGE_DIRECTORY, { force: true, recursive: true });
      });
      return packageExportSourceFile(PACKAGE_DIRECTORY, "./src/missing");
    });

  it("reads a .js target as the TypeScript source beside it", ({ sourceFileBehindAJsTarget }) => {
    expect(sourceFileBehindAJsTarget).toBe(join(PACKAGE_DIRECTORY, "src/value.ts"));
  });

  it("reads a .jsx target as the TSX source beside it", ({ sourceFileBehindAJsxTarget }) => {
    expect(sourceFileBehindAJsxTarget).toBe(join(PACKAGE_DIRECTORY, "src/view.tsx"));
  });

  it("reads a .mjs target as the .mts source beside it", ({ sourceFileBehindAnMjsTarget }) => {
    expect(sourceFileBehindAnMjsTarget).toBe(join(PACKAGE_DIRECTORY, "src/module.mts"));
  });

  it("reads a .cjs target as the .cts source beside it", ({ sourceFileBehindACjsTarget }) => {
    expect(sourceFileBehindACjsTarget).toBe(join(PACKAGE_DIRECTORY, "src/common.cts"));
  });

  it("keeps a target that already names a file on disk", ({ sourceFileBehindAJsonTarget }) => {
    expect(sourceFileBehindAJsonTarget).toBe(join(PACKAGE_DIRECTORY, "src/exact.json"));
  });

  it("reads a directory target as its index", ({ sourceFileBehindADirectoryTarget }) => {
    expect(sourceFileBehindADirectoryTarget).toBe(
      join(PACKAGE_DIRECTORY, "src/directory/index.ts"),
    );
  });

  it("answers null when no candidate exists", ({ sourceFileBehindAnAbsentTarget }) => {
    expect(sourceFileBehindAnAbsentTarget).toBe(null);
  });
});

describe("singleWildcardPattern", () => {
  const it = test
    .extend("wildcardSplitOfAPatternHoldingOneWildcard", () => singleWildcardPattern("./src/*.ts"))
    .extend("wildcardSplitOfAPatternWithoutAWildcard", () =>
      singleWildcardPattern("./src/value.ts"),
    )
    .extend("wildcardSplitOfAPatternHoldingTwoWildcards", () =>
      singleWildcardPattern("./src/**.ts"),
    );

  it("splits one wildcard into the text around it", ({
    wildcardSplitOfAPatternHoldingOneWildcard,
  }) => {
    expect(wildcardSplitOfAPatternHoldingOneWildcard).toStrictEqual({
      prefix: "./src/",
      suffix: ".ts",
    });
  });

  it("refuses a pattern carrying no wildcard", ({ wildcardSplitOfAPatternWithoutAWildcard }) => {
    expect(wildcardSplitOfAPatternWithoutAWildcard).toBe(null);
  });

  it("refuses a pattern carrying a second wildcard", ({
    wildcardSplitOfAPatternHoldingTwoWildcards,
  }) => {
    expect(wildcardSplitOfAPatternHoldingTwoWildcards).toBe(null);
  });
});

describe("winningPackageExportSubpath", () => {
  const it = test
    .extend("winningSubpathForAnExactSpelling", () =>
      winningPackageExportSubpath(["./*", "./private/*", "./private/*.ts", "./exact"], "./exact"))
    .extend("winningSubpathForALongerPatternUnderAPrefix", () =>
      winningPackageExportSubpath(
        ["./*", "./private/*", "./private/*.ts", "./exact"],
        "./private/status.ts",
      ),
    )
    .extend("winningSubpathForALongerPrefix", () =>
      winningPackageExportSubpath(["./private/*", "./*"], "./private/status"),
    )
    .extend("winningSubpathForALongerSuffix", () =>
      winningPackageExportSubpath(["./*", "./*.ts"], "./status.ts"),
    )
    .extend("winningSubpathForANestedCandidate", () =>
      winningPackageExportSubpath(["./*"], "./nested/status"),
    )
    .extend("winningSubpathForAnUnmatchedSuffix", () =>
      winningPackageExportSubpath(["./*.ts"], "./status.js"),
    )
    .extend("winningSubpathBesideALiteralQuestionMark", () =>
      winningPackageExportSubpath(["./?", "./*"], "./status"),
    )
    .extend("winningSubpathForATrailingSuffix", () =>
      winningPackageExportSubpath(["./*suffix", "./*"], "./statussuffix"),
    )
    .extend("winningSubpathAmongRepeatedSpellings", () =>
      winningPackageExportSubpath(["./*", "./*"], "./status"),
    );

  it("takes an exact spelling ahead of every pattern", ({ winningSubpathForAnExactSpelling }) => {
    expect(winningSubpathForAnExactSpelling).toBe("./exact");
  });

  it("takes the longer pattern under a shared prefix", ({
    winningSubpathForALongerPatternUnderAPrefix,
  }) => {
    expect(winningSubpathForALongerPatternUnderAPrefix).toBe("./private/*.ts");
  });

  it("takes the pattern whose base is longer", ({ winningSubpathForALongerPrefix }) => {
    expect(winningSubpathForALongerPrefix).toBe("./private/*");
  });

  it("takes the longer spelling when the bases tie", ({ winningSubpathForALongerSuffix }) => {
    expect(winningSubpathForALongerSuffix).toBe("./*.ts");
  });

  it("lets one wildcard span a nested candidate", ({ winningSubpathForANestedCandidate }) => {
    expect(winningSubpathForANestedCandidate).toBe("./*");
  });

  it("answers null when no pattern reaches the candidate", ({
    winningSubpathForAnUnmatchedSuffix,
  }) => {
    expect(winningSubpathForAnUnmatchedSuffix).toBe(null);
  });

  it("treats a question mark as an ordinary character", ({
    winningSubpathBesideALiteralQuestionMark,
  }) => {
    expect(winningSubpathBesideALiteralQuestionMark).toBe("./*");
  });

  it("matches a suffix written after the wildcard", ({ winningSubpathForATrailingSuffix }) => {
    expect(winningSubpathForATrailingSuffix).toBe("./*suffix");
  });

  it("keeps the first of two identical spellings", ({ winningSubpathAmongRepeatedSpellings }) => {
    expect(winningSubpathAmongRepeatedSpellings).toBe("./*");
  });
});

describe("packageExportTargetPatterns", () => {
  const it = test
    .extend("targetPatternsWithTypesAdmitted", () =>
      packageExportTargetPatterns({
        depth: 0,
        includeTypes: true,
        value: {
          types: "./types/index.d.ts",
          import: ["./src/index.js", null],
          default: "./src/fallback.js",
        },
      }))
    .extend("targetPatternsWithTypesTurnedAway", () =>
      packageExportTargetPatterns({
        depth: 0,
        includeTypes: false,
        value: {
          types: "./types/index.d.ts",
          import: ["./src/index.js", null],
          default: "./src/fallback.js",
        },
      }),
    )
    .extend("targetPatternsOfANullTarget", () =>
      packageExportTargetPatterns({ depth: 0, includeTypes: true, value: null }),
    )
    .extend("targetPatternsOfANumericTarget", () =>
      packageExportTargetPatterns({ depth: 0, includeTypes: true, value: 1 }),
    )
    .extend("targetPatternsOfAConditionTreePastTheDepthLimit", () =>
      packageExportTargetPatterns({ depth: 9, includeTypes: true, value: {} }),
    )
    .extend("targetPatternsOfAnAlternativeListHoldingANumber", () =>
      packageExportTargetPatterns({ depth: 0, includeTypes: true, value: [1] }),
    )
    .extend("targetPatternsOfAnAlternativeListPastTheDepthLimit", () =>
      packageExportTargetPatterns({ depth: 9, includeTypes: true, value: ["./src/index.js"] }),
    )
    .extend("targetPatternsOfAConditionHoldingANumber", () =>
      packageExportTargetPatterns({ depth: 8, includeTypes: true, value: { import: 1 } }),
    );

  it("flattens every condition once types are admitted", ({ targetPatternsWithTypesAdmitted }) => {
    expect(targetPatternsWithTypesAdmitted).toStrictEqual([
      "./types/index.d.ts",
      "./src/index.js",
      "./src/fallback.js",
    ]);
  });

  it("drops the types condition once types are turned away", ({
    targetPatternsWithTypesTurnedAway,
  }) => {
    expect(targetPatternsWithTypesTurnedAway).toStrictEqual([
      "./src/index.js",
      "./src/fallback.js",
    ]);
  });

  it("reads a null target as contributing nothing", ({ targetPatternsOfANullTarget }) => {
    expect(targetPatternsOfANullTarget).toStrictEqual([]);
  });

  it("refuses a target that is neither string nor object", ({ targetPatternsOfANumericTarget }) => {
    expect(targetPatternsOfANumericTarget).toBe(null);
  });

  it("refuses a condition tree nested past the depth limit", ({
    targetPatternsOfAConditionTreePastTheDepthLimit,
  }) => {
    expect(targetPatternsOfAConditionTreePastTheDepthLimit).toBe(null);
  });

  it("refuses an alternative that is neither string nor object", ({
    targetPatternsOfAnAlternativeListHoldingANumber,
  }) => {
    expect(targetPatternsOfAnAlternativeListHoldingANumber).toBe(null);
  });

  it("refuses an alternative list nested past the depth limit", ({
    targetPatternsOfAnAlternativeListPastTheDepthLimit,
  }) => {
    expect(targetPatternsOfAnAlternativeListPastTheDepthLimit).toBe(null);
  });

  it("refuses a condition whose branch is neither string nor object", ({
    targetPatternsOfAConditionHoldingANumber,
  }) => {
    expect(targetPatternsOfAConditionHoldingANumber).toBe(null);
  });
});

describe("validPackageExportTargetPattern", () => {
  const it = test
    .extend("verdictOnAWildcardTargetInsideThePackage", () =>
      validPackageExportTargetPattern(PATH_ONLY_PACKAGE_DIRECTORY, "./src/*.ts"))
    .extend("verdictOnATargetWithoutAWildcard", () =>
      validPackageExportTargetPattern(PATH_ONLY_PACKAGE_DIRECTORY, "./src/value.ts"),
    )
    .extend("verdictOnAWildcardTargetOutsideThePackage", () =>
      validPackageExportTargetPattern(PATH_ONLY_PACKAGE_DIRECTORY, "../shared/*.ts"),
    );

  it("admits a wildcard target under the package", ({
    verdictOnAWildcardTargetInsideThePackage,
  }) => {
    expect(verdictOnAWildcardTargetInsideThePackage).toBe(true);
  });

  it("turns away a target carrying no wildcard", ({ verdictOnATargetWithoutAWildcard }) => {
    expect(verdictOnATargetWithoutAWildcard).toBe(false);
  });

  it("turns away a target escaping the package", ({
    verdictOnAWildcardTargetOutsideThePackage,
  }) => {
    expect(verdictOnAWildcardTargetOutsideThePackage).toBe(false);
  });
});

describe("packageExportPatternCaptures", () => {
  const it = test
    .extend("capturesAcrossTwoTargetSpellings", () =>
      packageExportPatternCaptures({
        packageDirectory: PATH_ONLY_PACKAGE_DIRECTORY,
        repositoryFiles: [
          `${PATH_ONLY_PACKAGE_DIRECTORY}/src/public/status.ts`,
          `${PATH_ONLY_PACKAGE_DIRECTORY}/src/public/owner.ts`,
          `${PATH_ONLY_PACKAGE_DIRECTORY}/src/public/owner.ts`,
          `${PATH_ONLY_PACKAGE_DIRECTORY}/src/private/value.ts`,
        ],
        targets: ["./src/public/*.js", "./src/public/*.ts"],
      }))
    .extend("capturesFromAFileLeavingTheWildcardEmpty", () =>
      packageExportPatternCaptures({
        packageDirectory: PATH_ONLY_PACKAGE_DIRECTORY,
        repositoryFiles: [`${PATH_ONLY_PACKAGE_DIRECTORY}/src/public/.ts`],
        targets: ["./src/public/*.ts"],
      }),
    )
    .extend("capturesFromATargetWithoutAWildcard", () =>
      packageExportPatternCaptures({
        packageDirectory: PATH_ONLY_PACKAGE_DIRECTORY,
        repositoryFiles: [`${PATH_ONLY_PACKAGE_DIRECTORY}/src/public/status.ts`],
        targets: ["./src/public/value.ts"],
      }),
    )
    .extend("capturesFromAFileSpellingAWildcard", () =>
      packageExportPatternCaptures({
        packageDirectory: PATH_ONLY_PACKAGE_DIRECTORY,
        repositoryFiles: [`${PATH_ONLY_PACKAGE_DIRECTORY}/src/public/status*.ts`],
        targets: ["./src/public/*.ts"],
      }),
    );

  it("collects each capture once and sorts them", ({ capturesAcrossTwoTargetSpellings }) => {
    expect(capturesAcrossTwoTargetSpellings).toStrictEqual(["owner", "status"]);
  });

  it("drops a file that leaves the wildcard empty", ({
    capturesFromAFileLeavingTheWildcardEmpty,
  }) => {
    expect(capturesFromAFileLeavingTheWildcardEmpty).toStrictEqual([]);
  });

  it("drops a target that carries no wildcard", ({ capturesFromATargetWithoutAWildcard }) => {
    expect(capturesFromATargetWithoutAWildcard).toStrictEqual([]);
  });

  it("drops a file whose capture spells a wildcard", ({ capturesFromAFileSpellingAWildcard }) => {
    expect(capturesFromAFileSpellingAWildcard).toStrictEqual([]);
  });
});

describe("substitutePackageExportPattern", () => {
  const it = test.extend("substitutionAcrossAConditionTree", () =>
    substitutePackageExportPattern({ import: ["./src/*.js", null], default: 1 }, "status"));

  it("rewrites every string and leaves the rest alone", ({ substitutionAcrossAConditionTree }) => {
    expect(substitutionAcrossAConditionTree).toStrictEqual({
      import: ["./src/status.js", null],
      default: 1,
    });
  });
});
