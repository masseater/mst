import { basename, dirname, join } from "node:path";

import { groupBy } from "es-toolkit";

import { MANIFEST_FILE_NAME } from "../canonical-values/package-manifest.ts";
import { readTextFile } from "../canonical-values/source-files.ts";
import { REPOSITORY_ROOT_WORKSPACE } from "../dependency-catalog/shared-dependency-index.ts";
import { matchesAnchoredGlobPath } from "../glob-path-match.ts";
import { worktreeFilePathsUnder } from "../repository-scan/worktree-files.ts";

import type { RuleMessage } from "../rule-message.ts";
import type { RequiredFileEntry } from "./required-file-entries.ts";

export const MISSING_REGISTERED_FILE_MESSAGE_ID = "missingRegisteredFile";

export const EMPTY_REGISTERED_FILE_MESSAGE_ID = "emptyRegisteredFile";

export const DEAD_OWNER_REGISTRATION_MESSAGE_ID = "deadOwnerRegistration";

export type UnmetRegistration = RuleMessage & { readonly workspace: string };

export type RequiredFileRegistry = {
  readonly repositoryRoot: string;
  readonly entries: readonly RequiredFileEntry[];
  readonly unscannedDirectoryNames: ReadonlySet<string>;
};

type ScannedWorktree = {
  readonly repositoryRoot: string;
  readonly filePaths: readonly string[];
  readonly workspaceDirectories: readonly string[];
};

const holderOf = (workspace: string): string =>
  workspace === REPOSITORY_ROOT_WORKSPACE ? "the repository root" : `\`${workspace}\``;

const contentGuaranteeOf = (listed: RequiredFileEntry): string =>
  listed.contentChecks.length === 0
    ? "What this file holds is read by no check, so this row asks only that it exists and holds something."
    : `What this file holds is read by ${listed.contentChecks.map((contentCheck) => `\`${contentCheck}\``).join(", ")}, so a file that merely exists leaves the row unmet.`;

const registeredPathIn = (asked: {
  readonly workspace: string;
  readonly pattern: string;
}): string =>
  asked.workspace === REPOSITORY_ROOT_WORKSPACE
    ? asked.pattern
    : `${asked.workspace}/${asked.pattern}`;

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

const holdsContent = (absolutePath: string): boolean =>
  (readTextFile(absolutePath) ?? "").trim() !== "";

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

const unmetFor = (
  scanned: ScannedWorktree,
  listed: RequiredFileEntry,
): readonly UnmetRegistration[] => {
  const workspaces = holdingWorkspacesOf({
    entry: listed,
    workspaceDirectories: scanned.workspaceDirectories,
  });
  const { owner } = listed;
  if (owner !== null && workspaces.length === 0) {
    return [
      reportOf({
        entry: listed,
        workspace: REPOSITORY_ROOT_WORKSPACE,
        messageId: DEAD_OWNER_REGISTRATION_MESSAGE_ID,
        registeredPath: listed.pattern,
        holder: `\`${owner}\``,
      }),
    ];
  }

  return workspaces.flatMap((workspace) => unmetInWorkspace(scanned, { entry: listed, workspace }));
};

const registryKeyOf = (registry: RequiredFileRegistry): string =>
  [
    registry.repositoryRoot,
    JSON.stringify(registry.entries),
    ...[...registry.unscannedDirectoryNames].toSorted(),
  ].join("\n");

const unmetByRegistry = new Map<string, ReadonlyMap<string, readonly UnmetRegistration[]>>();

const readRegistry = (
  registry: RequiredFileRegistry,
): ReadonlyMap<string, readonly UnmetRegistration[]> => {
  const filePaths = worktreeFilePathsUnder({
    root: registry.repositoryRoot,
    unscannedDirectoryNames: registry.unscannedDirectoryNames,
  });
  const scanned: ScannedWorktree = {
    repositoryRoot: registry.repositoryRoot,
    filePaths,
    workspaceDirectories: workspaceDirectoriesIn(filePaths),
  };
  const reports = registry.entries.flatMap((listed) => unmetFor(scanned, listed));
  return new Map(Object.entries(groupBy(reports, (report) => report.workspace)));
};

export const unmetRegistrationsIn = (
  registry: RequiredFileRegistry,
): ReadonlyMap<string, readonly UnmetRegistration[]> => {
  const named = registryKeyOf(registry);
  const memoized = unmetByRegistry.get(named);
  if (memoized !== undefined) return memoized;

  const read = readRegistry(registry);
  unmetByRegistry.set(named, read);
  return read;
};
