import { listedUnder } from "./option-lists.ts";

import type { Options } from "@oxlint/plugins";

export const SPAWN_TARGET_NAME = "name";

export const SPAWN_TARGET_LINE = "commandLine";

export const SPAWN_FORM_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      specifier: { type: "string" },
      exported: { type: "string" },
      position: { type: "integer", minimum: 0 },
      carries: {
        oneOf: [
          { type: "string", const: SPAWN_TARGET_NAME },
          { type: "string", const: SPAWN_TARGET_LINE },
        ],
      },
    },
    required: ["specifier", "exported", "carries"],
    additionalProperties: false,
  },
} as const;

/** @canonical-values dont-review-it.child-process-export */
const CHILD_PROCESS_EXPORTS = ["spawn"] as const;

const CHILD_PROCESS_EXPORT = {
  spawn: CHILD_PROCESS_EXPORTS[0],
} as const;

export type SpawnForm = {
  readonly specifier: string;
  readonly exported: string;
  readonly position: number;
  readonly carries: typeof SPAWN_TARGET_NAME | typeof SPAWN_TARGET_LINE;
};

export const DEFAULT_SPAWN_FORMS: readonly SpawnForm[] = [
  { specifier: "node:child_process", exported: "exec", position: 0, carries: SPAWN_TARGET_LINE },
  {
    specifier: "node:child_process",
    exported: "execSync",
    position: 0,
    carries: SPAWN_TARGET_LINE,
  },
  {
    specifier: "node:child_process",
    exported: "execFile",
    position: 0,
    carries: SPAWN_TARGET_NAME,
  },
  {
    specifier: "node:child_process",
    exported: "execFileSync",
    position: 0,
    carries: SPAWN_TARGET_NAME,
  },
  {
    specifier: "node:child_process",
    exported: CHILD_PROCESS_EXPORT.spawn,
    position: 0,
    carries: SPAWN_TARGET_NAME,
  },
  {
    specifier: "node:child_process",
    exported: "spawnSync",
    position: 0,
    carries: SPAWN_TARGET_NAME,
  },
  { specifier: "execa", exported: "execa", position: 0, carries: SPAWN_TARGET_NAME },
  { specifier: "execa", exported: "execaSync", position: 0, carries: SPAWN_TARGET_NAME },
  { specifier: "execa", exported: "execaCommand", position: 0, carries: SPAWN_TARGET_LINE },
  { specifier: "execa", exported: "execaCommandSync", position: 0, carries: SPAWN_TARGET_LINE },
  { specifier: "execa", exported: "$", position: 0, carries: SPAWN_TARGET_LINE },
  { specifier: "zx", exported: "$", position: 0, carries: SPAWN_TARGET_LINE },
];

export const SPAWN_FORMS_OPTION = "spawnForms";

export const spawnFormsIn = ({
  options,
  standing,
}: {
  readonly options: Readonly<Options>;
  readonly standing: readonly SpawnForm[];
}): readonly SpawnForm[] => {
  const declared = listedUnder(options, SPAWN_FORMS_OPTION).flatMap(
    ({ specifier, exported, position, carries }): readonly SpawnForm[] => {
      if (typeof specifier !== "string" || typeof exported !== "string") return [];
      if (carries !== SPAWN_TARGET_NAME && carries !== SPAWN_TARGET_LINE) return [];
      return [
        { specifier, exported, position: typeof position === "number" ? position : 0, carries },
      ];
    },
  );
  return declared.length === 0 ? standing : declared;
};

const RUNTIME_MARK = /^node:/u;

export const spawnFormMatching = ({
  forms,
  specifier,
  exported,
}: {
  readonly forms: readonly SpawnForm[];
  readonly specifier: string;
  readonly exported: string;
}): SpawnForm | null =>
  forms.find(
    (form) =>
      form.exported === exported &&
      form.specifier.replace(RUNTIME_MARK, "") === specifier.replace(RUNTIME_MARK, ""),
  ) ?? null;
