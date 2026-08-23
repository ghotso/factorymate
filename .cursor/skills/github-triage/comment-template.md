# Issue comment template

Fill from sub-agent reports. Omit empty sections. Keep it factual and concise.

```markdown
## Investigation summary

{1–3 sentences: what the report describes and what the codebase suggests}

## Relevant code

- `{path}` — {why it matters}
- `{path}` — {why it matters}

## Likely cause

{Best hypothesis. If agents disagree, list competing hypotheses.}

**Confidence:** high | medium | low

## Gaps / questions

- {Missing repro steps, environment, logs, or unclear expected behavior}

## Suggested next steps

- {Investigation or fix direction only — no patch in this comment}

---
_Investigation only; no code change applied yet._
```
