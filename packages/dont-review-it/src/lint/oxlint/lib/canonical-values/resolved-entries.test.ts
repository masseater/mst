import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "vite-plus/test";

import { analyzeCanonicalValuesRepository } from "./builder.ts";
import { fingerprintValues } from "./fingerprint.ts";

describe("an annotated array", () => {
  const it = test.extend("catalogEntryOfAnAnnotatedArray", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(
      join(repositoryRoot, "src", "order-status.ts"),
      '/** @canonical-values order.status */\nexport const ORDER_STATUSES = ["draft", "published"] as const;\n',
    );
    return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.at(0);
  });

  it("becomes one binding-aware catalog entry", ({ catalogEntryOfAnAnnotatedArray }) => {
    expect(catalogEntryOfAnAnnotatedArray).toStrictEqual({
      annotationStart: 0,
      binding: "ORDER_STATUSES",
      bindingStart: 51,
      conceptId: "order.status",
      declarationEnd: 100,
      declarationPath: "src/order-status.ts",
      declarationStart: 38,
      fingerprint: fingerprintValues(["draft", "published"]),
      importRoutes: [],
      packageName: null,
      values: ["draft", "published"],
    });
  });
});

describe("a tuple of negative numbers, booleans, and null", () => {
  const it = test.extend("canonicalValuesOfASignedAndBooleanTuple", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(
      join(repositoryRoot, "src", "retry.ts"),
      "/** @canonical-values retry.outcome */\nexport const OUTCOMES = [-1, 1, true, null] as const;\n",
    );
    return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.flatMap(
      (declarationEntry) => declarationEntry.values,
    );
  });

  it("comes from the resolved tuple type", ({ canonicalValuesOfASignedAndBooleanTuple }) => {
    expect(canonicalValuesOfASignedAndBooleanTuple).toStrictEqual([true, null, -1, 1]);
  });
});

describe("a tuple of positive unary numbers", () => {
  const it = test.extend("canonicalValuesOfAPositiveUnaryTuple", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(
      join(repositoryRoot, "src", "retry.ts"),
      "/** @canonical-values retry.outcome */\nexport const OUTCOMES = [+1, +2] as const;\n",
    );
    return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.flatMap(
      (declarationEntry) => declarationEntry.values,
    );
  });

  it("loses the sign the tuple wrote", ({ canonicalValuesOfAPositiveUnaryTuple }) => {
    expect(canonicalValuesOfAPositiveUnaryTuple).toStrictEqual([1, 2]);
  });
});

describe("a tuple spreading a local binding and an imported binding", () => {
  const it = test.extend("canonicalValuesOfASpreadingTuple", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(
      join(repositoryRoot, "src", "base.ts"),
      '/** @canonical-values base.status */\nexport const BASE = ["draft"] as const;\n',
    );
    writeFileSync(
      join(repositoryRoot, "src", "order-status.ts"),
      'import { BASE } from "./base.ts";\n/** @canonical-values order.status */\nexport const ORDER_STATUSES = [...BASE, "published"] as const;\n',
    );
    return analyzeCanonicalValuesRepository({ repositoryRoot })
      .catalog.entries.filter((declarationEntry) => declarationEntry.conceptId === "order.status")
      .flatMap((declarationEntry) => declarationEntry.values);
  });

  it("forms one finite domain", ({ canonicalValuesOfASpreadingTuple }) => {
    expect(canonicalValuesOfASpreadingTuple).toStrictEqual(["draft", "published"]);
  });
});

describe("a tuple holding a conditional item", () => {
  const it = test.extend("canonicalValuesOfAConditionalItemTuple", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(
      join(repositoryRoot, "src", "order-status.ts"),
      '/** @canonical-values order.status */\nexport const ORDER_STATUSES = [true ? "draft" : "published", "archived"] as const;\n',
    );
    return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.flatMap(
      (declarationEntry) => declarationEntry.values,
    );
  });

  it("remains a finite domain", ({ canonicalValuesOfAConditionalItemTuple }) => {
    expect(canonicalValuesOfAConditionalItemTuple).toStrictEqual([
      "archived",
      "draft",
      "published",
    ]);
  });
});

