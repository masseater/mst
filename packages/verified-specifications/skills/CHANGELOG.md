# @mst/verified-specifications

What each published version changes for the packages that install it, and for the agents that load the skills shipped beside this file.

## 0.0.0

- A `check` CLI that reads the specification tests of every workspace and generates `SPECIFICATIONS.md` from the claims they declare, so a human reads what the tests actually verify rather than what a document says they do.
- `--write` regenerates those documents; without it the command reports the drift and fails.
