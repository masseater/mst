import { basename, dirname, join, resolve } from "node:path";

import { readTextFile } from "../canonical-values/source-files.ts";

const EXTERNAL_RECORDS_DIRECTORY = "__snapshots__";

const EXTERNAL_RECORDS_SUFFIX = ".snap";

const RECORD_ENTRY = /exports\[`((?:[^`\\]|\\[\S\s])*)`\]\s*=\s*`((?:[^`\\]|\\[\S\s])*)`;/gu;

const RECORD_ESCAPE = /\\([\S\s])/gu;

const EMPTY_BODY_RECORD = /^([$_\p{ID_Start}][$\p{ID_Continue}]*) \{\}$/u;

const RECORD_LINE_BREAK = /\r?\n/u;

const RECORD_TITLE_SEPARATOR = " > ";

export const MAX_INLINE_RECORD_LINES = 12;

export const externalRecordKeyOf = (titles: readonly string[], ordinal: number): string =>
  `${titles.join(RECORD_TITLE_SEPARATOR)} ${ordinal}`;

export const recordLineCountOf = (snapshot: string): number => {
  const lines = snapshot.split(RECORD_LINE_BREAK);
  const padded = lines.length >= 3 && lines.at(0) === "" && lines.at(-1) === "";
  return padded ? lines.length - 2 : lines.length;
};

const spelledRecord = (written: string): string => written.replaceAll(RECORD_ESCAPE, "$1");

const recordsIn = (externalRecordsSource: string): ReadonlyMap<string, string> =>
  new Map(
    [...externalRecordsSource.matchAll(RECORD_ENTRY)].map(
      (recordMatch) =>
        [spelledRecord(String(recordMatch[1])), spelledRecord(String(recordMatch[2]))] as const,
    ),
  );

export const externalRecordOf = (specPath: string, externalRecordKey: string): string | null => {
  const recordsPath = join(
    dirname(specPath),
    EXTERNAL_RECORDS_DIRECTORY,
    `${basename(specPath)}${EXTERNAL_RECORDS_SUFFIX}`,
  );
  const externalRecordsSource = readTextFile(recordsPath);
  return externalRecordsSource === null
    ? null
    : (recordsIn(externalRecordsSource).get(externalRecordKey) ?? null);
};

export const fileRecordOf = (specPath: string, written: string): string | null =>
  readTextFile(resolve(dirname(specPath), written));

export const emptyBodyConstructorOf = (snapshot: string): string | null =>
  EMPTY_BODY_RECORD.exec(snapshot.trim())?.[1] ?? null;