describe("owners under separate TypeScript paths configurations", () => {
  const it = test.extend("conceptIdsAndValuesOfSeparatelyConfiguredOwners", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "packages", "orders", "src"), { recursive: true });
    mkdirSync(join(repositoryRoot, "packages", "articles", "src"), { recursive: true });
    writeFileSync(
      join(repositoryRoot, "packages", "orders", "tsconfig.json"),
      '{"compilerOptions":{"baseUrl":".","paths":{"@internal/base":["src/base.ts"]}}}',
    );
    writeFileSync(
      join(repositoryRoot, "packages", "articles", "tsconfig.json"),
      '{"compilerOptions":{"baseUrl":".","paths":{"@internal/base":["src/base.ts"]}}}',
    );
    writeFileSync(
      join(repositoryRoot, "packages", "orders", "src", "base.ts"),
      '/** @canonical-values order.base */\nexport const BASE = ["draft"] as const;\n',
    );
    writeFileSync(
      join(repositoryRoot, "packages", "articles", "src", "base.ts"),
      '/** @canonical-values article.base */\nexport const BASE = ["writing"] as const;\n',
    );
    writeFileSync(
      join(repositoryRoot, "packages", "orders", "src", "status.ts"),
      'import { BASE } from "@internal/base";\n/** @canonical-values order.status */\nexport const STATUSES = [...BASE, "published"] as const;\n',
    );
    writeFileSync(
      join(repositoryRoot, "packages", "articles", "src", "status.ts"),
      'import { BASE } from "@internal/base";\n/** @canonical-values article.status */\nexport const STATUSES = [...BASE, "review"] as const;\n',
    );
    return analyzeCanonicalValuesRepository({ repositoryRoot })
      .catalog.entries.filter((declarationEntry) => declarationEntry.conceptId.endsWith(".status"))
      .map((declarationEntry) => [declarationEntry.conceptId, declarationEntry.values]);
  });

  it("each read the paths nearest to them", ({
    conceptIdsAndValuesOfSeparatelyConfiguredOwners,
  }) => {
    expect(conceptIdsAndValuesOfSeparatelyConfiguredOwners).toStrictEqual([
      ["article.status", ["review", "writing"]],
      ["order.status", ["draft", "published"]],
    ]);
  });
});

describe("an annotated object binding", () => {
  const it = test.extend("canonicalValuesOfAnAnnotatedObjectBinding", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(
      join(repositoryRoot, "src", "order-status.ts"),
      '/** @canonical-values order.status */\nexport const ORDER_STATUS = { draft: { label: "Draft" }, published: null } as const;\n',
    );
    return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.flatMap(
      (declarationEntry) => declarationEntry.values,
    );
  });

  it("declares its property names", ({ canonicalValuesOfAnAnnotatedObjectBinding }) => {
    expect(canonicalValuesOfAnAnnotatedObjectBinding).toStrictEqual(["draft", "published"]);
  });
});

describe("an empty tuple", () => {
  const it = test
    .extend("conceptIdsOfAnEmptyTuple", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        "/** @canonical-values order.status */\nexport const VALUES = [] as const;\n",
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (declarationEntry) => declarationEntry.conceptId,
      );
    })
    .extend("vocabularyProblemsOfAnEmptyTuple", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        "/** @canonical-values order.status */\nexport const VALUES = [] as const;\n",
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
        (reported) => reported.kind === "vocabulary-without-values",
      );
    });

  it("owns no catalog entry", ({ conceptIdsOfAnEmptyTuple }) => {
    expect(conceptIdsOfAnEmptyTuple).toStrictEqual([]);
  });

  it("is reported as a vocabulary without values", ({ vocabularyProblemsOfAnEmptyTuple }) => {
    expect(vocabularyProblemsOfAnEmptyTuple).toStrictEqual([
      {
        conceptId: "order.status",
        filePath: "src/values.ts",
        kind: "vocabulary-without-values",
        line: 1,
      },
    ]);
  });
});

describe("a widened array", () => {
  const it = test
    .extend("conceptIdsOfAWidenedArray", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        '/** @canonical-values order.status */\nexport const VALUES = ["draft", "published"];\n',
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (declarationEntry) => declarationEntry.conceptId,
      );
    })
    .extend("vocabularyProblemsOfAWidenedArray", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        '/** @canonical-values order.status */\nexport const VALUES = ["draft", "published"];\n',
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
        (reported) => reported.kind === "vocabulary-without-values",
      );
    });

  it("owns no catalog entry", ({ conceptIdsOfAWidenedArray }) => {
    expect(conceptIdsOfAWidenedArray).toStrictEqual([]);
  });

  it("is reported as a vocabulary without values", ({ vocabularyProblemsOfAWidenedArray }) => {
    expect(vocabularyProblemsOfAWidenedArray).toStrictEqual([
      {
        conceptId: "order.status",
        filePath: "src/values.ts",
        kind: "vocabulary-without-values",
        line: 1,
      },
    ]);
  });
});

describe("a scalar", () => {
  const it = test
    .extend("conceptIdsOfAScalar", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        '/** @canonical-values order.status */\nexport const VALUES = "draft" as const;\n',
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (declarationEntry) => declarationEntry.conceptId,
      );
    })
    .extend("vocabularyProblemsOfAScalar", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        '/** @canonical-values order.status */\nexport const VALUES = "draft" as const;\n',
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
        (reported) => reported.kind === "vocabulary-without-values",
      );
    });

  it("owns no catalog entry", ({ conceptIdsOfAScalar }) => {
    expect(conceptIdsOfAScalar).toStrictEqual([]);
  });

  it("is reported as a vocabulary without values", ({ vocabularyProblemsOfAScalar }) => {
    expect(vocabularyProblemsOfAScalar).toStrictEqual([
      {
        conceptId: "order.status",
        filePath: "src/values.ts",
        kind: "vocabulary-without-values",
        line: 1,
      },
    ]);
  });
});

