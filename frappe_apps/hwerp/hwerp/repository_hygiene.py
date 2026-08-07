#!/usr/bin/env python3
"""Reject publishable sources containing non-approved email domains."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

ALLOWED_DOMAINS = frozenset({"example.com", "example.test", "ht-v.de"})
EMAIL_PATTERN = re.compile(
    r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})"
)
SKIP_DIRS = {
    ".git",
    ".hermes",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "__pycache__",
    "coverage",
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


def find_violations(root: Path) -> list[str]:
    root = root.resolve()
    violations: list[str] = []
    for path in sorted(root.rglob("*")):
        relative_path = path.relative_to(root)
        if any(part in SKIP_DIRS for part in relative_path.parts):
            continue
        if not path.is_file() or path.suffix.casefold() in SKIP_SUFFIXES:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        domains = {domain.casefold().rstrip(".") for domain in EMAIL_PATTERN.findall(text)}
        for domain in sorted(domains - ALLOWED_DOMAINS):
            violations.append(
                f"{relative_path.as_posix()}: non-publishable email domain {domain!r}"
            )
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
    print("Repository hygiene check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
