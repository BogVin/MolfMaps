#!/usr/bin/env python3
"""Copy Playwright outputs into artifacts/playwright/ and write summary.md.

Also packages the specs this run authored - copies, a patch, and a manifest -
so a PR reviewer can see the new tests next to their results.

Run this BEFORE committing new specs: the packaging reads them from the
working tree via `git status`.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent
ROOT = SKILL_DIR.parents[2]
E2E = ROOT / "e2e"
DEST = ROOT / "artifacts" / "playwright"
RESULTS_JSON = E2E / "test-results" / "results.json"
REPORT_DIR = E2E / "playwright-report"
TEST_RESULTS = E2E / "test-results"
SELECTION_JSON = DEST / "selection.json"
NEW_TESTS_DIR = "new-tests"
FAILURE_SUFFIXES = {".png", ".webm", ".zip"}
FAILURE_NAMES = {"error-context.md"}
MAX_MESSAGE_CHARS = 400


def git(*args: str) -> str:
    proc = subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True, check=False
    )
    return proc.stdout if proc.returncode == 0 else ""


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


def load_selection() -> dict:
    """Read the scope plan before the destination is cleared."""
    if not SELECTION_JSON.is_file():
        return {}
    try:
        return json.loads(SELECTION_JSON.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def pending_e2e_changes() -> list[dict]:
    """Uncommitted e2e files, i.e. the tests this run wrote."""
    changes: list[dict] = []
    for line in git("status", "--porcelain", "--", "e2e").splitlines():
        if not line.strip():
            continue
        status = line[:2]
        path = line[3:].strip().strip('"')
        if " -> " in path:
            path = path.split(" -> ")[-1]
        changes.append(
            {"path": path, "added": "?" in status or "A" in status}
        )
    return sorted(changes, key=lambda item: item["path"])


def walk_suite(suite: dict, records: list[dict]) -> None:
    for child in suite.get("suites") or []:
        walk_suite(child, records)
    for spec in suite.get("specs") or []:
        for test in spec.get("tests") or []:
            results = test.get("results") or []
            outcome = test.get("status") or (
                (results[-1].get("status") if results else None) or "unknown"
            )
            error = (results[-1].get("error") or {}) if results else {}
            message = (error.get("message") or "").strip()
            if len(message) > MAX_MESSAGE_CHARS:
                message = message[:MAX_MESSAGE_CHARS] + "…"
            records.append(
                {
                    "title": spec.get("title") or "unnamed",
                    "project": test.get("projectName") or "",
                    "file": f"e2e/{spec.get('file')}" if spec.get("file") else "",
                    "outcome": outcome,
                    "message": message,
                    "duration_ms": sum(int(r.get("duration") or 0) for r in results),
                }
            )


def read_records(results_path: Path) -> tuple[list[dict], int | None]:
    if not results_path.is_file():
        return [], None
    data = json.loads(results_path.read_text(encoding="utf-8"))
    records: list[dict] = []
    for suite in data.get("suites") or []:
        walk_suite(suite, records)
    stats = data.get("stats") or {}
    duration = stats.get("duration")
    return records, int(duration) if duration is not None else None


def bucket(record: dict) -> str:
    outcome = record["outcome"]
    if outcome == "skipped":
        return "skipped"
    if outcome == "flaky":
        return "flaky"
    if outcome in ("expected", "passed"):
        return "passed"
    return "failed"


def summarize(records: list[dict]) -> dict:
    totals = {"passed": 0, "failed": 0, "skipped": 0, "flaky": 0}
    for record in records:
        state = bucket(record)
        totals[state] += 1
        if state == "flaky":
            totals["passed"] += 1
    return totals


def package_new_tests(
    dest: Path, changes: list[dict], records: list[dict], selection: dict
) -> dict:
    """Copy new/edited specs, write a patch, and build a per-test manifest."""
    if not changes:
        return {"specs": [], "patch": None, "files": 0}

    target = dest / NEW_TESTS_DIR
    target.mkdir(parents=True, exist_ok=True)

    for change in changes:
        source = ROOT / change["path"]
        if not source.is_file():
            continue
        copy = target / change["path"].removeprefix("e2e/")
        copy.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, copy)

    # `git add -N` gives untracked specs a diff, so the patch shows new files too.
    git("add", "--intent-to-add", "--", "e2e")
    patch = git("diff", "HEAD", "--", "e2e")
    patch_path = None
    if patch.strip():
        patch_path = target / "new-tests.patch"
        patch_path.write_text(patch, encoding="utf-8")

    coverage_map = selection.get("coverage_map") or {}
    specs = []
    for change in changes:
        path = change["path"]
        if not path.endswith(".spec.ts"):
            continue
        spec_records = [r for r in records if r["file"] == path]
        counts = summarize(spec_records)
        specs.append(
            {
                "path": path,
                "added": change["added"],
                "covers": coverage_map.get(path, []),
                "records": spec_records,
                "counts": counts,
            }
        )

    lines = ["# Tests written by this run", ""]
    if not specs:
        lines.append("No spec files changed; see `new-tests.patch` for support files.")
    for spec in specs:
        verb = "new file" if spec["added"] else "extended"
        lines.append(f"## `{spec['path']}` ({verb})")
        lines.append("")
        covers = ", ".join(f"`{c}`" for c in spec["covers"]) or "_no COVERAGE_TAG_"
        lines.append(f"Covers: {covers}")
        lines.append("")
        if spec["records"]:
            lines.extend(["| Test | Result |", "|------|--------|"])
            for record in spec["records"]:
                lines.append(f"| {record['title']} | {bucket(record)} |")
        else:
            lines.append("_Not executed in this run._")
        lines.append("")

    (target / "manifest.md").write_text("\n".join(lines), encoding="utf-8")

    return {
        "specs": specs,
        "patch": patch_path,
        "files": len([c for c in changes if (ROOT / c["path"]).is_file()]),
    }


def scope_line(selection: dict) -> str:
    if not selection:
        return "**Scope:** full suite (no selection plan found)"

    mode = selection.get("mode", "full")
    base = selection.get("base_ref", "unknown")
    surfaces = list((selection.get("ui_changes") or {}).get("surfaces") or {})
    named = ", ".join(f"`{s}`" for s in surfaces)

    if mode == "smoke":
        detail = "smoke only (`@p1`) — this PR changes no UI code"
    elif mode == "full":
        detail = "full suite — the change is app-wide or touches shared test scaffolding"
    elif mode == "generate":
        detail = f"newly authored specs only — no spec covered {named or 'the changed UI'}"
    elif named:
        detail = f"targeted run for UI surface(s) {named}"
    else:
        detail = "targeted run for the specs this PR changes"
    return f"**Scope:** {detail} (base `{base}`)"


def write_summary(
    dest: Path,
    selection: dict,
    records: list[dict],
    duration_ms: int | None,
    has_json: bool,
    new_tests: dict,
) -> Path:
    counts = summarize(records)
    failed = counts["failed"]
    total = counts["passed"] + failed + counts["skipped"]
    status = "PASS" if has_json and failed == 0 and total > 0 else "FAIL"
    new_spec_paths = {spec["path"] for spec in new_tests["specs"]}

    lines = ["## Playwright E2E", "", f"**Status:** {status}", "", scope_line(selection)]

    ran = selection.get("specs_to_run") or []
    if ran:
        lines.append("**Ran:** " + ", ".join(f"`{path}`" for path in ran))
    lines.append("")

    if has_json:
        lines.append(
            f"**Results:** {counts['passed']} passed, {failed} failed, "
            f"{counts['skipped']} skipped, {counts['flaky']} flaky"
        )
        if duration_ms is None:
            duration_ms = sum(r["duration_ms"] for r in records)
        lines.append(f"**Duration:** {duration_ms / 1000:.1f}s")
    else:
        lines.append(
            "**Results:** Playwright JSON report was missing. "
            "Treat this as an infrastructure failure unless the live test log "
            "shows a green run."
        )

    # A spec that was only touched (e.g. a COVERAGE_TAG edit) and never ran adds
    # nothing here; the manifest still lists it.
    reportable = [
        spec for spec in new_tests["specs"] if spec["added"] or spec["records"]
    ]
    if reportable:
        lines.extend(["", "### New UI tests", ""])
        for spec in reportable:
            spec_counts = spec["counts"]
            written = len(spec["records"])
            verb = "added" if spec["added"] else "extended"
            covers = ", ".join(f"`{c}`" for c in spec["covers"]) or "untagged"
            lines.append(
                f"- `{spec['path']}` — {verb}, {written} test(s): "
                f"{spec_counts['passed']} passed, {spec_counts['failed']} failed "
                f"(covers {covers})"
            )
        lines.append("")
        lines.append(
            f"Full sources, diff, and per-test results: "
            f"`artifacts/playwright/{NEW_TESTS_DIR}/`"
        )

    unfilled = [
        gap
        for gap in selection.get("coverage_gaps") or []
        if (gap.get("existing_spec") or gap.get("suggested_spec")) not in new_spec_paths
    ]
    if unfilled:
        lines.extend(["", "### Coverage gaps still open", ""])
        for gap in unfilled:
            files = ", ".join(f"`{path}`" for path in gap["files"])
            lines.append(f"- **{gap['surface']}** — {files}")
        lines.append("")
        lines.append("No spec covers these UI changes yet.")

    lines.extend(["", "### Artifacts", ""])
    html = dest / "html-report" / "index.html"
    lines.append(
        "- HTML report: `artifacts/playwright/html-report/index.html`"
        if html.is_file()
        else "- HTML report: not produced"
    )
    media = [p for p in (dest / "failures").rglob("*") if p.is_file()]
    lines.append(
        f"- Failure media: {len(media)} file(s) under `artifacts/playwright/failures/`"
        if media
        else "- Failure media: none"
    )
    if (dest / "results.json").is_file():
        lines.append("- JSON report: `artifacts/playwright/results.json`")
    if new_tests["patch"]:
        lines.append(
            f"- New tests: `artifacts/playwright/{NEW_TESTS_DIR}/` "
            f"(sources, `new-tests.patch`, `manifest.md`)"
        )

    failures = [r for r in records if bucket(r) == "failed"]
    if failures:
        lines.extend(["", "### Failures", ""])
        for item in failures:
            loc = f" (`{item['file']}`)" if item["file"] else ""
            proj = f" [{item['project']}]" if item["project"] else ""
            tag = " — **new test**" if item["file"] in new_spec_paths else ""
            lines.append(f"- **{item['title']}**{proj}{loc}{tag}")
            lines.append(f"  - `{item['message'] or 'failed'}`")
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
    selection = load_selection()

    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir(parents=True, exist_ok=True)
    if selection:
        SELECTION_JSON.write_text(json.dumps(selection, indent=2) + "\n", encoding="utf-8")

    copy_tree(REPORT_DIR, DEST / "html-report")
    if RESULTS_JSON.is_file():
        shutil.copy2(RESULTS_JSON, DEST / "results.json")
    copy_failures(TEST_RESULTS, DEST / "failures")

    records, duration_ms = read_records(RESULTS_JSON)
    new_tests = package_new_tests(DEST, pending_e2e_changes(), records, selection)
    summary = write_summary(
        DEST, selection, records, duration_ms, RESULTS_JSON.is_file(), new_tests
    )

    if selection.get("needs_generation") and not new_tests["specs"]:
        print(
            "WARNING: the plan reported coverage gaps but no new spec was found in "
            "the working tree. Either author the missing UI specs, or run this "
            "script before committing them.",
            file=sys.stderr,
        )

    print(summary)
    print(f"Artifacts written to {DEST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
