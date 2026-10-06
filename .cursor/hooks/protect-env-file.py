#!/usr/bin/env python3
"""Ask before the agent changes backend/.env via file tools or the shell."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

PROTECTED_RELATIVE = Path("backend") / ".env"
READ_ONLY_PREFIXES = (
    "cat",
    "head",
    "tail",
    "less",
    "more",
    "grep",
    "egrep",
    "fgrep",
    "rg",
    "wc",
    "ls",
    "stat",
    "file",
    "test",
    "[",
    "bat",
    "nl",
    "od",
    "hexdump",
)


def emit(payload: dict) -> None:
    print(json.dumps(payload))


def allow() -> None:
    emit({"permission": "allow"})


def ask(target: str) -> None:
    emit(
        {
            "permission": "ask",
            "user_message": (
                f"The agent wants to change the protected env file {target}. "
                "Approve only if this edit is intentional."
            ),
            "agent_message": (
                f"Changing {target} requires user approval. Wait for permission "
                "before retrying or editing that file."
            ),
        }
    )


def workspace_roots(payload: dict) -> list[Path]:
    roots = payload.get("workspace_roots") or []
    env_root = os.environ.get("CURSOR_PROJECT_DIR")
    if env_root:
        roots = list(roots) + [env_root]
    cwd = payload.get("cwd")
    if cwd:
        roots = list(roots) + [cwd]
    unique: list[Path] = []
    seen: set[str] = set()
    for root in roots:
        path = Path(root).expanduser()
        key = str(path)
        if key not in seen:
            seen.add(key)
            unique.append(path)
    return unique or [Path.cwd()]


def normalize(path: Path) -> Path:
    expanded = path.expanduser()
    try:
        return expanded.resolve(strict=False)
    except OSError:
        return expanded


def is_protected_env(path_value: object, cwd: Path, roots: list[Path]) -> bool:
    if not isinstance(path_value, str) or not path_value.strip():
        return False
    raw = Path(path_value.strip())
    candidates = [raw] if raw.is_absolute() else [cwd / raw]
    candidates.extend(root / raw for root in roots if not raw.is_absolute())
    for candidate in candidates:
        resolved = normalize(candidate)
        if resolved.name != ".env":
            continue
        if resolved.parent.name == "backend":
            return True
        for root in roots:
            if resolved == normalize(root / PROTECTED_RELATIVE):
                return True
    return False


def collect_paths(value: object) -> list[object]:
    if isinstance(value, dict):
        paths: list[object] = []
        for key, nested in value.items():
            if key in {
                "path",
                "file_path",
                "target_notebook",
                "old_path",
                "new_path",
            }:
                paths.append(nested)
            paths.extend(collect_paths(nested))
        return paths
    if isinstance(value, list):
        nested_paths: list[object] = []
        for item in value:
            nested_paths.extend(collect_paths(item))
        return nested_paths
    return []


def command_targets_protected_env(command: str, cwd: Path, roots: list[Path]) -> bool:
    if not command:
        return False
    if is_protected_env(command, cwd, roots):
        return True
    tokens = re.findall(r"""[^\s"'`]+|"[^"]*"|'[^']*'""", command)
    for token in tokens:
        cleaned = token.strip("\"'")
        cleaned = cleaned.lstrip("0123456789")
        if "backend" in cleaned and cleaned.endswith(".env"):
            path_part = cleaned.split("=", 1)[-1] if "=" in cleaned else cleaned
            if is_protected_env(path_part, cwd, roots):
                return True
        elif cleaned in {".env", "./.env"} and cwd.name == "backend":
            return True
        elif is_protected_env(cleaned, cwd, roots):
            return True
    return False


def is_read_only_command(command: str) -> bool:
    stripped = command.strip()
    if not stripped:
        return False
    if re.search(r"(>>?|tee\b|sed\s+-i|\bmv\b|\bcmv\b|\brm\b|\bcp\b|\btouch\b|\btruncate\b)", stripped):
        return False
    first = stripped.split()[0]
    first = Path(first).name
    return first in READ_ONLY_PREFIXES


def handle_pre_tool_use(payload: dict, cwd: Path, roots: list[Path]) -> None:
    tool_input = payload.get("tool_input") or {}
    for path_value in collect_paths(tool_input):
        if is_protected_env(path_value, cwd, roots):
            ask(str(PROTECTED_RELATIVE))
            return
    allow()


def handle_shell(payload: dict, cwd: Path, roots: list[Path]) -> None:
    command = payload.get("command") or ""
    if command_targets_protected_env(command, cwd, roots) and not is_read_only_command(command):
        ask(str(PROTECTED_RELATIVE))
        return
    allow()


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        allow()
        return 0

    cwd = Path(payload.get("cwd") or os.environ.get("CURSOR_PROJECT_DIR") or Path.cwd())
    roots = workspace_roots(payload)
    event = payload.get("hook_event_name") or ""
    tool_name = payload.get("tool_name") or ""

    if event == "beforeShellExecution" or (event == "preToolUse" and tool_name == "Shell"):
        handle_shell(
            payload if event == "beforeShellExecution" else (payload.get("tool_input") or {}),
            cwd,
            roots,
        )
        return 0

    if event == "preToolUse":
        handle_pre_tool_use(payload, cwd, roots)
        return 0

    if "command" in payload:
        handle_shell(payload, cwd, roots)
        return 0

    handle_pre_tool_use(payload, cwd, roots)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
