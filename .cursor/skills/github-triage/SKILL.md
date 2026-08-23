---
name: github-triage
description: >-
  Triage GitHub issues with sub-agents: with an issue number, draft an
  investigation comment; with no number, draft a new issue title and body.
  Does not apply a fix, post, or create until the user approves. Use when the
  user runs /github-triage or asks to triage or file a GitHub issue.
disable-model-invocation: true
---

# GitHub triage

Use this skill when the user runs `/github-triage`.

Two modes:

| Prompt has an issue number? | Do this |
| --- | --- |
| Yes | Fetch that issue, investigate, **propose a comment**. Do not post until approved. |
| No | Investigate from the user's description, **propose a new issue title and body**. Do not create until approved. |

Do **not** apply a fix in either mode.

## Hard rules

- **No code changes.** Do not edit, patch, or commit anything while this skill is running.
- **No GitHub write until approval.** Do not post a comment or create an issue until the user explicitly confirms the draft (or supplies an edited version).
- **Investigation is sub-agents only.** The parent agent must not search, read, or grep the codebase to diagnose the issue. Fetching GitHub data, launching sub-agents, and drafting from their reports are the only parent-side jobs.
- If the user also asks to fix, post, or create immediately, still follow this skill: investigate → draft → wait.

## Workflow

### 1. Choose mode

From the user prompt, extract an issue number if present:

| Input | Parse as |
| --- | --- |
| `/github-triage 42` | **Existing issue** `42` in the current repo |
| `/github-triage #42` | same |
| `https://github.com/owner/repo/issues/42` | **Existing issue** `42` in `owner/repo` |
| `/github-triage owner/repo#42` | **Existing issue** `42` in `owner/repo` |
| `/github-triage` plus a bug/feature description, no number | **New issue** |
| `/github-triage` alone (no number, no description) | Ask what to file or which issue number to investigate, then stop |

If `owner/repo` is not in the prompt, resolve the current GitHub repo (`gh repo view --json nameWithOwner` or git remote). If that fails, ask.

Then follow **Existing issue** or **New issue** below.

## Existing issue

```
- [ ] Fetch issue via GitHub MCP or gh CLI
- [ ] Dispatch investigation sub-agents (parent does not investigate)
- [ ] Draft comment from sub-agent reports
- [ ] Show draft; wait for user verification
- [ ] Post only after explicit approval
```

### Fetch the issue

Use **GitHub MCP if it is available**, otherwise **gh CLI**. Discover MCP with `GetDynamicTools` pattern `github` (or inspect a GitHub namespace). Read the tool schema before calling. Typical needs: issue metadata, body, labels, and comments.

**gh CLI fallback** (from repo root, or with `-R owner/repo`):

```bash
gh issue view {N} --json number,title,body,state,author,labels,assignees,url,createdAt,updatedAt,comments
```

If JSON bodies look truncated in the terminal, write to a file and **Read** the file:

```bash
gh issue view {N} --json number,title,body,state,author,labels,assignees,url,createdAt,updatedAt,comments > /tmp/github-triage-{N}.json
```

Also fetch comment thread if the JSON `comments` field is incomplete:

```bash
gh api repos/{owner}/{repo}/issues/{N}/comments --paginate
```

If the issue is missing, private, or the tool fails, stop and report the error. Do not invent issue text.

### Investigate with sub-agents only

The parent **must not** use Grep, Glob, Read, or Shell to explore the codebase for the bug.

Launch **at least two** sub-agents in **parallel** via the Task tool. Prefer `explore` for location/search; use `generalPurpose` when the hypothesis needs multi-step reasoning. Give each sub-agent the **full issue title, body, and relevant comments** (not a vague summary).

Suggested split:

1. **Locate** — which files, symbols, routes, and tests match the report.
2. **Root cause** — data flow, likely defect, and what would confirm or refute it.

Add a third agent when the issue spans frontend + backend, or tests vs implementation.

Each sub-agent prompt **must** include:

