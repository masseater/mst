import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { lock } from "proper-lockfile";

export type SlotHold = { release: () => Promise<void> };

export type AcquireConfiguration = {
  slotDir: string;
  limit: number;
  staleMs: number;
  onCompromised: (failure: Error) => void;
};

const markerPath = (slotDir: string, index: number): string => join(slotDir, `slot-${index}`);

const waitersDir = (slotDir: string): string => join(slotDir, "waiters");

const slotIndexes = (limit: number): number[] => [...Array(limit).keys()];

export const ensureSlots = (slotDir: string, limit: number): void => {
  mkdirSync(waitersDir(slotDir), { recursive: true });
  for (const index of slotIndexes(limit)) {
    writeFileSync(markerPath(slotDir, index), "", { flag: "a" });
  }
};

const lockUnlessHeld = async (
  marker: string,
  configuration: AcquireConfiguration,
): Promise<SlotHold | null> => {
  try {
    const release = await lock(marker, {
      stale: configuration.staleMs,
      retries: 0,
      onCompromised: configuration.onCompromised,
    });
    return { release };
  } catch (failure) {
    if ((failure as { code?: string }).code === "ELOCKED") return null;
    throw failure;
  }
};

export const tryAcquireAny = async (
  configuration: AcquireConfiguration,
): Promise<SlotHold | null> => {
  for (const index of slotIndexes(configuration.limit)) {
    const acquired = await lockUnlessHeld(markerPath(configuration.slotDir, index), configuration);
    if (acquired !== null) return acquired;
  }
  return null;
};

const lockIdentity = (lockPath: string): string => {
  try {
    return String(statSync(lockPath).ino);
  } catch (missingLock) {
    return "free";
  }
};

export const slotStateFingerprint = (slotDir: string, limit: number): string =>
  slotIndexes(limit)
    .map((index) => lockIdentity(`${markerPath(slotDir, index)}.lock`))
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
