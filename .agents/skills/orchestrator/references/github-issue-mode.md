# GitHub issue mode — orchestrator reference

Use when the user invokes the orchestrator with a GitHub issue number (e.g. `/orchestrator #5`, `orchestrate issue 5`).

## Detection

Treat as **issue mode** when the message includes orchestrator intent **and** any of:

- `#<number>` — e.g. `#5`, `/orchestrator #5`
- `issue <number>` / `issue #<number>`
- `gh-<number>` (optional alias)

If both a milestone (`M3`) and an issue (`#5`) appear, **issue mode wins** — implement the issue, not the roadmap milestone.

## Fetch issue context (orchestrator only)

From repo root (`/home/michael/projects/factorymate`). Requires `gh` authenticated for `https://github.com/ghotso/factorymate`.

```bash
gh issue view <N> --json title,body,state,labels,url,comments
```

For a human-readable bundle (preferred for planning):

```bash
gh issue view <N> --comments
```

The orchestrator **may** run these commands. Sub-agents receive a **summary** of title, state, labels, body, and every comment (author + body) in their prompt — do not re-fetch unless execution needs a refresh after a long stall.

### Interpreting comments

| Source | Weight |
| ------ | ------ |
| Issue body (description) | Primary acceptance criteria |
| Human comments (`author` ≠ bots) | Clarifications and scope changes — **latest human direction wins** on conflict |
| `coderabbitai`, `github-actions`, dependabot, etc. | Context only — not authoritative requirements unless a human explicitly agrees |

If the issue is **closed**, present a warning in the plan and proceed only if the user did not say `plan only` / `wait`.

## Status labels (`status:*`)

### Invariant — read this first

> **Each issue may have at most one `status:*` label. Never two. Never stack.**
>
> When changing status: **remove the current `status:*` label, then add the new one.** If you only `--add-label` without `--remove-label`, you violate this rule.
>
> Applies to **triage**, **orchestrator execution**, and **verifier** agents equally.

Six workflow labels exist. Only one may be on an issue at any time:

| Label | Meaning |
| ----- | ------- |
| `status:backlog` | Not scheduled |
| `status:ready` | Ready for orchestrator pickup |
| `status:in-progress` | Execution agent working |
| `status:in-review` | Implementation done; verifier pending |
| `status:nightly` | Verified; eligible for nightly / integration |
| `status:done` | Shipped — GHA sets on close when `state_reason` is `completed` |

**Close-outcome labels** (not `status:*` — use existing repo labels):

| Label | When |
| ----- | ---- |
| `duplicate` | GHA sets on close when `state_reason` is `duplicate` |
| `wontfix` | GHA sets on close when `state_reason` is `not_planned` |

### Lifecycle

```text
status:ready          ← orchestrator picks up (expect this label; warn if missing)
    ↓ execution agent FIRST action (before any code)
status:in-progress
    ↓ execution agent LAST action (before handoff)
status:in-review
    ↓ verifier result
status:nightly        PASS
status:in-progress    FAIL (re-dispatch execution)
```

### `gh` commands

Swap labels (replace `<N>` and the `--remove-label` with the **current** status):

```bash
# Execution agent — before starting work
gh issue edit <N> --remove-label "status:ready" --add-label "status:in-progress"

# Execution agent — before handoff to verifier
gh issue edit <N> --remove-label "status:in-progress" --add-label "status:in-review"

# Verifier — PASS
gh issue edit <N> --remove-label "status:in-review" --add-label "status:nightly"

# Verifier — FAIL
gh issue edit <N> --remove-label "status:in-review" --add-label "status:in-progress"
```

If the current `status:*` label differs (e.g. re-dispatch after FAIL), remove **all** `status:*` labels present before adding the target — an issue must never carry more than one.

Orchestrator: on pickup, confirm issue has exactly one `status:ready` label (warn if missing or if multiple `status:*` labels are present). Orchestrator does **not** change labels itself. Triage sets `status:ready` after posting a comment or creating an issue — see `.cursor/skills/github-triage/SKILL.md`. GHA `issue-status.yml`: `status:backlog` on open (no prior `status:*`); on close clears `status:*` then sets `status:done` (`completed`), `duplicate`, or `wontfix` per `state_reason`.

Execution and verifier agents **must** run the appropriate `gh issue edit` command; label sync is part of the handoff gate (same priority as scoped CI).

## Issue plan format

```markdown
## Orchestrator plan — GitHub issue #<N>

**Issue:** <title>
**State:** open | closed
**URL:** <github url>
**Labels:** bug, status:ready, …
**Status:** expect `status:ready` at pickup (warn if different)

**Summary:** <1–3 sentences of what to implement>

**Acceptance (derived):**
- <bullet from issue body / human comments>
- …

**Likely areas:** <backend/frontend paths or packages — best-effort from issue text; execution agent confirms>

**Spec refs:** <spec § sections if inferable from doc-index; else "execution agent to identify">

→ Dispatching execution agent…
```

Skip the roadmap batch plan in issue mode. Do **not** advance the M0–M13 loop unless the user asks to return to roadmap mode after the issue is done.

## Scope

Issue mode has no `milestone-scopes.md` entry. Execution agent must:

1. Read `docs/factorymate-spec.md` sections relevant to the issue
2. Use `explore` or targeted reads to find the minimal WRITE scope
3. State confirmed READ/WRITE scope in the handoff report

Verifier checks committed paths are **reasonable for the issue** (minimal fix/feature, no drive-by refactors).

## Commits

No milestone ref required. Use conventional commits and **GitHub issue linking** so the issue auto-closes when the commit lands on `main` (squash-merge included).

**Required when working a GitHub issue `#<N>`:**

```text
fix: dedupe lizard doggo entries

Fixes #5
```

- **Subject:** `<type>: <imperative summary>` (`fix`, `feat`, `chore`, …)
- **Body:** must include `Fixes #<N>` (or `fixes` / `Closes` / `Resolves` — GitHub keyword + `#<N>`). This is what triggers auto-close on merge to default branch.

Do **not** rely on `(#5)` in the subject alone — always put `Fixes #<N>` in the commit body.

Verifier (issue mode): FAIL if the commit lacks a recognized linking keyword for `#<N>`.

## Verifier (issue mode)

- **No** `docs/factorymate-roadmap.md` checkbox edits
- Same three-layer verification against **issue acceptance** + spec contract
- **Status labels:** PASS → `status:nightly`; FAIL → `status:in-progress` (see Status labels above)
- PASS: report summary; issue auto-closes when the commit (`Fixes #<N>` in body) merges to `main` — do **not** manually close or push unless user asked
- FAIL: re-dispatch execution with fix hints

## Anti-patterns

- Ignoring human comments in favor of the original issue body when they conflict
- Implementing a roadmap milestone instead of the cited issue
- Editing roadmap checkboxes after issue-mode PASS
- Pasting the entire issue thread without a derived acceptance bullet list
- Skipping `status:*` label updates at execution or verifier handoff
- Leaving multiple `status:*` labels on an issue (exactly one allowed — remove before add)
- Stacking `status:*` labels by adding without removing the current one
