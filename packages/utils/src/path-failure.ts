import { attempt } from "es-toolkit";

const MISSING_PATH_CODE = "ENOENT";

const MISSING_PARENT_CODE = "ENOTDIR";

export const failureCodeOf = (failure: unknown): string | null => {
  if (typeof failure !== "object" || failure === null) return null;
  if (!("code" in failure)) return null;
  return typeof failure.code === "string" ? failure.code : null;
};

export const readUnlessMissing = <Read>(read: () => Read): Read | null => {
  const [unreadablePath, found] = attempt<Read, Error>(read);
  if (unreadablePath === null) return found;

  const code = failureCodeOf(unreadablePath);
  if (code === MISSING_PATH_CODE || code === MISSING_PARENT_CODE) return null;
  throw unreadablePath;
};
