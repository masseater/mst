import { dirname, resolve } from "node:path";

import { createDontReviewItRule } from "../../../create-rule.ts";
import { findWorkspaceRoot } from "../lib/canonical-values/workspace-root.ts";
import { matchesAnchoredGlobPath } from "../lib/glob-path-match.ts";
import { type RuleMessage } from "../lib/rule-message.ts";
import {
  deadReleasesIn,
  FORBIDDEN_TRACKED_PATH_SCHEMA,
  registeredTrackedPathsFrom,
  releasesFrom,
  trackedPathsInForce,
  type ForbiddenTrackedPath,
  type GroundedPattern,
} from "../lib/tracked-paths/forbidden-tracked-paths.ts";
import {
  IGNORE_SETTINGS_FILE_NAME,
  ignoreListingAt,
  listedInIgnoreSettings,
} from "../lib/tracked-paths/ignore-listing.ts";
import { trackedFilesIn } from "../lib/tracked-paths/tracked-files.ts";

import type { ESTree } from "@oxlint/plugins";

const groundlessExceptionFindings = (
  registrations: readonly ForbiddenTrackedPath[],
): readonly RuleMessage[] =>
  registrations.flatMap((registration) =>
    registration.exceptions
      .filter((excepted) => excepted.reason === "")
      .map((excepted) => ({
        messageId: "groundlessException",
        data: { excepted: excepted.pattern, pattern: registration.pattern },
      })),
  );

const groundlessReleaseFindings = (releases: readonly GroundedPattern[]): readonly RuleMessage[] =>
  releases
    .filter((release) => release.reason === "")
    .map((release) => ({ messageId: "groundlessRelease", data: { pattern: release.pattern } }));

const deadReleaseFindings = (releases: readonly GroundedPattern[]): readonly RuleMessage[] =>
  deadReleasesIn(releases).map((release) => ({
    messageId: "deadRelease",
    data: { pattern: release.pattern },
  }));

const excusedBy = (registration: ForbiddenTrackedPath, relativePath: string): boolean =>
  registration.exceptions.some(
    (excepted) =>
      excepted.reason !== "" &&
      matchesAnchoredGlobPath({ relativePath, pattern: excepted.pattern }),
  );

const trackedFindings = ({
  registrations,
  trackedFiles,
}: {
  readonly registrations: readonly ForbiddenTrackedPath[];
  readonly trackedFiles: readonly string[];
}): readonly RuleMessage[] =>
  trackedFiles.flatMap((relativePath) => {
    const registration = registrations.find((candidate) =>
      matchesAnchoredGlobPath({ relativePath, pattern: candidate.pattern }),
    );
    if (registration === undefined || excusedBy(registration, relativePath)) return [];
    return [
      {
        messageId: "trackedForbiddenPath",
        data: { path: relativePath, reason: registration.reason },
      },
    ];
  });

const unignoredFindings = ({
  registrations,
  listing,
}: {
  readonly registrations: readonly ForbiddenTrackedPath[];
  readonly listing: ReadonlySet<string>;
}): readonly RuleMessage[] =>
  registrations
    .filter(
      (registration) =>
        registration.ignoreListing &&
        !listedInIgnoreSettings({ pattern: registration.pattern, listing }),
    )
    .map((registration) => ({
      messageId: "unignoredForbiddenPattern",
      data: {
        pattern: registration.pattern,
        ignoreFile: IGNORE_SETTINGS_FILE_NAME,
        reason: registration.reason,
      },
    }));

export const forbidTrackedPath = createDontReviewItRule({
  name: "forbid-tracked-path--untrack-and-ignore",
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every path registered as untrackable to stay out of the tracked file list and to stand in the ignore settings, so values that belong to one machine and output that a build produces never ride a commit into another clone",
      relatedGuidelines: [],
    },
    messages: {
      trackedForbiddenPath:
        "A path registered as untrackable must not stand among the tracked files. `{{path}}` is tracked, and its row reads: {{reason}}. Remove it from the index, list its pattern in the ignore settings, and leave the file in the working tree. Move whatever another clone needs into a template tracked under a different name. Deleting the file is not the repair.",
      unignoredForbiddenPattern:
        "A pattern registered as untrackable must not stay out of the ignore settings. `{{pattern}}` matches no entry of `{{ignoreFile}}`, and its row reads: {{reason}}. Add `{{pattern}}` to that file, spelled the way the row spells it.",
      groundlessException:
        "An exception row that carries no grounds must not stand in the table. The row excepting `{{excepted}}` under `{{pattern}}` leaves its reason empty. Write the grounds into that row, or delete the row and untrack the paths it covers.",
      groundlessRelease:
        "A release row that carries no grounds must not stand in the configuration. The row releasing `{{pattern}}` leaves its reason empty. Write the grounds into that row, or delete the row and leave the registered pattern in force.",
      deadRelease:
        "A release row that names a pattern outside the default table must not stand in the configuration. No default row carries the released `{{pattern}}`. Delete the row, and delete the configured row itself to drop a pattern this configuration added.",
    },
    schema: FORBIDDEN_TRACKED_PATH_SCHEMA,
  },
  create(inspection) {
    const file = resolve(inspection.cwd, inspection.filename);
    const workspaceRoot = findWorkspaceRoot(dirname(file));
    if (dirname(file) !== workspaceRoot) return {};

    const registered = registeredTrackedPathsFrom(inspection.options);
    const releases = releasesFrom(inspection.options);
    const registrations = trackedPathsInForce({ registered, releases });

    return {
      Program(node: ESTree.Program) {
        const findings = [
          ...groundlessExceptionFindings(registrations),
          ...groundlessReleaseFindings(releases),
          ...deadReleaseFindings(releases),
          ...trackedFindings({
            registrations,
            trackedFiles: trackedFilesIn({ cwd: workspaceRoot, env: process.env }),
          }),
          ...unignoredFindings({ registrations, listing: ignoreListingAt(workspaceRoot) }),
        ];

        for (const finding of findings) inspection.report({ node, ...finding });
      },
    };
  },
});
