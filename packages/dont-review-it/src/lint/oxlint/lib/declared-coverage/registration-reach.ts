import { uniq } from "es-toolkit";

import {
  spelledNames,
  type CoverageFinding,
  type DeclaredCheck,
  type RegistrationRow,
  type RegistrationTable,
} from "./coverage-declarations.ts";
import { excludingPatternsOf, opensPath, pathsMatching } from "./uncovered-paths.ts";

export const EXCLUDED_REGISTRATION_MESSAGE_ID = "excludedRegistration";

export const UNOPENED_REGISTRATION_MESSAGE_ID = "unopenedRegistration";

export const DEAD_REGISTRATION_MESSAGE_ID = "deadRegistration";

export const UNDECLARED_RECEIVER_MESSAGE_ID = "undeclaredReceiver";

const spelledRegistryOf = (table: RegistrationTable): string => `\`${table.name}\``;

export const deadRowFindings = (asked: {
  readonly registry: string;
  readonly rows: readonly RegistrationRow[];
  readonly paths: readonly string[];
}): readonly CoverageFinding[] =>
  asked.rows
    .filter(
      (lined) => pathsMatching({ paths: asked.paths, patterns: [lined.pattern] }).length === 0,
    )
    .map((lined) => ({
      heldPath: null,
      messageId: DEAD_REGISTRATION_MESSAGE_ID,
      data: { registry: asked.registry, pattern: lined.pattern, reason: lined.reason },
    }));

const receiverFindings = (asked: {
  readonly record: string;
  readonly receivers: readonly string[];
  readonly checks: readonly DeclaredCheck[];
}): readonly CoverageFinding[] => {
  const declaredNames = new Set(asked.checks.map((check) => check.name));
  return asked.receivers
    .filter((receiver) => !declaredNames.has(receiver))
    .map((receiver) => ({
      heldPath: null,
      messageId: UNDECLARED_RECEIVER_MESSAGE_ID,
      data: {
        record: asked.record,
        receiver,
        declaredChecks: spelledNames([...declaredNames]),
      },
    }));
};

const unreachableFindingOf = (asked: {
  readonly table: RegistrationTable;
  readonly row: RegistrationRow;
  readonly consumer: DeclaredCheck;
  readonly paths: readonly string[];
}): CoverageFinding | null => {
  const matched = pathsMatching({ paths: asked.paths, patterns: [asked.row.pattern] });
  const [reachedPath] = matched;
  if (reachedPath === undefined) return null;
  if (matched.some((relativePath) => opensPath({ check: asked.consumer, relativePath }))) {
    return null;
  }

  const excluded = uniq(
    matched.flatMap((relativePath) => excludingPatternsOf({ check: asked.consumer, relativePath })),
  );
  const held = {
    registry: spelledRegistryOf(asked.table),
    pattern: asked.row.pattern,
    check: asked.consumer.name,
    matchedPath: reachedPath,
  };
  return excluded.length === 0
    ? {
        heldPath: reachedPath,
        messageId: UNOPENED_REGISTRATION_MESSAGE_ID,
        data: { ...held, coveredPaths: spelledNames(asked.consumer.coveredPaths) },
      }
    : {
        heldPath: reachedPath,
        messageId: EXCLUDED_REGISTRATION_MESSAGE_ID,
        data: { ...held, exclusion: spelledNames(excluded) },
      };
};

const recordedReceiverFindings = (asked: {
  readonly table: RegistrationTable;
  readonly checks: readonly DeclaredCheck[];
}): readonly CoverageFinding[] => {
  const registry = spelledRegistryOf(asked.table);
  const consumer = receiverFindings({
    record: `Registry ${registry}`,
    receivers: [asked.table.consumedBy],
    checks: asked.checks,
  });
  const linedRows = [...asked.table.rows, ...asked.table.allowances];
  return [
    ...consumer,
    ...linedRows.flatMap((lined) =>
      receiverFindings({
        record: `Row \`${lined.pattern}\` of registry ${registry}`,
        receivers: lined.receivers,
        checks: asked.checks,
      }),
    ),
  ];
};

const tableFindings = (asked: {
  readonly table: RegistrationTable;
  readonly checks: readonly DeclaredCheck[];
  readonly paths: readonly string[];
}): readonly CoverageFinding[] => {
  const consumer = asked.checks.find((check) => check.name === asked.table.consumedBy) ?? null;
  const reached =
    consumer === null
      ? []
      : asked.table.rows.flatMap((lined) => {
          const found = unreachableFindingOf({ ...asked, consumer, row: lined });
          return found === null ? [] : [found];
        });

  return [
    ...recordedReceiverFindings({ table: asked.table, checks: asked.checks }),
    ...reached,
    ...deadRowFindings({
      registry: spelledRegistryOf(asked.table),
      rows: asked.table.allowances,
      paths: asked.paths,
    }),
  ];
};

export const registrationFindings = (asked: {
  readonly tables: readonly RegistrationTable[];
  readonly checks: readonly DeclaredCheck[];
  readonly paths: readonly string[];
}): readonly CoverageFinding[] =>
  asked.tables.flatMap((table) =>
    tableFindings({ table, checks: asked.checks, paths: asked.paths }),
  );
