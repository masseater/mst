import { basename, dirname, join, resolve } from "node:path";

import { readTextFile } from "../canonical-values/source-files.ts";

const EXTERNAL_RECORDS_DIRECTORY = "__snapshots__";

const EXTERNAL_RECORDS_SUFFIX = ".snap";

const RECORD_ENTRY = /exports\[`((?:[^`\\]|\\[\S\s])*)`\]\s*=\s*`((?:[^`\\]|\\[\S\s])*)`;/gu;

const RECORD_ESCAPE = /\\([\S\s])/gu;

const EMPTY_BODY_RECORD = /^([$_\p{ID_Start}][$\p{ID_Continue}]*) \{\}$/u;

const RECORD_LINE_BREAK = "\n";

const RECORD_TITLE_SEPARATOR = " > ";

export const MAX_INLINE_RECORD_LINES = 12;

export const externalRecordKeyOf = (titles: readonly string[], ordinal: number): string =>
  `${titles.join(RECORD_TITLE_SEPARATOR)} ${ordinal}`;

export const recordLineCountOf = (recorded: string): number => {
  const written = recorded.replaceAll("\r\n", RECORD_LINE_BREAK);
  const padded =
    written.length >= 2 &&
    written.startsWith(RECORD_LINE_BREAK) &&
    written.endsWith(RECORD_LINE_BREAK);
  return (padded ? written.slice(1, -1) : written).split(RECORD_LINE_BREAK).length;
};

const spelledRecord = (written: string): string => written.replaceAll(RECORD_ESCAPE, "$1");

const recordsIn = (writtenText: string): ReadonlyMap<string, string> =>
  new Map(
    [...writtenText.matchAll(RECORD_ENTRY)].map(
      (listed) => [spelledRecord(String(listed[1])), spelledRecord(String(listed[2]))] as const,
    ),
  );

export const externalRecordOf = (specPath: string, named: string): string | null => {
  const recordsPath = join(
    dirname(specPath),
    EXTERNAL_RECORDS_DIRECTORY,
    `${basename(specPath)}${EXTERNAL_RECORDS_SUFFIX}`,
  );
  const writtenText = readTextFile(recordsPath);
  return writtenText === null ? null : (recordsIn(writtenText).get(named) ?? null);
};

export const fileRecordOf = (specPath: string, written: string): string | null =>
  readTextFile(resolve(dirname(specPath), written));

export const emptyBodyConstructorOf = (written: string): string | null =>
  EMPTY_BODY_RECORD.exec(written.trim())?.[1] ?? null;
