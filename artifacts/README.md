# Local Playwright artifacts

Output directory for Jira-driven Playwright runs: HTML reports, videos, traces,
screenshots, source copies, and stepped logs. Written by the
`playwright-jira-runner` skill and safe to delete after review.

**Everything in here except this file is gitignored, and that is deliberate.**
A video or trace committed to the repo would stay in git history permanently,
even after a later commit deleted the file.

These artifacts remain local. The skill posts run summaries as **Jira
comments** (never edits the ticket description) and records exact local
evidence paths. The available Jira MCP integration cannot upload attachments,
so those paths are references, not remote download links.

## Layout

```
artifacts/playwright/
  <JIRA-KEY>/
    README.md           Requirements, results, failures, and viewing commands
    specs/              Sources of the specs/page objects that were run or written
    videos/             One human-named video per test in the run
    runs/               Per-test video, trace, and screenshot
    report/             HTML report for the capture run
    run.log             Stepped log of the capture run
```

Locally, `artifacts/` is populated by the same commands the skill runs; see
`.cursor/skills/playwright-jira-runner/SKILL.md`.
