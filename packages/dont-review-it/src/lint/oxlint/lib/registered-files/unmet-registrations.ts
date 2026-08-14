import { basename, dirname, join } from "node:path";

import { groupBy, memoize } from "es-toolkit";

import { MANIFEST_FILE_NAME } from "../canonical-values/package-manifest.ts";
import { readTextFile } from "../canonical-values/source-files.ts";
import { REPOSITORY_ROOT_WORKSPACE } from "../dependency-catalog/shared-dependency-index.ts";
import { matchesAnchoredGlobPath } from "../glob-path-match.ts";
import { worktreeFilePathsUnder } from "../repository-scan/worktree-files.ts";

import type { RuleMessage } from "../rule-message.ts";
import type { RequiredFileEntry } from "./required-file-entries.ts";

const workspaceDirectoriesIn = (filePaths: readonly string[]): readonly string[] =>
  filePaths.filter((path) => basename(path) === MANIFEST_FILE_NAME).map((path) => dirname(path));

const holdingWorkspacesOf = (asked: {
  readonly entry: RequiredFileEntry;
  readonly workspaceDirectories: readonly string[];
}): readonly string[] => {
  const { owner } = asked.entry;
  if (owner === null) return [REPOSITORY_ROOT_WORKSPACE];

  return asked.workspaceDirectories.filter((workspace) =>
    matchesAnchoredGlobPath({ relativePath: workspace, pattern: owner }),
  );
};

export const MISSING_REGISTERED_FILE_MESSAGE_ID = "missingRegisteredFile";

export const EMPTY_REGISTERED_FILE_MESSAGE_ID = "emptyRegisteredFile";

const holdsContent = (absolutePath: string): boolean =>
  (readTextFile(absolutePath) ?? "").trim() !== "";

type ScannedWorktree = {
  readonly repositoryRoot: string;
  readonly filePaths: readonly string[];
  readonly workspaceDirectories: readonly string[];
};

const holderOf = (workspace: string): string =>
  workspace === REPOSITORY_ROOT_WORKSPACE ? "the repository root" : `\`${workspace}\``;

const registeredPathIn = (asked: {
  readonly workspace: string;
  readonly pattern: string;
}): string =>
  asked.workspace === REPOSITORY_ROOT_WORKSPACE
    ? asked.pattern
    : `${asked.workspace}/${asked.pattern}`;

export type UnmetRegistration = RuleMessage & { readonly workspace: string };

const contentGuaranteeOf = (registration: RequiredFileEntry): string =>
  registration.contentChecks.length === 0
    ? "What this file holds is read by no check, so this row asks only that it exists and holds something."
    : `What this file holds is read by ${registration.contentChecks.map((checkName) => `\`${checkName}\``).join(", ")}, so a file that merely exists leaves the row unmet.`;

const reportOf = (asked: {
  readonly entry: RequiredFileEntry;
  readonly workspace: string;
  readonly messageId: string;
  readonly registeredPath: string;
  readonly holder: string;
}): UnmetRegistration => ({
  workspace: asked.workspace,
  messageId: asked.messageId,
  data: {
    registeredPath: asked.registeredPath,
    holder: asked.holder,
    reason: asked.entry.reason,
    contentGuarantee: contentGuaranteeOf(asked.entry),
  },
});

const unmetInWorkspace = (
  scanned: ScannedWorktree,
  asked: { readonly entry: RequiredFileEntry; readonly workspace: string },
): readonly UnmetRegistration[] => {
  const registeredPath = registeredPathIn({
    workspace: asked.workspace,
    pattern: asked.entry.pattern,
  });
  const held = { ...asked, holder: holderOf(asked.workspace) };
  const matched = scanned.filePaths.filter((path) =>
    matchesAnchoredGlobPath({ relativePath: path, pattern: registeredPath }),
  );
  if (matched.length === 0) {
    return [reportOf({ ...held, messageId: MISSING_REGISTERED_FILE_MESSAGE_ID, registeredPath })];
  }

  const emptied = matched.filter((path) => !holdsContent(join(scanned.repositoryRoot, path)));
  if (emptied.length < matched.length) return [];
  return emptied.map((path) =>
    reportOf({ ...held, messageId: EMPTY_REGISTERED_FILE_MESSAGE_ID, registeredPath: path }),
  );
};

export const DEAD_OWNER_REGISTRATION_MESSAGE_ID = "deadOwnerRegistration";

const unmetFor = (
  scanned: ScannedWorktree,
  registration: RequiredFileEntry,
): readonly UnmetRegistration[] => {
  const workspaces = holdingWorkspacesOf({
    entry: registration,
    workspaceDirectories: scanned.workspaceDirectories,
  });
  const { owner } = registration;
  if (owner !== null && workspaces.length === 0) {
    return [
      reportOf({
        entry: registration,
        workspace: REPOSITORY_ROOT_WORKSPACE,
        messageId: DEAD_OWNER_REGISTRATION_MESSAGE_ID,
        registeredPath: registration.pattern,
        holder: `\`${owner}\``,
      }),
    ];
  }

  return workspaces.flatMap((workspace) =>
    unmetInWorkspace(scanned, { entry: registration, workspace }),
  );
};

export type RequiredFileRegistry = {
  readonly repositoryRoot: string;
  readonly entries: readonly RequiredFileEntry[];
  readonly unscannedDirectoryNames: ReadonlySet<string>;
};

const registryKeyOf = (registry: RequiredFileRegistry): string =>
  [
    registry.repositoryRoot,
    JSON.stringify(registry.entries),
    ...[...registry.unscannedDirectoryNames].toSorted(),
  ].join("\n");

export const unmetRegistrationsIn = memoize(
  (registry: RequiredFileRegistry): ReadonlyMap<string, readonly UnmetRegistration[]> => {
    const filePaths = worktreeFilePathsUnder({
      root: registry.repositoryRoot,
      unscannedDirectoryNames: registry.unscannedDirectoryNames,
    });
    const scanned: ScannedWorktree = {
      repositoryRoot: registry.repositoryRoot,
      filePaths,
      workspaceDirectories: workspaceDirectoriesIn(filePaths),
    };
    const reports = registry.entries.flatMap((registration) => unmetFor(scanned, registration));
    return new Map(Object.entries(groupBy(reports, (report) => report.workspace)));
  },
  { getCacheKey: registryKeyOf },
);
