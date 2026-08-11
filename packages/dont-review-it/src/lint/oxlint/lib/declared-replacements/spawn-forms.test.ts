import { describe, expect, test } from "vite-plus/test";

import {
  DEFAULT_SPAWN_FORMS,
  spawnFormMatching,
  spawnFormsIn,
  SPAWN_TARGET_LINE,
  SPAWN_TARGET_NAME,
} from "./spawn-forms.ts";

const OWN_FORM = {
  specifier: "@mst/repository-checks",
  exported: "run",
  position: 1,
  carries: SPAWN_TARGET_NAME,
};

describe("declared-replacements/spawn-forms", () => {
  test("options nobody wrote leave the standing table in place", () => {
    expect(spawnFormsIn({ options: [], standing: DEFAULT_SPAWN_FORMS })).toStrictEqual(
      DEFAULT_SPAWN_FORMS,
    );
  });

  test("a table the consumer writes stands in place of the one it replaces", () => {
    expect(
      spawnFormsIn({ options: [{ spawnForms: [OWN_FORM] }], standing: DEFAULT_SPAWN_FORMS }),
    ).toStrictEqual([OWN_FORM]);
  });

  test("an entry written without a position takes the first argument", () => {
    expect(
      spawnFormsIn({
        options: [
          {
            spawnForms: [
              { specifier: "@mst/repository-checks", exported: "run", carries: SPAWN_TARGET_LINE },
            ],
          },
        ],
        standing: [],
      }),
    ).toStrictEqual([
      {
        specifier: "@mst/repository-checks",
        exported: "run",
        position: 0,
        carries: SPAWN_TARGET_LINE,
      },
    ]);
  });

  test("an entry written without a specifier is left out", () => {
    expect(
      spawnFormsIn({
        options: [{ spawnForms: [{ exported: "run", carries: SPAWN_TARGET_NAME }] }],
        standing: DEFAULT_SPAWN_FORMS,
      }),
    ).toStrictEqual(DEFAULT_SPAWN_FORMS);
  });

  test("an entry written without an exported name is left out", () => {
    expect(
      spawnFormsIn({
        options: [
          { spawnForms: [{ specifier: "@mst/repository-checks", carries: SPAWN_TARGET_NAME }] },
        ],
        standing: DEFAULT_SPAWN_FORMS,
      }),
    ).toStrictEqual(DEFAULT_SPAWN_FORMS);
  });

  test("an entry saying nothing about what its argument carries is left out", () => {
    expect(
      spawnFormsIn({
        options: [
          {
            spawnForms: [
              { specifier: "@mst/repository-checks", exported: "run", carries: "shell" },
            ],
          },
        ],
        standing: DEFAULT_SPAWN_FORMS,
      }),
    ).toStrictEqual(DEFAULT_SPAWN_FORMS);
  });

  test("a runtime module named with its prefix reaches the entry named without it", () => {
    expect(
      spawnFormMatching({
        forms: DEFAULT_SPAWN_FORMS,
        specifier: "child_process",
        exported: "execSync",
      }),
    ).toStrictEqual({
      specifier: "node:child_process",
      exported: "execSync",
      position: 0,
      carries: SPAWN_TARGET_LINE,
    });
  });

  test("a module the table says nothing about reaches no entry", () => {
    expect(
      spawnFormMatching({ forms: DEFAULT_SPAWN_FORMS, specifier: "node:fs", exported: "readFile" }),
    ).toBeNull();
  });
});
