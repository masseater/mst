import { describe, expect, it } from "vite-plus/test";

import {
  isImplementationSourceFile,
  isVerificationTestFile,
} from "./no-removal-verification-paths.ts";

describe("no-removal-verification paths", () => {
  it("does not classify deleted or changed specification tests as production sources", () => {
    const specificationPaths = [
      "packages/feature/specs/changed.spec.ts",
      "packages/feature/specs/deleted.spec.ts",
      "packages/feature/specs/verification.spec.ts",
    ];

    expect(specificationPaths.map(isVerificationTestFile)).toStrictEqual([true, true, true]);
    expect(specificationPaths.map(isImplementationSourceFile)).toStrictEqual([false, false, false]);
    expect(isVerificationTestFile("packages/feature/specs/deleted.spec.test.ts")).toBe(true);
  });
});
