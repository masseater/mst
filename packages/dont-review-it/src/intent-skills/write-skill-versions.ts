import { readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";

import { attempt } from "es-toolkit";
import { parseTree } from "jsonc-parser";

import {
  listRepositoryFiles,
  type ScannedFile,
} from "../lint/oxlint/lib/canonical-values/source-files.ts";
import { propertyValueOf } from "./manifest.ts";
import { declaredVersionOf, type SkillPackage } from "./shipped-versions.ts";
import { listSkillFiles, skillsDirectoryOf } from "./skill-files.ts";
import { withLibraryVersion } from "./skill-version.ts";

import type { IntentSkillsConfig } from "./config.ts";

export type SkillVersionWriteReport = {
  readonly failures: readonly string[];
};

const publishedScopeOf = ({
  file,
  config,
  repositoryRoot,
}: {
  readonly file: ScannedFile;
  readonly config: IntentSkillsConfig;
  readonly repositoryRoot: string;
}): SkillPackage | null => {
  const source = readFileSync(file.absolutePath, "utf8");
  const root = parseTree(source);
  if (root === undefined || typeof propertyValueOf(root, "name") !== "string") return null;
  if (propertyValueOf(root, "private") === true) return null;

  return { manifest: { file, source, root }, config, repositoryRoot };
};

const rewriteSkillFile = ({
  scope,
  version,
  skillFile,
}: {
  readonly scope: SkillPackage;
  readonly version: string;
  readonly skillFile: string;
}): readonly string[] => {
  const source = readFileSync(skillFile, "utf8");
  const rewritten = withLibraryVersion({ source, version });
  if (rewritten === source) return [];

  const [unwritable] = attempt<null, Error>(() => {
    writeFileSync(skillFile, rewritten);
    return null;
  });
  return unwritable === null
    ? []
    : [
        `${relative(scope.repositoryRoot, skillFile)} could not be rewritten: ${unwritable.message}`,
      ];
};

const scopeFailures = (scope: SkillPackage): readonly string[] => {
  const version = declaredVersionOf(scope);
  if (version === null) return [];

  return listSkillFiles({
    directory: skillsDirectoryOf(scope),
    config: scope.config,
  }).flatMap((skillFile) => rewriteSkillFile({ scope, version, skillFile }));
};

export const writeSkillVersions = ({
  repositoryRoot,
  config,
}: {
  readonly repositoryRoot: string;
  readonly config: IntentSkillsConfig;
}): SkillVersionWriteReport => ({
  failures: listRepositoryFiles(repositoryRoot)
    .manifests.flatMap((file) => publishedScopeOf({ file, config, repositoryRoot }) ?? [])
    .flatMap(scopeFailures)
    .toSorted(),
});
