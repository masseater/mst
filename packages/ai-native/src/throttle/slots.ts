import { randomBytes } from "node:crypto";
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { tryLock, unlock } from "fs-native-extensions";

import { tryAcquireFileLock } from "./acquire-file-lock.ts";

export type SlotHold = { release: () => Promise<void> };

export type AcquireConfiguration = {
  slotDir: string;
  limit: number;
};

const markerPath = (slotDir: string, index: number): string => join(slotDir, `slot-${index}`);

const lockPath = (marker: string): string => `${marker}.lock`;

const waitersDir = (slotDir: string): string => join(slotDir, "waiters");

const slotIndexes = (limit: number): number[] => [...Array(limit).keys()];

export const ensureSlots = (slotDir: string, limit: number): void => {
  mkdirSync(waitersDir(slotDir), { recursive: true });
  for (const index of slotIndexes(limit)) {
    const marker = markerPath(slotDir, index);
    writeFileSync(marker, "", { flag: "a" });
    writeFileSync(lockPath(marker), "", { flag: "a" });
  }
};

const lockUnlessHeld = (marker: string): SlotHold | null => {
  return tryAcquireFileLock({
    path: lockPath(marker),
    open: (path) => openSync(path, "r+"),
    tryLock,
    unlock,
    close: closeSync,
    recordGeneration: () => {
      writeFileSync(marker, randomBytes(16).toString("hex"));
    },
  });
};

export const tryAcquireAny = (configuration: AcquireConfiguration): Promise<SlotHold | null> =>
  Promise.try(() => {
    for (const index of slotIndexes(configuration.limit)) {
      const acquired = lockUnlessHeld(markerPath(configuration.slotDir, index));
      if (acquired !== null) return acquired;
    }
    return null;
  });

const generationIdentity = (marker: string): string => {
  try {
    return readFileSync(marker, "utf8") || "unused";
  } catch (unreadableGeneration) {
    return `unreadable:${(unreadableGeneration as { code: string }).code}`;
  }
};

export const slotStateFingerprint = (slotDir: string, limit: number): string =>
  slotIndexes(limit)
    .map((index) => generationIdentity(markerPath(slotDir, index)))
    .join(",");

export const enqueueWaiter = (slotDir: string): string => {
  const name = [
    String(Date.now()).padStart(13, "0"),
    String(process.pid),
    randomBytes(4).toString("hex"),
  ].join("-");
  const entryPath = join(waitersDir(slotDir), name);
  writeFileSync(entryPath, `${process.pid}\n`);
  return entryPath;
};

export const removeWaiter = (entryPath: string): void => {
  rmSync(entryPath, { force: true, recursive: true });
};

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (failure) {
    return (failure as { code?: string }).code === "EPERM";
  }
};

const recordedPid = (entryPath: string): number | null => {
  try {
    const record = readFileSync(entryPath, "utf8").trim();
    return /^[0-9]+$/.test(record) ? Number(record) : null;
  } catch (unreadableEntry) {
    return null;
  }
};

const survives = (entryPath: string): boolean => {
  const pid = recordedPid(entryPath);
  if (pid !== null && isAlive(pid)) return true;
  removeWaiter(entryPath);
  return false;
};

export const sweepWaiters = (slotDir: string): string[] =>
  readdirSync(waitersDir(slotDir))
    .toSorted()
    .filter((name) => survives(join(waitersDir(slotDir), name)));
