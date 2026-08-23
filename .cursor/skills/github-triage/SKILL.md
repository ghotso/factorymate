---
name: github-triage
description: >-
  Investigate a GitHub issue with sub-agents and draft a comment summarizing
  findings. Does not apply a fix or post until the user approves. Use when the
  user runs /github-triage, names a GitHub issue number, or asks to triage a
  GitHub issue without fixing it.
disable-model-invocation: true
---

# GitHub triage

Use this skill when the user runs `/github-triage` with a GitHub issue number.

Goal: fetch the issue, investigate the codebase **with sub-agents only**, then **propose a comment**. Do **not** apply a fix. Do **not** post the comment until the user has verified the draft.

## Hard rules

- **No code changes.** Do not edit, patch, or commit anything while this skill is running.
- **No comment post until approval.** Show a draft first. Post only after the user explicitly confirms the text is fine (or supplies an edited version to post).
- **Investigation is sub-agents only.** The parent agent must not search, read, or grep the codebase to diagnose the issue. Fetching the GitHub issue, launching sub-agents, and drafting the comment from their reports are the only parent-side jobs.
- If the user also asks to fix or post immediately, still follow this skill: investigate → draft → wait.

## Workflow

Copy this checklist and track it:

```
- [ ] 1. Parse issue number (and optional owner/repo)
- [ ] 2. Fetch issue via GitHub MCP or gh CLI
- [ ] 3. Dispatch investigation sub-agents (parent does not investigate)
- [ ] 4. Draft comment from sub-agent reports
- [ ] 5. Show draft; wait for user verification
- [ ] 6. Post only after explicit approval
```

### 1. Parse the issue number

From the user prompt, extract:

| Input | Parse as |
| --- | --- |
| `/github-triage 42` | issue `42` in the current repo |
| `/github-triage #42` | same |
| `https://github.com/owner/repo/issues/42` | issue `42` in `owner/repo` |
| `/github-triage owner/repo#42` | issue `42` in `owner/repo` |

If no issue number is present, ask for one and stop.

If `owner/repo` is not in the prompt, resolve the current GitHub repo (`gh repo view --json nameWithOwner` or git remote). If that fails, ask.

### 2. Fetch the issue

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

### 3. Investigate with sub-agents only

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

### 4. Draft the comment

Write the GitHub comment from **sub-agent reports only**. Structure:

See [comment-template.md](comment-template.md).

The draft is investigation, not a promise to fix. Do not claim you reproduced a runtime bug unless a sub-agent actually did.

### 5. Show the draft — do not post

Present:

1. A short parent-side recap (issue title, state, what the agents agreed on).
2. The **exact** comment in a markdown code block so the user can review wording.
3. A clear ask: approve as-is, request edits, or abort.

Do not call GitHub comment APIs or `gh issue comment` in this step.

### 6. Post after verification

Post **only** when the user clearly approves (e.g. "looks good", "post it", "send that"). If they edited the text, post **their** version.

GitHub MCP: use the add-comment tool after reading its schema.

gh CLI:

```bash
gh issue comment {N} -R {owner/repo} --body-file /tmp/github-triage-{N}-comment.md
```

Write the approved body to that file first. Do not pass a long body on the shell command line.

After posting, give the issue URL. Still do not apply a fix unless the user starts a new request for that.

## Examples

**User:** `/github-triage 87`

Fetch issue 87, dispatch locate + root-cause sub-agents, show a draft comment, wait.

**User:** `/github-triage https://github.com/ghotso/factorymate/issues/12`

Same, targeting that repo/issue.

**User:** "post it" (after a draft in this thread)

Post the approved comment. Do not start a new investigation.
