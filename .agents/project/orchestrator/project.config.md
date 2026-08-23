# Project config — FactoryMate

> Lives under `.agents/project/` — safe from `npx skills update` wiping skill directories.

## Repository

| Field | Value |
| ----- | ----- |
| Project name | FactoryMate |
| Repo URL | https://github.com/ghotso/factorymate |
| Repo path | /home/michael/projects/factorymate |
| Integration branch | `main` |
| Plan file | `docs/factorymate-roadmap.md` |
| Spec doc | `docs/factorymate-spec.md` |
| FRM docs (reference) | `docs/frm-docs/` |

## Milestone IDs

Roadmap milestones: `M0` … `M13` (autonomous loop). **M14** is deferred backlog — no checkboxes, not dispatched.

Commit subject pattern: `feat(M3): implement fast-poll diff engine` (conventional commits + milestone ref).

## Live vs fixture testing

See `docs/testing.md`. Summary for verifiers:

| Dependency | CI / autonomous PASS | Opt-in live |
| --- | --- | --- |
| Discord webhook | Go `httptest` mock server | `DISCORD_TEST_WEBHOOK_URL` |
| FRM API | JSON fixtures in `backend/testdata/frm/`; **live read-only** `http://192.168.178.42:8889` (rule: `.cursor/rules/04-frm-live.mdc`) | `go test -tags=integration` when `FRM_TEST_HOST` set |
| GuggiRaid deploy | `docker compose build` | Human smoke test at M13 DoD |

## Milestone scopes

Per-milestone READ/WRITE paths and scoped CI: `.agents/project/orchestrator/milestone-scopes.md`

Verifier checklist: `.agents/project/orchestrator/verifier-checklist.md`

## Checkbox authority

**Verifier only** marks roadmap checkboxes on PASS (`- [x]`) or FAIL (`- [!] failed — <reason>`). Granularity: **all task checkboxes under the milestone section** (not milestone-level summary only). Orchestrator does not edit checkboxes during execution.

## Verification commands

| Scope | Command |
| ----- | ------- |
| Backend (all) | `cd backend && go test ./... && go vet ./...` |
| Backend (package) | `cd backend && go test ./internal/poller/...` |
| Frontend (all) | `cd frontend && npm run lint && npm run build` |

Scoped gate: run tests for packages touched in WRITE SCOPE only.

## Optional

| Field | Value |
| ----- | ----- |
| Slack session-end | not configured |
| GitHub issues | `gh issue view <N>` — orchestrator issue mode (`/orchestrator #<N>`); roadmap checkboxes unchanged |

### Issue status labels (`status:*`)

| Label | Set by |
| ----- | ------ |
| `status:backlog` | Human / GHA `issue-status.yml` on `issues.opened` (when no `status:*` yet) |
| `status:ready` | Triage — orchestrator expects this at pickup |
| `status:in-progress` | Execution agent (first action) or verifier on FAIL |
| `status:in-review` | Execution agent (before handoff) |
| `status:nightly` | Verifier on PASS |
| `status:done` | GHA `issue-status.yml` on `issues.closed` when `state_reason` is `completed` |

Close-outcome labels (not `status:*`): `duplicate` and `wontfix` — set by GHA on close per `state_reason`; already exist on the repo.

All six labels exist on `ghotso/factorymate`. **Invariant: exactly one `status:*` per issue** — always remove the current `status:*` before adding the next; never stack multiple.
