#!/usr/bin/env python3
"""Run the packaged HWERP namespace checker against the repository."""

from __future__ import annotations

from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = PROJECT_ROOT / "frappe_apps" / "hwerp"
sys.path.insert(0, str(APP_ROOT))

from hwerp.branding import main  # noqa: E402  # pyright: ignore[reportMissingImports]


if __name__ == "__main__":
    raise SystemExit(main(default_root=PROJECT_ROOT))
