"""Image-build helpers for registering HWERP with a Frappe bench."""

from __future__ import annotations

import argparse
from pathlib import Path

DEFAULT_APPS_FILE = Path("/home/frappe/frappe-bench/sites/apps.txt")


def register_app(apps_file: Path, app_name: str = "hwerp") -> None:
	apps = [line.strip() for line in apps_file.read_text(encoding="utf-8").splitlines() if line.strip()]
	if app_name not in apps:
		apps.append(app_name)
	apps_file.write_text("\n".join(apps) + "\n", encoding="utf-8")


def main() -> int:
	parser = argparse.ArgumentParser()
	parser.add_argument("apps_file", nargs="?", type=Path, default=DEFAULT_APPS_FILE)
	args = parser.parse_args()
	register_app(args.apps_file)
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
