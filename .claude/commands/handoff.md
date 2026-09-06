---
description: Write or resume a session handoff for this project (ck-fast / GarmentTrack)
argument-hint: (optional) note to include, e.g. "blocked on payment gateway choice"
---

You are managing continuity across Claude Code sessions for this project. This project is
`ck-fast`: an npm-workspaces monorepo (`apps/api` Express+Prisma+Postgres, `apps/web`
React+Vite+Tailwind, `packages/types`, `packages/shared`) scaffolded from the `erp-boilerplate`
skill, now being extended into **GarmentTrack** — a garment production management app for client
"Keshav Trading & Co", built screen-by-screen from a 16-screen UI mockup the client supplied.

The handoff file lives at `HANDOFF.md` in the repo root. There is only ever one — you overwrite
it each time, you never append or keep old versions.

## Step 1 — decide which mode you're in

Look at how much real conversation history exists in this session:

- **Write mode** — this session has done substantive work (built/changed code, made decisions,
  hit issues) and either the user just ran `/handoff` to close out, or context is about to be
  compacted. Go to Step 2.
- **Resume mode** — this session is fresh (just started, little or no prior turns) and
  `HANDOFF.md` already exists. Go to Step 3.
- If `HANDOFF.md` doesn't exist and this session is also fresh, say so plainly and ask what the
  user wants to work on — there's nothing to resume from.

## Step 2 — Write mode: produce the handoff

Overwrite `HANDOFF.md` with a document covering, in this order:

1. **Snapshot date/time** and a one-line status ("Karigar Master shipped, starting Daily
   Production Entry next").
2. **What's done** — screens/modules completed so far, referencing the mockup's screen numbers
   where relevant (e.g. "Screens 3–4: Karigar Master — done"). Be concrete: which files, which
   API routes, which Prisma models. Don't just say "users module" — name the actual paths.
3. **What's next** — the remaining screens/modules in priority order, based on what the user has
   said or the natural build order of the mockup. Call out anything the user explicitly asked to
   defer or reconsider.
4. **Conventions established** — anything a fresh session would otherwise have to rediscover by
   reading code: the 5-file backend module pattern (schema/repository/service/controller/routes)
   and its registration checklist (rbac.ts → modules.ts → seed → routes/index.ts →
   module-routes.tsx), reusable frontend components that exist and should be reused rather than
   rebuilt (check `apps/web/src/components/ui/` and `apps/web/src/components/common/` for the
   current list — e.g. Pagination, PhotoUpload, Dialog, ActionMenu, ConfirmDialog), the
   NumberSequence-based code-generator pattern, the generic `/uploads` endpoint.
5. **Environment** — how to run it (dev server commands, ports actually in use — check with
   `netstat`/`curl` rather than assuming), seeded admin credentials (from `apps/api/.env`,
   without ever inventing a fresh password), local Postgres connection details.
6. **Known issues / gotchas** — anything that cost time this session and will cost time again if
   forgotten (e.g. `npx prisma generate` can hit an `EPERM` lock on Windows if a `tsx watch`
   process is holding the query engine DLL open — usually resolves on retry once that process
   restarts).
7. **Open questions** — anything the user hasn't decided yet that the next session should ask
   about before proceeding, rather than guessing.

If the user passed an argument to this command, fold it in as a specific note (e.g. under "Open
questions" or "What's next") rather than ignoring it.

Base this on what actually happened in the conversation and the actual current state of the repo
(read files / check git-less directory listings / query the running servers as needed) — never
fabricate progress that didn't happen. Keep it dense and skimmable: short bullets, real paths,
no filler.

After writing it, tell the user in one or two sentences that it's saved and that starting a new
session and running `/handoff` there will resume from it.

## Step 3 — Resume mode: read the handoff back

Read `HANDOFF.md` in full. Then:

1. Summarize it back to the user in a short recap (status, what's done, what's next) so they can
   confirm it's still accurate before you act on it.
2. Treat its "what's next" section as the working plan unless the user redirects you.
3. Spot-check anything time-sensitive before relying on it — e.g. if it claims dev servers are
   running on specific ports, verify with a quick health check rather than assuming they're still
   up; if it references files, confirm they still exist as described. Note anything that's gone
   stale rather than silently trusting it.
4. Do not rewrite `HANDOFF.md` in this mode — it stays as the last write-mode snapshot until the
   next `/handoff` write.
