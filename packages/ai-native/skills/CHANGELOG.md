# @mst/ai-native

What each published version changes for the packages that install it, and for the agents that load the skills shipped beside this file.

## 0.0.0

- `throttle` caps how many wrapped commands run at once per host and namespace, reclaims slots held by processes that died, and can kill a command's whole process group on a timeout. Preparing the slots discards anything left at a lock's path that is not the directory the lock library creates, so a slot directory polluted by something else does not block every later run.
- `spool` diverts a child's merged output into a log file under `.spool/` and prints a fixed-size summary in its place, passing the child's exit code through. In CI it streams the output instead and writes no file.
- `unabridged` is a Bash `PreToolUse` hook that rejects `head` and `tail` at command positions and names the complete-output alternative.
