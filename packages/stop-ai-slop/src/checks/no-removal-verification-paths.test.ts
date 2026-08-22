import { describe, expect, test } from "vite-plus/test";

import {
  isImplementationSourceFile,
  isVerificationTestFile,
} from "./no-removal-verification-paths.ts";

describe("no-removal-verification paths", () => {
  const it = test
    .extend("verificationClassifications", () =>
      [
        "packages/feature/specs/changed.spec.ts",
        "packages/feature/specs/deleted.spec.ts",
        "packages/feature/specs/verification.spec.ts",
      ].map(isVerificationTestFile))
    .extend("implementationClassifications", () =>
      [
        "packages/feature/specs/changed.spec.ts",
        "packages/feature/specs/deleted.spec.ts",
        "packages/feature/specs/verification.spec.ts",
      ].map(isImplementationSourceFile),
    )
    .extend("compoundSuffixClassification", () =>
      isVerificationTestFile("packages/feature/specs/deleted.spec.test.ts"),
    );

  it("classifies specification files as verification tests", ({ verificationClassifications }) => {
    expect(verificationClassifications).toStrictEqual([true, true, true]);
  });

  it("excludes specification files from implementation sources", ({
    implementationClassifications,
  }) => {
    expect(implementationClassifications).toStrictEqual([false, false, false]);
  });

  it("recognizes the test suffix after the specification suffix", ({
    compoundSuffixClassification,
  }) => {
    expect(compoundSuffixClassification).toBe(true);
  });
});
