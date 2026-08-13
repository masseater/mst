# @mst/stop-ai-slop

What each published version changes for the packages that install it, and for the agents that load the skills shipped beside this file.

## 0.0.0

- A `check` CLI that compares the change on its way into the integration branch and reports every absence assertion added by the same change that deleted its subject. Read on its own such an assertion is indistinguishable from an ordinary negative one, so the check reads the change rather than the file.
