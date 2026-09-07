# Run artifacts

Output directory for Playwright runs — HTML reports, videos, traces, failure
screenshots, and the summary posted to a pull request. Written by the
`playwright-pr-runner` skill, and safe to delete at any time.

**Everything in here except this file is gitignored, and that is deliberate.**
A video or trace committed to the repo would stay in git history permanently,
even after a later commit deleted the file.

## How these reach a pull request

This is also the Cloud Agent artifact directory. Files written here are
uploaded off the agent VM and outlive the run, and with **Allow posting
artifacts to GitHub** enabled in the Cloud Agents dashboard, Cursor embeds them
in the PR description behind long unguessable URLs that need no login. So a
reviewer opens them from the PR without checking out the branch, and nothing
had to be committed to get there.

Because the files live on the agent side rather than in the repo, there is no
cleanup step to run when a PR merges.

## Layout

```
artifacts/playwright/
  summary.md            Feedback posted as the PR comment
  html-report/          HTML report for the tests in scope
  test-results/         Failure media from that run
  new-tests/            Only when the run authored specs
    README.md           Each new test, its result, how to view it
    specs/              Sources of the specs that were written
    videos/             One video per new test, named after the test
    runs/               Per-test video, trace, and screenshot
    report/             HTML report for the capture run
    run.log             Stepped log of the capture run
```

Locally, `artifacts/` is populated by the same commands the skill runs; see
`.cursor/skills/playwright-pr-runner/SKILL.md`.