```text
You are investigating GitHub issue #{N}: {title}
Repo: {owner/repo}

ISSUE BODY:
{verbatim body}

RELEVANT COMMENTS:
{verbatim relevant comments}

TASK:
Investigate the codebase against this issue. Report findings only.

FORBIDDEN:
- Do not apply a fix
- Do not edit files
- Do not commit, push, or open a PR
- Do not post on GitHub

RETURN:
- Relevant files and symbols (paths)
- Likely root cause (or competing hypotheses)
- How to reproduce or what evidence is missing
- Suggested next steps (fix approach only — do not implement)
- Confidence: high / medium / low
```

Wait for sub-agents to finish. If they conflict, keep both hypotheses in the draft; do not re-investigate in the parent.

### Draft the comment

Write the GitHub comment from **sub-agent reports only**. Structure:

See [comment-template.md](comment-template.md).

The draft is investigation, not a promise to fix. Do not claim you reproduced a runtime bug unless a sub-agent actually did.

### Show the draft — do not post

Present:

1. A short parent-side recap (issue title, state, what the agents agreed on).
2. The **exact** comment in a markdown code block so the user can review wording.
3. A clear ask: approve as-is, request edits, or abort.

Do not call GitHub comment APIs or `gh issue comment` in this step.

### Post after verification

Post **only** when the user clearly approves (e.g. "looks good", "post it", "send that"). If they edited the text, post **their** version.

GitHub MCP: use the add-comment tool after reading its schema.

gh CLI:

```bash
gh issue comment {N} -R {owner/repo} --body-file /tmp/github-triage-{N}-comment.md
```

Write the approved body to that file first. Do not pass a long body on the shell command line.

After posting, give the issue URL. Still do not apply a fix unless the user starts a new request for that.

## New issue

```
- [ ] Treat the user prompt as the problem statement (no GitHub fetch)
- [ ] Dispatch investigation sub-agents (parent does not investigate)
- [ ] Draft issue title and body from sub-agent reports
- [ ] Show draft; wait for user verification
- [ ] Create the issue only after explicit approval
```

Use the same sub-agent rules as existing-issue mode. Pass the user's prompt as the problem statement:

```text
You are gathering evidence to file a new GitHub issue.
Repo: {owner/repo}

USER REPORT:
{verbatim user prompt, minus the /github-triage prefix}

TASK:
Investigate the codebase against this report. Report findings only.

FORBIDDEN:
- Do not apply a fix
- Do not edit files
- Do not commit, push, or open a PR
- Do not create or comment on GitHub issues

RETURN:
- Suggested issue title (imperative, specific)
- Relevant files and symbols (paths)
- Likely root cause (or competing hypotheses)
- How to reproduce or what evidence is missing
- Suggested next steps (fix approach only — do not implement)
- Confidence: high / medium / low
```

### Draft the issue

Write **title** and **body** from sub-agent reports. Structure the body with [issue-template.md](issue-template.md).

Title: short, specific, imperative or symptom-shaped (e.g. `Planner graph nodes overlap after layout`). Do not start with `Bug:` unless the repo convention requires it.

### Show the draft — do not create

Present:

1. A short recap of what the agents found.
2. The **exact** title and body in markdown code blocks so the user can review wording.
3. A clear ask: approve as-is, request edits, or abort.

Do not call GitHub create-issue APIs or `gh issue create` in this step.

### Create after verification

Create **only** when the user clearly approves (e.g. "looks good", "create it", "file that"). If they edited title or body, use **their** version.

GitHub MCP: use the create-issue tool after reading its schema.

gh CLI:

```bash
gh issue create -R {owner/repo} --title "{approved title}" --body-file /tmp/github-triage-new-issue.md
```

Write the approved body to that file first. Do not pass a long body on the shell command line.

After creating, give the new issue URL. Still do not apply a fix unless the user starts a new request for that.

## Examples

**User:** `/github-triage 87`

Fetch issue 87, dispatch locate + root-cause sub-agents, show a draft comment, wait.

**User:** `/github-triage https://github.com/ghotso/factorymate/issues/12`

Same, targeting that repo/issue.

**User:** `/github-triage save button stays disabled after valid input`

No number → new-issue mode. Investigate with sub-agents, show title + body, wait.

**User:** "post it" / "create it" (after a draft in this thread)

Post the comment or create the issue as drafted. Do not start a new investigation.
