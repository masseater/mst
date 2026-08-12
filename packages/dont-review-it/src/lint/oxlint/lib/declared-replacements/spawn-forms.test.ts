import { describe, expect, test } from "vite-plus/test";

import {
  DEFAULT_SPAWN_FORMS,
  spawnFormMatching,
  spawnFormsIn,
  SPAWN_TARGET_LINE,
  SPAWN_TARGET_NAME,
} from "./spawn-forms.ts";

const OWN_FORM = {
  specifier: "@mst/utils",
  exported: "run",
  position: 1,
  carries: SPAWN_TARGET_NAME,
};

const it = test
  .extend("formsFromOptionsNobodyWrote", () =>
    spawnFormsIn({ options: [], standing: DEFAULT_SPAWN_FORMS }))
  .extend("formsFromATableTheConsumerWrites", () =>
    spawnFormsIn({ options: [{ spawnForms: [OWN_FORM] }], standing: DEFAULT_SPAWN_FORMS }),
  )
  .extend("formsFromAnEntryWithoutAPosition", () =>
    spawnFormsIn({
      options: [
        { spawnForms: [{ specifier: "@mst/utils", exported: "run", carries: SPAWN_TARGET_LINE }] },
      ],
      standing: [],
    }),
  )
  .extend("formsFromAnEntryWithoutASpecifier", () =>
    spawnFormsIn({
      options: [{ spawnForms: [{ exported: "run", carries: SPAWN_TARGET_NAME }] }],
      standing: DEFAULT_SPAWN_FORMS,
    }),
  )
  .extend("formsFromAnEntryWithoutAnExportedName", () =>
    spawnFormsIn({
      options: [{ spawnForms: [{ specifier: "@mst/utils", carries: SPAWN_TARGET_NAME }] }],
      standing: DEFAULT_SPAWN_FORMS,
    }),
  )
  .extend("formsFromAnEntrySayingNothingAboutWhatItCarries", () =>
    spawnFormsIn({
      options: [{ spawnForms: [{ specifier: "@mst/utils", exported: "run", carries: "shell" }] }],
      standing: DEFAULT_SPAWN_FORMS,
    }),
  )
  .extend("formMatchingARuntimeModuleNamedWithoutItsPrefix", () =>
    spawnFormMatching({
      forms: DEFAULT_SPAWN_FORMS,
      specifier: "child_process",
      exported: "execSync",
    }),
  )
  .extend("formMatchingAModuleTheTableSaysNothingAbout", () =>
    spawnFormMatching({ forms: DEFAULT_SPAWN_FORMS, specifier: "node:fs", exported: "readFile" }),
  );

describe("declared-replacements/spawn-forms", () => {
  it("options nobody wrote leave the standing table in place", ({
    formsFromOptionsNobodyWrote,
  }) => {
    expect(formsFromOptionsNobodyWrote).toStrictEqual(DEFAULT_SPAWN_FORMS);
  });

  it("a table the consumer writes stands in place of the one it replaces", ({
    formsFromATableTheConsumerWrites,
  }) => {
    expect(formsFromATableTheConsumerWrites).toStrictEqual([OWN_FORM]);
  });

  it("an entry written without a position takes the first argument", ({
    formsFromAnEntryWithoutAPosition,
  }) => {
    expect(formsFromAnEntryWithoutAPosition).toStrictEqual([
      { specifier: "@mst/utils", exported: "run", position: 0, carries: SPAWN_TARGET_LINE },
    ]);
  });

  it("an entry written without a specifier is left out", ({
    formsFromAnEntryWithoutASpecifier,
  }) => {
    expect(formsFromAnEntryWithoutASpecifier).toStrictEqual(DEFAULT_SPAWN_FORMS);
  });

  it("an entry written without an exported name is left out", ({
    formsFromAnEntryWithoutAnExportedName,
  }) => {
    expect(formsFromAnEntryWithoutAnExportedName).toStrictEqual(DEFAULT_SPAWN_FORMS);
  });

  it("an entry saying nothing about what its argument carries is left out", ({
    formsFromAnEntrySayingNothingAboutWhatItCarries,
  }) => {
    expect(formsFromAnEntrySayingNothingAboutWhatItCarries).toStrictEqual(DEFAULT_SPAWN_FORMS);
  });

  it("a runtime module named with its prefix reaches the entry named without it", ({
    formMatchingARuntimeModuleNamedWithoutItsPrefix,
  }) => {
    expect(formMatchingARuntimeModuleNamedWithoutItsPrefix).toStrictEqual({
      specifier: "node:child_process",
      exported: "execSync",
      position: 0,
      carries: SPAWN_TARGET_LINE,
    });
  });

  it("a module the table says nothing about reaches no entry", ({
    formMatchingAModuleTheTableSaysNothingAbout,
  }) => {
    expect(formMatchingAModuleTheTableSaysNothingAbout).toBe(null);
  });
});
