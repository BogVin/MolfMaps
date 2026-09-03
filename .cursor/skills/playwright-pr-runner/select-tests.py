#!/usr/bin/env python3
"""Resolve the Playwright scope for a pull request.

Maps the PR's changed files onto the specs that cover them (via each spec's
`COVERAGE_TAG` header), picks a targeted / full / smoke run, and reports the UI
surfaces that no spec covers yet.

Writes `artifacts/playwright/selection.json` and prints a readable plan.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent
ROOT = SKILL_DIR.parents[2]
SPEC_DIR = ROOT / "e2e" / "tests"
SELECTION_JSON = ROOT / "artifacts" / "playwright" / "selection.json"

COVERAGE_TAG_RE = re.compile(r"COVERAGE_TAG\s*:\s*(.+)")
COVERAGE_TAG_SCAN_LINES = 5

# Feature directories under FEATURE_ROOT are the UI surfaces a spec can cover.
# The broad patterns are app-wide shells and build config that no single spec
# owns, so they widen the run instead of demanding a new spec.
FEATURE_ROOT = "frontend/src/app"
BROAD_UI_PATTERNS = (
    "frontend/src/app/core/**",
    "frontend/src/app/*.ts",
    "frontend/src/app/*.html",
    "frontend/src/app/*.css",
    "frontend/src/main.ts",
    "frontend/src/index.html",
    "frontend/src/styles.css",
    "frontend/angular.json",
    "frontend/proxy.conf.json",
    "frontend/package.json",
)
# Shared test scaffolding - a change here can affect every spec.
E2E_INFRA_PATTERNS = (
    "e2e/playwright.config.ts",
    "e2e/package.json",
    "e2e/fixtures/**",
    "e2e/pages/**",
)
SMOKE_GREP = "@p1"


def git(*args: str) -> str:
    proc = subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True, check=False
    )
    return proc.stdout if proc.returncode == 0 else ""


def glob_to_regex(pattern: str) -> re.Pattern[str]:
    """Compile a repo-relative glob. `*` stops at `/`, `**` spans directories."""
    pattern = pattern.strip().strip("/")
    out: list[str] = []
    i = 0
    while i < len(pattern):
        if pattern.startswith("/**/", i):
            out.append("/(?:.*/)?")
            i += 4
        elif pattern.startswith("**", i):
            out.append(".*")
            i += 2
        elif pattern[i] == "*":
            out.append("[^/]*")
            i += 1
        elif pattern[i] == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(pattern[i]))
            i += 1
    return re.compile("^" + "".join(out) + "$")


def matches_any(path: str, patterns) -> bool:
    return any(glob_to_regex(p).match(path) for p in patterns)


def resolve_base(explicit: str | None) -> str:
    """Prefer the PR's base branch, then origin/HEAD, then main."""
    if explicit:
        return explicit

    candidates: list[str] = []
    pr = subprocess.run(
        ["gh", "pr", "view", "--json", "baseRefName"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if pr.returncode == 0 and pr.stdout.strip():
        try:
            name = (json.loads(pr.stdout).get("baseRefName") or "").strip()
        except json.JSONDecodeError:
            name = ""
        if name:
            candidates += [f"origin/{name}", name]

    head = git("symbolic-ref", "--quiet", "refs/remotes/origin/HEAD").strip()
    if head:
        candidates.append(head.removeprefix("refs/remotes/"))
    candidates += ["origin/main", "main"]

    for ref in candidates:
        if git("rev-parse", "--verify", "--quiet", ref + "^{commit}").strip():
            return ref
    return "HEAD~1"


def changed_files(base: str) -> tuple[list[str], str]:
    """Files changed against the base's merge base, plus working-tree changes."""
    merge_base = git("merge-base", base, "HEAD").strip()
    diff_range = f"{merge_base}..HEAD" if merge_base else "HEAD~1..HEAD"

    paths: set[str] = set()
    committed = git("diff", "--name-only", "--diff-filter=ACMR", diff_range)
    paths.update(line.strip() for line in committed.splitlines() if line.strip())

    for line in git("status", "--porcelain").splitlines():
        if not line.strip():
            continue
        path = line[3:].strip().strip('"')
        if " -> " in path:
            path = path.split(" -> ")[-1]
        paths.add(path)

    return sorted(paths), merge_base


def read_coverage_map() -> tuple[dict[str, list[str]], list[str]]:
    """spec path -> globs it covers, plus specs missing a COVERAGE_TAG header."""
    coverage: dict[str, list[str]] = {}
    untagged: list[str] = []
    if not SPEC_DIR.is_dir():
        return coverage, untagged

    for spec in sorted(SPEC_DIR.rglob("*.spec.ts")):
        rel = spec.relative_to(ROOT).as_posix()
        globs: list[str] = []
        with spec.open(encoding="utf-8") as handle:
            for _, line in zip(range(COVERAGE_TAG_SCAN_LINES), handle):
                match = COVERAGE_TAG_RE.search(line)
                if match:
                    globs = [
                        part.strip()
                        for part in match.group(1).split(",")
                        if part.strip()
                    ]
                    break
        if globs:
            coverage[rel] = globs
        else:
            untagged.append(rel)
    return coverage, untagged


def surface_of(path: str) -> str | None:
    """Feature directory name under frontend/src/app, e.g. `maps`."""
    if not path.startswith(FEATURE_ROOT + "/"):
        return None
    rest = path[len(FEATURE_ROOT) + 1 :].split("/")
    return rest[0] if len(rest) > 1 else None


def classify(files: list[str]) -> dict:
    surfaces: dict[str, list[str]] = {}
    buckets: dict[str, list[str]] = {
        "broad_ui": [],
        "ui_unit_tests": [],
        "changed_specs": [],
        "e2e_infra": [],
        "non_ui": [],
    }

    for path in files:
        if matches_any(path, E2E_INFRA_PATTERNS):
            buckets["e2e_infra"].append(path)
        elif path.startswith("e2e/tests/") and path.endswith(".spec.ts"):
            buckets["changed_specs"].append(path)
        elif not path.startswith("frontend/"):
            buckets["non_ui"].append(path)
        elif path.endswith(".spec.ts"):
            # Angular unit tests are not a UI surface an E2E spec should cover.
            buckets["ui_unit_tests"].append(path)
        elif matches_any(path, BROAD_UI_PATTERNS):
            buckets["broad_ui"].append(path)
        elif (surface := surface_of(path)) is not None:
            surfaces.setdefault(surface, []).append(path)
        else:
            buckets["broad_ui"].append(path)

    buckets["surfaces"] = surfaces
    return buckets


def build_plan(base: str, files: list[str], merge_base: str) -> dict:
    coverage, untagged = read_coverage_map()
    changes = classify(files)
    surfaces = changes["surfaces"]

    # Which specs cover the changed feature files, and which files nothing covers.
    related: set[str] = set(changes["changed_specs"])
    uncovered: dict[str, list[str]] = {}
    for surface, surface_files in surfaces.items():
        for path in surface_files:
            covering = [
                spec for spec, globs in coverage.items() if matches_any(path, globs)
            ]
            if covering:
                related.update(covering)
            else:
                uncovered.setdefault(surface, []).append(path)

    # An untagged spec cannot be matched, so run it rather than assume a gap.
    if untagged and (surfaces or changes["changed_specs"]):
        related.update(untagged)

    if changes["e2e_infra"] or changes["broad_ui"]:
        mode = "full"
    elif related:
        mode = "targeted"
    elif surfaces:
        # UI changed but no spec covers it yet: author the specs, then re-run
        # this script so the new files land in the run set.
        mode = "generate"
    else:
        mode = "smoke"

    gaps = [
        {
            "surface": surface,
            "files": sorted(paths),
            "suggested_spec": f"e2e/tests/{surface}.spec.ts",
            "existing_spec": (
                f"e2e/tests/{surface}.spec.ts"
                if (SPEC_DIR / f"{surface}.spec.ts").is_file()
                else None
            ),
        }
        for surface, paths in sorted(uncovered.items())
    ]

    specs_to_run = sorted(related)
    if mode in ("full", "generate"):
        playwright_args: list[str] = []
    elif mode == "smoke":
        playwright_args = ["--grep", SMOKE_GREP]
    else:
        # Playwright resolves positional filters relative to the config dir.
        playwright_args = [p.removeprefix("e2e/") for p in specs_to_run]

    return {
        "base_ref": base,
        "merge_base": merge_base,
        "mode": mode,
        "playwright_args": playwright_args,
        "specs_to_run": specs_to_run,
        "coverage_gaps": gaps,
        "needs_generation": bool(gaps),
        "ui_changes": {
            "surfaces": {k: sorted(v) for k, v in sorted(surfaces.items())},
            "broad": sorted(changes["broad_ui"]),
            "unit_tests": sorted(changes["ui_unit_tests"]),
        },
        "e2e_changes": {
            "specs": sorted(changes["changed_specs"]),
            "infra": sorted(changes["e2e_infra"]),
        },
        "non_ui_changes": sorted(changes["non_ui"]),
        "ui_touched": bool(surfaces or changes["broad_ui"]),
        "coverage_map": coverage,
        "untagged_specs": untagged,
        "changed_files": files,
    }


def render_plan(plan: dict) -> str:
    surfaces = plan["ui_changes"]["surfaces"]
    lines = [
        f"base ref:      {plan['base_ref']}",
        f"mode:          {plan['mode']}",
        f"changed files: {len(plan['changed_files'])}",
        f"UI surfaces:   {', '.join(surfaces) if surfaces else '(none)'}",
    ]

    if plan["ui_changes"]["broad"]:
        lines.append(
            f"broad UI:      {len(plan['ui_changes']['broad'])} file(s) -> full suite"
        )
    if plan["e2e_changes"]["infra"]:
        lines.append(
            f"e2e infra:     {len(plan['e2e_changes']['infra'])} file(s) -> full suite"
        )

    if plan["mode"] == "full":
        lines.append("run:           full suite")
    elif plan["mode"] == "generate":
        lines.append("run:           nothing yet - no spec covers the changed UI")
        lines.append("               author the specs below, then re-run this script")
    elif plan["mode"] == "smoke":
        lines.append(f"run:           smoke only (--grep {SMOKE_GREP})")
        lines.append("               no UI changes, so no tests will be generated")
    else:
        lines.append("run:           " + " ".join(plan["playwright_args"]))

    if plan["specs_to_run"]:
        lines.append("related specs:")
        lines.extend(f"  - {spec}" for spec in plan["specs_to_run"])

    if plan["coverage_gaps"]:
        lines.append("coverage gaps (author UI specs for these):")
        for gap in plan["coverage_gaps"]:
            verb = "extend" if gap["existing_spec"] else "create"
            target = gap["existing_spec"] or gap["suggested_spec"]
            lines.append(f"  - {gap['surface']}: {verb} {target}")
            lines.extend(f"      {path}" for path in gap["files"])

    if plan["untagged_specs"]:
        lines.append("specs missing COVERAGE_TAG (add one):")
        lines.extend(f"  - {spec}" for spec in plan["untagged_specs"])

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Resolve the Playwright PR scope.")
    parser.add_argument("--base", help="Base ref to diff against (default: PR base)")
    parser.add_argument(
        "--json", action="store_true", help="Print the plan as JSON instead of text"
    )
    args = parser.parse_args()

    base = resolve_base(args.base)
    files, merge_base = changed_files(base)
    plan = build_plan(base, files, merge_base)

    SELECTION_JSON.parent.mkdir(parents=True, exist_ok=True)
    SELECTION_JSON.write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(plan, indent=2) if args.json else render_plan(plan))
    print(f"\nPlan written to {SELECTION_JSON.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
