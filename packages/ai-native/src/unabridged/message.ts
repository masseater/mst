const quoted = (slicers: readonly string[]): string =>
  slicers.map((slicer) => `\`${slicer}\``).join(" and ");

export const denyReasonFor = (slicers: readonly string[]): string =>
  [
    `unabridged: the command runs ${quoted(slicers)}.`,
    "A slice drops the rest of the record, the failure is often in the part that was dropped, and re-running with a filter pays the cost twice while missing non-deterministic failures.",
    "",
    "Read the whole record instead:",
    "- output of a command: record it with `spool -- <command>`, then open the log file the summary points to with the Read tool. Where `spool` is not on PATH, `vp exec spool -- <command>` reaches it",
    "- a file already on disk: open it with the Read tool, which takes offset and limit",
    "- a record still being written: read it again with the Read tool, which sees whatever has been written so far",
  ].join("\n");
