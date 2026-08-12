import type { ChangedFile } from "./name-status.ts";
import type { CiCheck, PrContext, ReviewThread } from "./pr-context.ts";

const cell = (writtenText: string): string =>
  writtenText.replaceAll("|", "\\|").replaceAll("\n", "<br>");

const contentLabel = (file: ChangedFile): string => {
  if (file.content !== null) return "included";
  return file.omissionReason === null
    ? "omitted: not available"
    : `omitted: ${file.omissionReason}`;
};

const changedFilesSection = (files: readonly ChangedFile[]): readonly string[] => [
  "## Changed Files",
  "",
  "| Status | Path | Content |",
  "| --- | --- | --- |",
  ...files.map(
    (file) => `| ${cell(file.statusCode)} | ${cell(file.path)} | ${cell(contentLabel(file))} |`,
  ),
  "",
];

const unresolvedCount = (threads: readonly ReviewThread[]): number =>
  threads.filter((thread) => !thread.resolved).length;

const outdatedCount = (threads: readonly ReviewThread[]): number =>
  threads.filter((thread) => thread.outdated).length;

const outdatedUnresolvedCount = (threads: readonly ReviewThread[]): number =>
  threads.filter((thread) => thread.outdated && !thread.resolved).length;

const commentsSection = (carried: PrContext): readonly string[] => [
  "## Existing Comments",
  "",
  `- Reviews: ${carried.comments.reviews.length}`,
  `- PR-level comments: ${carried.comments.prComments.length}`,
  `- Inline comments: ${carried.comments.inlineComments.length}`,
  `- Threads: ${carried.comments.threads.length}`,
  `- Unresolved threads: ${unresolvedCount(carried.comments.threads)}`,
  `- Outdated threads: ${outdatedCount(carried.comments.threads)}`,
  `- Outdated and unresolved threads: ${outdatedUnresolvedCount(carried.comments.threads)}`,
  "",
];

const ciRow = (check: CiCheck): string =>
  `| ${cell(check.name)} | ${cell(check.state)} | ${cell(check.bucket)} | ${check.detailsUrl === null ? "" : cell(check.detailsUrl)} |`;

const ciSection = (carried: PrContext): readonly string[] => [
  "## CI",
  "",
  "| Name | State | Bucket | Details |",
  "| --- | --- | --- | --- |",
  ...carried.ci.checks.map(ciRow),
  "",
];

const failedLogsSection = (carried: PrContext): readonly string[] =>
  carried.ci.failedLogPaths.length === 0
    ? ["No failed CI logs were downloaded."]
    : ["Failed CI logs:", "", ...carried.ci.failedLogPaths.map((path) => `- ${path}`)];

export const renderMarkdown = (carried: PrContext): string =>
  [
    "# PR Context",
    "",
    "## Pull Request",
    "",
    `- PR: #${carried.prNumber}`,
    `- Base: ${carried.base}`,
    `- Head: ${carried.head}`,
    "",
    ...changedFilesSection(carried.changedFiles),
    ...commentsSection(carried),
    ...ciSection(carried),
    ...failedLogsSection(carried),
  ].join("\n");