describe("a call as the whole initializer", () => {
  const it = test
    .extend("conceptIdsOfACallInitializer", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        "/** @canonical-values order.status */\nexport const VALUES = buildValues();\n",
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (declarationEntry) => declarationEntry.conceptId,
      );
    })
    .extend("vocabularyProblemsOfACallInitializer", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        "/** @canonical-values order.status */\nexport const VALUES = buildValues();\n",
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
        (reported) => reported.kind === "vocabulary-without-values",
      );
    });

  it("owns no catalog entry", ({ conceptIdsOfACallInitializer }) => {
    expect(conceptIdsOfACallInitializer).toStrictEqual([]);
  });

  it("is reported as a vocabulary without values", ({ vocabularyProblemsOfACallInitializer }) => {
    expect(vocabularyProblemsOfACallInitializer).toStrictEqual([
      {
        conceptId: "order.status",
        filePath: "src/values.ts",
        kind: "vocabulary-without-values",
        line: 1,
      },
    ]);
  });
});

describe("a call inside a tuple", () => {
  const it = test
    .extend("conceptIdsOfACallInsideATuple", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        '/** @canonical-values order.status */\nexport const VALUES = [buildValue(), "published"] as const;\n',
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (declarationEntry) => declarationEntry.conceptId,
      );
    })
    .extend("vocabularyProblemsOfACallInsideATuple", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        '/** @canonical-values order.status */\nexport const VALUES = [buildValue(), "published"] as const;\n',
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
        (reported) => reported.kind === "vocabulary-without-values",
      );
    });

  it("owns no catalog entry", ({ conceptIdsOfACallInsideATuple }) => {
    expect(conceptIdsOfACallInsideATuple).toStrictEqual([]);
  });

  it("is reported as a vocabulary without values", ({ vocabularyProblemsOfACallInsideATuple }) => {
    expect(vocabularyProblemsOfACallInsideATuple).toStrictEqual([
      {
        conceptId: "order.status",
        filePath: "src/values.ts",
        kind: "vocabulary-without-values",
        line: 1,
      },
    ]);
  });
});

describe("an unsupported unary expression", () => {
  const it = test
    .extend("conceptIdsOfAnUnsupportedUnaryExpression", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        '/** @canonical-values order.status */\nexport const VALUES = [~1, "published"] as const;\n',
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (declarationEntry) => declarationEntry.conceptId,
      );
    })
    .extend("vocabularyProblemsOfAnUnsupportedUnaryExpression", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        '/** @canonical-values order.status */\nexport const VALUES = [~1, "published"] as const;\n',
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
        (reported) => reported.kind === "vocabulary-without-values",
      );
    });

  it("owns no catalog entry", ({ conceptIdsOfAnUnsupportedUnaryExpression }) => {
    expect(conceptIdsOfAnUnsupportedUnaryExpression).toStrictEqual([]);
  });

  it("is reported as a vocabulary without values", ({
    vocabularyProblemsOfAnUnsupportedUnaryExpression,
  }) => {
    expect(vocabularyProblemsOfAnUnsupportedUnaryExpression).toStrictEqual([
      {
        conceptId: "order.status",
        filePath: "src/values.ts",
        kind: "vocabulary-without-values",
        line: 1,
      },
    ]);
  });
});

describe("unary numeric coercion of a boolean", () => {
  const it = test
    .extend("conceptIdsOfACoercedBoolean", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        '/** @canonical-values order.status */\nexport const VALUES = [+true, "published"] as const;\n',
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (declarationEntry) => declarationEntry.conceptId,
      );
    })
    .extend("vocabularyProblemsOfACoercedBoolean", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        '/** @canonical-values order.status */\nexport const VALUES = [+true, "published"] as const;\n',
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
        (reported) => reported.kind === "vocabulary-without-values",
      );
    });

  it("owns no catalog entry", ({ conceptIdsOfACoercedBoolean }) => {
    expect(conceptIdsOfACoercedBoolean).toStrictEqual([]);
  });

  it("is reported as a vocabulary without values", ({ vocabularyProblemsOfACoercedBoolean }) => {
    expect(vocabularyProblemsOfACoercedBoolean).toStrictEqual([
      {
        conceptId: "order.status",
        filePath: "src/values.ts",
        kind: "vocabulary-without-values",
        line: 1,
      },
    ]);
  });
});

