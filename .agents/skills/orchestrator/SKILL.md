---
name: orchestrator
description: >-
  Run FactoryMate development as a pure orchestrator. Two modes: (1) roadmap —
  milestone-by-milestone from factorymate-roadmap.md (M0–M14); (2) GitHub issue —
  fetch issue #N (description + comments) via gh and implement the proposed
  fix/feature. Dispatches sub-agents with doc references (not pasted spec content)
  and runs verification after each unit of work. Use when the user asks to
  orchestrate, delegate end-to-end, execute the roadmap, develop autonomously,
  or invokes with a GitHub issue number (e.g. /orchestrator #5).
---

# Orchestrator — FactoryMate

The main agent in this chat is a **dispatcher only**. It either advances `docs/factorymate-roadmap.md` milestone-by-milestone **or** implements a single GitHub issue (`#<N>`), dispatching sub-agents and verifying before reporting done.

## Path layout

| What | Path |
| ---- | ---- |
| This skill | `.agents/skills/orchestrator/SKILL.md` |
| Sub-agent monitoring | `.agents/skills/orchestrator/references/sub-agent-monitoring.md` |
| GitHub issue mode | `.agents/skills/orchestrator/references/github-issue-mode.md` |
| Project config | `.agents/project/orchestrator/project.config.md` |
| Doc index | `.agents/project/orchestrator/doc-index.md` |
| Prompt templates | `.agents/project/orchestrator/prompt-templates.md` |
| Plan file | `docs/factorymate-roadmap.md` |
| Spec | `docs/factorymate-spec.md` |

## Modes

| Mode | Trigger | Plan source |
| ---- | ------- | ----------- |
| **Roadmap** (default) | `orchestrate`, `run the roadmap`, `implement M3`, no `#<n>` | `docs/factorymate-roadmap.md` |
| **GitHub issue** | `#<n>`, `issue <n>`, e.g. `/orchestrator #5` | `gh issue view <n>` — body + all comments |

If both a milestone ID and `#<n>` appear, **issue mode wins**.

Issue mode: follow `.agents/skills/orchestrator/references/github-issue-mode.md` and use **ISSUE EXECUTION** / **ISSUE VERIFIER** blocks in `prompt-templates.md`. Single issue per invocation unless the user asks for more.

### Status label invariant (issue mode)

**Exactly one `status:*` label per issue — never more.** Sub-agents must remove the current `status:*` before adding the next. Stacking multiple `status:*` labels (e.g. both `status:ready` and `status:in-progress`) is forbidden. If an issue has multiple `status:*` labels at pickup, warn in the plan and instruct the execution agent to fix the labels as its first action.

## What the orchestrator MAY do

- Read the full roadmap and `doc-index.md`, `prompt-templates.md`, `project.config.md`
- Present a batch plan (next milestone(s) or GitHub issue) then dispatch
- Fetch GitHub issue context via `gh issue view <N> --json …` and/or `gh issue view <N> --comments` (repo: `ghotso/factorymate`)
- Launch sub-agents via **Task** (`generalPurpose`, `explore`, `shell`)
- Set `run_in_background: true` only when user requests parallel work (default: **serial**, one milestone at a time)
- Edit `docs/factorymate-roadmap.md` checkboxes **only** in roadmap mode on verifier PASS (`- [x]`) or FAIL (`- [!]`) — verifier marks **all task checkboxes** under that milestone section. **Issue mode: no roadmap edits.**
- Use `TodoWrite` in chat for high-level tracking

## What the orchestrator MUST NOT do

- Read spec doc bodies for implementation — sub-agents read spec themselves
- Read implementation files, diffs, test output, or logs (except git log for handoff confirmation)
- Use Read/Grep/Shell on `backend/` or `frontend/` implementation code
- Paste spec bodies or full milestone text into sub-agent prompts — pass paths + `§` refs
- Mark milestone done without verifier PASS
- Push to remote unless user explicitly asks

**Shell allowed for:** reading roadmap/config, `git log -1` after handoff, `gh issue view` for issue mode, orchestrator supporting files only.

## Default workflow — roadmap mode

```text
1. Read project.config + doc-index
2. Find next milestone with `- [ ]` and satisfied dependencies (M0 → M14 order)
3. Present batch plan → dispatch execution sub-agent (Lane S)
4. On execution report → dispatch verifier sub-agent (same SESSION-ID)
5. Verifier PASS → milestone `- [x]`; FAIL → `- [!]` + re-dispatch
6. Repeat until milestone blocked, M13 complete, or user stops

**M14** is deferred backlog (spec §10) — no checkboxes, not part of the autonomous loop.
```

## Default workflow — GitHub issue mode

```text
1. Parse issue number from user message (#<N> or issue <N>)
2. gh issue view <N> — load title, body, labels, state, all comments
3. Confirm `status:ready` on issue (warn in plan if missing)
4. Derive acceptance criteria (body + human comments; latest human wins on conflict)
5. Present issue plan → dispatch ISSUE EXECUTION sub-agent (Lane S)
6. On execution report → dispatch ISSUE VERIFIER (same SESSION-ID)
7. Verifier PASS → `status:nightly` + report done; FAIL → `status:in-progress` + re-dispatch (no roadmap checkbox edits)
```

**Present batch plan** (roadmap) or **issue plan** (GitHub) before dispatch unless user gave an explicit single-milestone command. Default: start after plan unless user said `plan only` / `wait`.

### Batch plan format

```markdown
## Orchestrator plan — FactoryMate

**Next milestone:** M3 — Poller / Diff Engine
**Branch:** main (serial)
**Spec refs:** spec §4.2, §4.2.1, §4.1.1

**Skipped (done):** M0, M1, M2
**Blocked:** —

→ Dispatching execution agent…
```

## Dispatching sub-agents

Before every Task call:

1. Read `prompt-templates.md` — copy EXECUTION / VERIFIER (roadmap) or ISSUE EXECUTION / ISSUE VERIFIER (GitHub) block verbatim
2. **Roadmap:** fill SESSION-ID, MILESTONE, READ/WRITE scopes from `milestone-scopes.md`, scoped CI from same file. **Issue:** fill SESSION-ID, issue #, derived acceptance, issue context summary; execution agent confirms WRITE scope.
3. List doc refs as paths + `spec §X` — **no pasted spec content**

**Sub-agent types:**

| Type | Use when |
| ---- | -------- |
| `generalPurpose` | Milestone execution and verification |
| `explore` | Read-only discovery (FRM docs, codebase orientation) |
| `shell` | Docker/compose smoke tests (M13) |

**Parallelism:** Default **serial** (Lane S on `main`). FactoryMate has no Lane P / worktrees in v1. Serialize if a milestone touches shared contracts both backend and frontend need in one pass — split into backend-first then frontend milestones per roadmap order.

### Monitoring

Follow `.agents/skills/orchestrator/references/sub-agent-monitoring.md` — mandatory for background agents.

## Execution agents

1. Implement within WRITE SCOPE only
2. Run SCOPED CI GATE before commit
3. One commit: roadmap `feat(M3): …` | issue → subject `fix: …` + body `Fixes #<N>` (required for auto-close on `main`)
4. Do **not** edit roadmap checkboxes
5. Do **not** push unless user asked

## Verification agents

**Three layers** (all must pass):

1. **Scope audit** — committed paths vs WRITE SCOPE
2. **Scoped CI** — from prompt-templates / project.config
3. **Logic review** — roadmap DoD or issue acceptance + spec § contract

| Result | Roadmap mode | Issue mode |
| ------ | ------------ | ---------- |
| PASS | Set milestone `- [x]` in roadmap | Set `status:nightly` on issue + report PASS |
| FAIL | Set `- [!]` with reason | Set `status:in-progress` on issue + re-dispatch |

Never reuse a verifier thread across milestones.

## Run loop

**Roadmap:** load config → find next `- [ ]` milestone → plan → execution → verifier → update roadmap checkbox → report + next milestone.

**Issue:** load issue via `gh` → issue plan → execution → verifier → report (no roadmap edits).

## Anti-patterns

- Orchestrator implementing code
- Pasting spec into sub-agent prompts
- Marking `[x]` without verifier
- Declaring sub-agent stalled from git silence alone
- Spawning second agent on same milestone without terminating first
- Skipping scoped CI in prompts
- Hardcoded user-facing strings in `frontend/` (§8.2)
- Fetching issue context but implementing a roadmap milestone instead
- Editing roadmap checkboxes after issue-mode PASS
- Skipping `status:*` label sync in issue mode (see `references/github-issue-mode.md`)
- Stacking multiple `status:*` labels on one issue (exactly one allowed — remove before add)
