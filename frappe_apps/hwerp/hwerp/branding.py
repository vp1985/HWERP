#!/usr/bin/env python3
"""Fail when versionable source paths or contents retain the retired namespace."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

RETIRED_NAMESPACES = ("hw" + "os", "handwerk" + "os")
ALLOWED_HOST = RETIRED_NAMESPACES[0] + ".ht-v.de"
SKIP_DIRS = {
    ".git",
    ".hermes",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "__pycache__",
    "dist",
    "node_modules",
}
SKIP_SUFFIXES = {
    ".gif",
    ".ico",
    ".jpeg",
    ".jpg",
    ".pdf",
    ".png",
    ".pyc",
    ".svgz",
    ".webp",
    ".zip",
}


def _is_skipped(path: Path, root: Path) -> bool:
    relative = path.relative_to(root)
    return any(part in SKIP_DIRS for part in relative.parts)


def _content_violations(path: Path, root: Path) -> list[str]:
    if path.suffix.lower() in SKIP_SUFFIXES:
        return []
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return []
    text = re.sub(re.escape(ALLOWED_HOST), "", text, flags=re.IGNORECASE)
    relative = path.relative_to(root).as_posix()
    folded = text.casefold()
    return [
        f"{relative}: forbidden content {retired!r}"
        for retired in RETIRED_NAMESPACES
        if retired in folded
    ]


def find_violations(root: Path) -> list[str]:
    root = root.resolve()
    violations: list[str] = []
    for path in sorted(root.rglob("*")):
        if _is_skipped(path, root):
            continue
        relative = path.relative_to(root).as_posix()
        folded_relative = relative.casefold()
        for retired in RETIRED_NAMESPACES:
            if retired in folded_relative:
                violations.append(f"{relative}: forbidden path {retired!r}")
        if path.is_file():
            violations.extend(_content_violations(path, root))
    return violations


def main(default_root: Path | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "root",
        nargs="?",
        type=Path,
        default=default_root or Path(__file__).resolve().parents[1],
    )
    args = parser.parse_args()
    violations = find_violations(args.root)
    if violations:
        print("\n".join(violations))
        return 1
    print("HWERP namespace check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
