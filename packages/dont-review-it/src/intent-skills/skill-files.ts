import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { readUnlessMissing } from "@mst/repository-checks";

import type { IntentSkillsConfig } from "./config.ts";
import type { PublishedManifest } from "./manifest.ts";

export const skillsDirectoryOf = ({
  manifest,
  config,
}: {
  readonly manifest: PublishedManifest;
  readonly config: IntentSkillsConfig;
}): string => join(dirname(manifest.file.absolutePath), config.skillsDirectory);

export const listSkillFiles = ({
  directory,
  config,
}: {
  readonly directory: string;
  readonly config: IntentSkillsConfig;
}): readonly string[] => {
  const listedEntries =
    readUnlessMissing(() => readdirSync(directory, { withFileTypes: true })) ?? [];
  return listedEntries.flatMap((listed) =>
    listed.isDirectory()
      ? listSkillFiles({ directory: join(directory, listed.name), config })
      : listed.isFile() && listed.name === config.skillFileName
        ? [join(directory, listed.name)]
        : [],
  );
};
