# Prompt templates — FactoryMate orchestrator

> Copy blocks **verbatim** into sub-agent prompts. Fill `<placeholders>` per milestone.

## Execution prompt assembly

1. **Header** — SESSION-ID, MILESTONE, READ/WRITE scope (absolute paths)
2. **DOC REFERENCES** — paths + `spec §X` only (no pasted spec bodies)
3. **ACCEPTANCE** — verbatim from roadmap DoD + milestone tasks
4. **SCOPED CI GATE**
5. **HANDOFF** — commit message format

## Verifier prompt assembly

1. Same header + AC + DOC REFERENCES
2. **Three-layer verification** checklist
3. **SCOPED CI GATE**
4. On PASS: mark **all** task checkboxes under this milestone `- [x]` in roadmap; report PASS summary
5. On FAIL: mark them `- [!] failed — <reason>`; report FAIL with fix hints for re-dispatch

**Issue mode:** use ISSUE VERIFIER below — no roadmap checkbox edits.

See `.agents/project/orchestrator/verifier-checklist.md` for the full checklist (roadmap mode).

---

## EXECUTION — template block

```text
SESSION-ID: <MILESTONE>-<YYYYMMDD>-<4hex>
MILESTONE: <M0–M14 title from roadmap>
LANE: S (serial on integration branch: main)

ACCEPTANCE (from roadmap DoD + tasks):
<paste milestone checkbox tasks and DoD bullets verbatim>

DOC REFERENCES (read yourself — do not expect pasted content):
- docs/factorymate-roadmap.md — <MILESTONE>
- docs/factorymate-spec.md — <list spec § sections from doc-index.md>
- .agents/project/orchestrator/doc-index.md

READ SCOPE:
- docs/factorymate-spec.md (reference only unless AC requires doc edit)
- <read paths for dependencies only>

WRITE SCOPE:
- <absolute paths for this milestone only>

FORBIDDEN:
- Work outside WRITE SCOPE
- Starting the next milestone
- git push (unless user explicitly asked)
- Editing roadmap checkboxes (verifier only)

SCOPED CI GATE (run before commit):
<from project.config.md — scoped to WRITE SCOPE packages>
Example:
  cd backend && go test ./internal/poller/...
  cd backend && go vet ./internal/poller/...

HANDOFF:
- One commit: <type>(<MILESTONE>): <imperative summary>
  Example: feat(M3): implement fast-poll diff engine
- Report: changed files, test output, any spec ambiguities
```

---

## VERIFIER — template block

```text
SESSION-ID: <same as execution>
MILESTONE: <M0–M14>
LANE: S

ACCEPTANCE: <same verbatim AC as execution>

READ SCOPE:
- Same as execution WRITE SCOPE (verify committed diff)
- docs/factorymate-roadmap.md — milestone section only

WRITE SCOPE:
- docs/factorymate-roadmap.md — on PASS/FAIL, update **all** task checkboxes under this milestone section (`- [ ]` → `- [x]` or `- [!] failed — <reason>`)

SCOPED CI GATE: <same scoped commands as execution>

THREE-LAYER VERIFICATION:

Layer 1 — Scope audit: committed paths ⊆ execution WRITE SCOPE (+ roadmap checkbox on PASS only).

Layer 2 — Scoped automated checks from project.config.md. Mark n/a only if no code changed.

Layer 3 — Logic review:
  3a. Each acceptance criterion / DoD bullet met?
  3b. Spec contract deviations with file:line + fix hint (spec § refs)
  3c. Frontend milestones (M0/M10–M12): no hardcoded user-facing UI strings — all via `messages/en.json` per spec §8.2 and `.cursor/rules/03-i18n.mdc`
  3d. Migrations: numbered .sql only — hand-written SQL outside migrations → FAIL

RESULT:
- PASS → set **all** task checkboxes under this milestone to `- [x]` in roadmap; report PASS summary
- FAIL → set them to `- [!] failed — <reason>`; report FAIL with fix hints for re-dispatch
```

---

## SCOPED CI GATE — backend

```text
SCOPED CI GATE:
Before commit, from repo root:
  cd backend && go vet ./<package>/...
  cd backend && go test ./<package>/...
Replace <package> with paths under WRITE SCOPE (e.g. internal/poller).
If WRITE SCOPE includes multiple packages, test each.
If only docs changed, gate is n/a — state n/a in report.
```

## SCOPED CI GATE — frontend

```text
SCOPED CI GATE:
  cd frontend && npm run lint
  cd frontend && npm run build
Run only when frontend/ is in WRITE SCOPE.
```

## SCOPED CI GATE — full stack milestone