describe("direct duplicate values", () => {
  const it = test
    .extend("conceptIdsOfDirectDuplicateValues", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        '/** @canonical-values order.status */\nexport const VALUES = ["draft", "draft"] as const;\n',
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (declarationEntry) => declarationEntry.conceptId,
      );
    })
    .extend("vocabularyProblemsOfDirectDuplicateValues", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        '/** @canonical-values order.status */\nexport const VALUES = ["draft", "draft"] as const;\n',
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
        (reported) => reported.kind === "vocabulary-without-values",
      );
    });

  it("own no catalog entry", ({ conceptIdsOfDirectDuplicateValues }) => {
    expect(conceptIdsOfDirectDuplicateValues).toStrictEqual([]);
  });

  it("are reported as a vocabulary without values", ({
    vocabularyProblemsOfDirectDuplicateValues,
  }) => {
    expect(vocabularyProblemsOfDirectDuplicateValues).toStrictEqual([
      {
        conceptId: "order.status",
        filePath: "src/values.ts",
        kind: "vocabulary-without-values",
        line: 1,
      },
    ]);
  });
});

describe("direct duplicate false values", () => {
  const it = test
    .extend("conceptIdsOfDirectDuplicateFalseValues", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        "/** @canonical-values order.status */\nexport const VALUES = [false, false] as const;\n",
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (declarationEntry) => declarationEntry.conceptId,
      );
    })
    .extend("vocabularyProblemsOfDirectDuplicateFalseValues", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        "/** @canonical-values order.status */\nexport const VALUES = [false, false] as const;\n",
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
        (reported) => reported.kind === "vocabulary-without-values",
      );
    });

  it("own no catalog entry", ({ conceptIdsOfDirectDuplicateFalseValues }) => {
    expect(conceptIdsOfDirectDuplicateFalseValues).toStrictEqual([]);
  });

  it("are reported as a vocabulary without values", ({
    vocabularyProblemsOfDirectDuplicateFalseValues,
  }) => {
    expect(vocabularyProblemsOfDirectDuplicateFalseValues).toStrictEqual([
      {
        conceptId: "order.status",
        filePath: "src/values.ts",
        kind: "vocabulary-without-values",
        line: 1,
      },
    ]);
  });
});

describe("an optional object key", () => {
  const it = test
    .extend("conceptIdsOfAnOptionalObjectKey", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        "/** @canonical-values order.status */\nexport const VALUES: { draft?: null; published: null } = { published: null };\n",
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
        (declarationEntry) => declarationEntry.conceptId,
      );
    })
    .extend("vocabularyProblemsOfAnOptionalObjectKey", ({}, { onCleanup }) => {
      const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
      onCleanup(() => {
        rmSync(repositoryRoot, { recursive: true, force: true });
      });
      mkdirSync(join(repositoryRoot, "src"), { recursive: true });
      writeFileSync(
        join(repositoryRoot, "src", "values.ts"),
        "/** @canonical-values order.status */\nexport const VALUES: { draft?: null; published: null } = { published: null };\n",
      );
      return analyzeCanonicalValuesRepository({ repositoryRoot }).problems.filter(
        (reported) => reported.kind === "vocabulary-without-values",
      );
    });

  it("owns no catalog entry", ({ conceptIdsOfAnOptionalObjectKey }) => {
    expect(conceptIdsOfAnOptionalObjectKey).toStrictEqual([]);
  });

  it("is reported as a vocabulary without values", ({
    vocabularyProblemsOfAnOptionalObjectKey,
  }) => {
    expect(vocabularyProblemsOfAnOptionalObjectKey).toStrictEqual([
      {
        conceptId: "order.status",
        filePath: "src/values.ts",
        kind: "vocabulary-without-values",
        line: 1,
      },
    ]);
  });
});

describe("an unresolved computed object key", () => {
  const it = test.extend("conceptIdsOfAnUnresolvedComputedObjectKey", ({}, { onCleanup }) => {
    const repositoryRoot = mkdtempSync(join(tmpdir(), "canonical-values-"));
    onCleanup(() => {
      rmSync(repositoryRoot, { recursive: true, force: true });
    });
    mkdirSync(join(repositoryRoot, "src"), { recursive: true });
    writeFileSync(
      join(repositoryRoot, "src", "values.ts"),
      "declare function runtimeKey(): string;\nconst KEY = runtimeKey();\n/** @canonical-values order.status */\nexport const VALUES = { [KEY]: 0, published: 1 } as const;\n",
    );
    return analyzeCanonicalValuesRepository({ repositoryRoot }).catalog.entries.map(
      (declarationEntry) => declarationEntry.conceptId,
    );
  });

  it("creates no catalog entry", ({ conceptIdsOfAnUnresolvedComputedObjectKey }) => {
    expect(conceptIdsOfAnUnresolvedComputedObjectKey).toStrictEqual([]);
  });
});
