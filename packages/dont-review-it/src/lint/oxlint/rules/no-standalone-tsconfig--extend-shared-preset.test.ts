import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { testLintRule } from "@mst/lint-rule-authoring";
import { describe } from "vite-plus/test";

import { noStandaloneTsconfig } from "./no-standalone-tsconfig--extend-shared-preset.ts";

const sharedPresets = ["dont-review-it/tsconfig/library.json", "dont-review-it/tsconfig/app.json"];

const fixtureDir = mkdtempSync(join(tmpdir(), "dont-review-it-no-standalone-tsconfig-"));

const writeWorkspaceFixture = (name: string, tsconfig: string): string => {
  const directory = join(fixtureDir, name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "tsconfig.json"), tsconfig);
  return join(directory, "index.ts");
};

const extendsLibrary = writeWorkspaceFixture(
  "extends-library",
  '{ "extends": "@mst/dont-review-it/tsconfig/library.json" }\n',
);

const extendsApp = writeWorkspaceFixture(
  "extends-app",
  '{ "extends": "@mst/dont-review-it/tsconfig/app.json" }\n',
);

const extendsRelative = writeWorkspaceFixture(
  "extends-relative",
  '{ "extends": "../dont-review-it/tsconfig/library.json" }\n',
);

const extendsOwnPreset = writeWorkspaceFixture(
  "extends-own-preset",
  '{ "extends": "./tsconfig/library.json" }\n',
);

const extendsArray = writeWorkspaceFixture(
  "extends-array",
  '{ "extends": ["./local.json", "@mst/dont-review-it/tsconfig/library.json"] }\n',
);

const withComments = writeWorkspaceFixture(
  "with-comments",
  '{\n  /* Bundler mode */\n  "extends": "@mst/dont-review-it/tsconfig/app.json", // preset\n}\n',
);

const forgotten = writeWorkspaceFixture(
  "forgotten",
  '{ "extends": "@mst/dont-review-it/tsconfig/library.json" }\n',
);

const standalone = writeWorkspaceFixture(
  "standalone",
  '{ "compilerOptions": { "strict": true, "noEmit": true } }\n',
);

const extendsBase = writeWorkspaceFixture(
  "extends-base",
  '{ "extends": "@mst/dont-review-it/tsconfig/base.json" }\n',
);

const extendsForeignPreset = writeWorkspaceFixture(
  "extends-foreign-preset",
  '{ "extends": "@tsconfig/node22/tsconfig.json" }\n',
);

const malformed = writeWorkspaceFixture("malformed", "this is not a tsconfig at all\n");

mkdirSync(join(fixtureDir, "standalone", "src", "deep"), { recursive: true });
const buriedUnderStandalone = join(fixtureDir, "standalone", "src", "deep", "index.ts");

const withoutAnyTsconfig = join(fixtureDir, "no-tsconfig-anywhere.ts");

describe("dont-review-it/no-standalone-tsconfig--extend-shared-preset", () => {
  testLintRule(noStandaloneTsconfig, {
    valid: [
      {
        name: "without configured presets the rule inspects nothing",
        code: "export const total = 1;",
        filename: standalone,
      },
      {
        name: "an empty preset list inspects nothing",
        code: "export const total = 1;",
        filename: standalone,
        options: [[]],
      },
      {
        name: "extending the library preset by package name passes",
        code: "export const total = 1;",
        filename: extendsLibrary,
        options: [sharedPresets],
      },
      {
        name: "extending the app preset by package name passes",
        code: "export const total = 1;",
        filename: extendsApp,
        options: [sharedPresets],
      },
      {
        name: "extending the same preset by a relative path passes",
        code: "export const total = 1;",
        filename: extendsRelative,
        options: [sharedPresets],
      },
      {
        name: "one allowed preset among several extends entries passes",
        code: "export const total = 1;",
        filename: extendsArray,
        options: [sharedPresets],
      },
      {
        name: "comments and a trailing comma do not hide the extends entry",
        code: "export const total = 1;",
        filename: withComments,
        options: [sharedPresets],
      },
      {
        name: "the tsconfig above a file is looked up on disk",
        code: "export const total = 1;",
        filename: forgotten,
        options: [sharedPresets],
      },
      {
        name: "the answer is remembered, so removing the tsconfig afterwards does not change it",
        code: "export const total = 2;",
        filename: forgotten,
        options: [sharedPresets],
        before: () => {
          rmSync(join(fixtureDir, "forgotten", "tsconfig.json"));
        },
      },
      {
        name: "a file with no tsconfig above it is left alone",
        code: "export const total = 1;",
        filename: withoutAnyTsconfig,
        options: [sharedPresets],
      },
    ],
    invalid: [
      {
        name: "a tsconfig that writes its own compilerOptions is reported",
        code: "export const total = 1;",
        filename: standalone,
        options: [sharedPresets],
        errors: [{ messageId: "standaloneTsconfig" }],
      },
      {
        name: "a file buried under a standalone tsconfig is reported too",
        code: "export const total = 1;",
        filename: buriedUnderStandalone,
        options: [sharedPresets],
        errors: [{ messageId: "standaloneTsconfig" }],
      },
      {
        name: "extending the shared base directly skips the layer that decides the runtime",
        code: "export const total = 1;",
        filename: extendsBase,
        options: [sharedPresets],
        errors: [{ messageId: "standaloneTsconfig" }],
      },
      {
        name: "extending a preset from somewhere else is not extending this one",
        code: "export const total = 1;",
        filename: extendsForeignPreset,
        options: [sharedPresets],
        errors: [{ messageId: "standaloneTsconfig" }],
      },
      {
        name: "a path that omits the package owning the preset does not say which preset it means",
        code: "export const total = 1;",
        filename: extendsOwnPreset,
        options: [sharedPresets],
        errors: [{ messageId: "standaloneTsconfig" }],
      },
      {
        name: "a tsconfig that cannot be read as JSON extends nothing",
        code: "export const total = 1;",
        filename: malformed,
        options: [sharedPresets],
        errors: [{ messageId: "standaloneTsconfig" }],
      },
    ],
  });
});
