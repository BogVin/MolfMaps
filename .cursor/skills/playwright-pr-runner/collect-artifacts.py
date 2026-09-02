#!/usr/bin/env python3
"""Copy Playwright outputs into artifacts/playwright/ and write summary.md."""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent
ROOT = SKILL_DIR.parents[2]
E2E = ROOT / "e2e"
DEST = ROOT / "artifacts" / "playwright"
RESULTS_JSON = E2E / "test-results" / "results.json"
REPORT_DIR = E2E / "playwright-report"
TEST_RESULTS = E2E / "test-results"
FAILURE_SUFFIXES = {".png", ".webm", ".zip"}
FAILURE_NAMES = {"error-context.md"}


def copy_tree(src: Path, dest: Path) -> None:
    if not src.is_dir():
        return
    dest.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dest, dirs_exist_ok=True)


def copy_failures(src: Path, dest: Path) -> None:
    if not src.is_dir():
        return
    dest.mkdir(parents=True, exist_ok=True)
    for path in src.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix not in FAILURE_SUFFIXES and path.name not in FAILURE_NAMES:
            continue
        rel = path.relative_to(src)
        target = dest / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)


def walk_suite(suite: dict, counts: dict, failures: list, totals: dict) -> None:
    for child in suite.get("suites") or []:
        walk_suite(child, counts, failures, totals)
    for spec in suite.get("specs") or []:
        title = spec.get("title") or "unnamed"
        for test in spec.get("tests") or []:
            results = test.get("results") or []
            for result in results:
                totals["duration_ms"] += int(result.get("duration") or 0)
            outcome = test.get("status") or (
                (results[-1].get("status") if results else None) or "unknown"
            )
            if outcome == "skipped":
                counts["skipped"] += 1
                continue
            if outcome == "flaky":
                totals["flaky"] += 1
                counts["passed"] += 1
                continue
            if outcome in ("expected", "passed"):
                counts["passed"] += 1
                continue
            counts["failed"] += 1
            last = results[-1] if results else {}
            err = last.get("error") or {}
            message = (err.get("message") or last.get("status") or "failed").strip()
            if len(message) > 400:
                message = message[:400] + "…"
            failures.append(
                {
                    "title": title,
                    "project": test.get("projectName") or "",
                    "message": message,
                    "file": spec.get("file") or "",
                }
            )


def write_summary(dest: Path, results_path: Path) -> Path:
    counts = {"passed": 0, "failed": 0, "skipped": 0}
    totals = {"flaky": 0, "duration_ms": 0}
    failures: list[dict] = []
    has_json = results_path.is_file()

    if has_json:
        data = json.loads(results_path.read_text(encoding="utf-8"))
        for suite in data.get("suites") or []:
            walk_suite(suite, counts, failures, totals)
        stats = data.get("stats") or {}
        if stats.get("duration") is not None:
            totals["duration_ms"] = int(stats["duration"])

    failed = counts["failed"]
    total = counts["passed"] + failed + counts["skipped"]
    status = "PASS" if has_json and failed == 0 and total > 0 else "FAIL"

    lines = ["## Playwright E2E", "", f"**Status:** {status}", ""]
    if has_json:
        lines.append(
            f"**Results:** {counts['passed']} passed, {failed} failed, "
            f"{counts['skipped']} skipped, {totals['flaky']} flaky"
        )
        lines.append(f"**Duration:** {totals['duration_ms'] / 1000:.1f}s")
    else:
        lines.append(
            "**Results:** Playwright JSON report was missing. "
            "Treat this as an infrastructure failure unless the live test log shows a green run."
        )

    lines.extend(["", "### Artifacts", ""])
    html = dest / "html-report" / "index.html"
    lines.append(
        "- HTML report: `artifacts/playwright/html-report/index.html`"
        if html.is_file()
        else "- HTML report: not produced"
    )
    media = [p for p in (dest / "failures").rglob("*") if p.is_file()]
    if media:
        lines.append(
            f"- Failure media: {len(media)} file(s) under `artifacts/playwright/failures/`"
        )
    else:
        lines.append("- Failure media: none")
    if (dest / "results.json").is_file():
        lines.append("- JSON report: `artifacts/playwright/results.json`")

    if failures:
        lines.extend(["", "### Failures", ""])
        for item in failures:
            loc = f" (`{item['file']}`)" if item["file"] else ""
            proj = f" [{item['project']}]" if item["project"] else ""
            lines.append(f"- **{item['title']}**{proj}{loc}")
            lines.append(f"  - `{item['message']}`")
            lines.append("")
        lines.extend(
            [
                "### Likely cause",
                "",
                "Classify each failure as an app bug, a test bug, or infrastructure "
                "(boot, secrets, browsers) using the error and any `error-context.md` "
                "under failures/. Do not paste credentials.",
                "",
            ]
        )

    verdict = (
        "E2E passed. No Playwright blockers on this PR."
        if status == "PASS"
        else "E2E failed. Do not merge until the failures above are resolved or explained."
    )
    lines.extend(["### Verdict", "", verdict, ""])

    summary_path = dest / "summary.md"
    summary_path.write_text("\n".join(lines), encoding="utf-8")
    return summary_path


def main() -> int:
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir(parents=True, exist_ok=True)

    copy_tree(REPORT_DIR, DEST / "html-report")
    if RESULTS_JSON.is_file():
        shutil.copy2(RESULTS_JSON, DEST / "results.json")
    copy_failures(TEST_RESULTS, DEST / "failures")

    summary = write_summary(DEST, RESULTS_JSON)
    print(summary)
    print(f"Artifacts written to {DEST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
