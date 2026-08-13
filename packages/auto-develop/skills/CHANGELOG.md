# @mst/auto-develop

What each published version changes for the packages that install it, and for
the agents that load the skills shipped beside this file.

## 0.0.0

- A relay server that receives GitHub webhooks and hands them to the reviewer
  and author runtimes over SSE.
- A lane-exclusive job queue that keeps one response in flight per pull
  request.
- A tmux engine runner that launches an agent CLI inside a per-PR git worktree.