```text
SCOPED CI GATE:
  cd backend && go test ./... && go vet ./...
  cd frontend && npm run lint && npm run build
```

---

## ISSUE EXECUTION — template block

```text
SESSION-ID: ISSUE-<N>-<YYYYMMDD>-<4hex>
GITHUB ISSUE: #<N> — <title>
LANE: S (serial on integration branch: main)
ISSUE URL: <github issue url>

STATUS LABEL GATE (mandatory — run via gh before any other work):
  INVARIANT: exactly one status:* label per issue — remove ALL status:* before adding the new one.
  First dispatch:  gh issue edit <N> --remove-label "status:ready" --add-label "status:in-progress"
  Re-dispatch after verifier FAIL (already status:in-progress): confirm exactly one status:in-progress — if multiple status:* labels exist, remove all then add status:in-progress
  If multiple status:* labels at start: remove status:backlog, status:ready, status:in-progress, status:in-review, status:nightly, status:done — then add status:in-progress

ACCEPTANCE (derived from issue body + human comments — orchestrator summary):
<paste derived acceptance bullets verbatim>

ISSUE CONTEXT (for implementation — body + comments summarized by orchestrator):
<summary of issue description>
<human comments with author attribution; note latest human direction on conflicts>

DOC REFERENCES (read yourself — do not expect pasted spec content):
- docs/factorymate-spec.md — <relevant § sections; identify from doc-index if not listed>
- .agents/project/orchestrator/doc-index.md
- <any other paths implied by the issue>

READ SCOPE:
- docs/factorymate-spec.md (sections relevant to this issue)
- Codebase paths needed to understand the bug/feature (explore first)

WRITE SCOPE:
- Minimal paths required to implement acceptance criteria
- State confirmed WRITE scope in handoff report

FORBIDDEN:
- Scope creep beyond issue acceptance
- Drive-by refactors unrelated to #<N>
- git push (unless user explicitly asked)
- Editing docs/factorymate-roadmap.md checkboxes

SCOPED CI GATE (run before commit):
<scoped to confirmed WRITE SCOPE packages — same patterns as milestone gates>

STATUS LABEL GATE (mandatory — run via gh immediately before handoff, after commit):
  INVARIANT: exactly one status:* per issue — remove status:in-progress, then add status:in-review
  gh issue edit <N> --remove-label "status:in-progress" --add-label "status:in-review"

HANDOFF:
- One commit (issue mode — two-part message):
    Subject: <type>: <imperative summary>
    Body:  Fixes #<N>
  Examples:
    Subject: fix: dedupe lizard doggo entries
    Body:  Fixes #5
  Roadmap example: feat(M3): implement fast-poll diff engine
- Report: confirmed WRITE scope, changed files, test output, spec ambiguities, whether issue is fully resolved
```

---

## ISSUE VERIFIER — template block

```text
SESSION-ID: <same as execution>
GITHUB ISSUE: #<N> — <title>
LANE: S

ACCEPTANCE: <same derived acceptance as execution>

READ SCOPE:
- Execution handoff WRITE scope (verify committed diff)
- docs/factorymate-spec.md — sections cited by execution

WRITE SCOPE:
- None for code — verifier is read-only except GitHub issue labels (via gh)

FORBIDDEN:
- Editing docs/factorymate-roadmap.md
- Closing the GitHub issue or pushing (unless user explicitly asked)
- Finishing without updating status:* label per result below

SCOPED CI GATE: <same scoped commands as execution>

THREE-LAYER VERIFICATION:

Layer 1 — Scope audit: committed paths ⊆ reasonable minimal scope for issue #<N>; no unrelated files.

Layer 2 — Scoped automated checks from project.config.md. Mark n/a only if no code changed.

Layer 3 — Logic review:
  3a. Each acceptance bullet for #<N> met?
  3b. Spec contract deviations with file:line + fix hint (spec § refs)
  3c. Frontend changes: no hardcoded user-facing UI strings — `messages/en.json` per spec §8.2
  3d. Migrations: numbered .sql only — hand-written SQL outside migrations → FAIL
  3e. Commit message includes `Fixes #<N>` (or Closes/Resolves) in the body for GitHub auto-close on main

RESULT:
- PASS → INVARIANT: remove status:in-review, add status:nightly (never stack status:*)
         gh issue edit <N> --remove-label "status:in-review" --add-label "status:nightly"
         → report PASS summary; confirm commit body contains `Fixes #<N>`
- FAIL → INVARIANT: remove status:in-review, add status:in-progress (never stack status:*)
         gh issue edit <N> --remove-label "status:in-review" --add-label "status:in-progress"
         → report FAIL with fix hints for re-dispatch (do not edit roadmap)
```
