from __future__ import annotations

import subprocess
import sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[2]
MONOREPO_ROOT = APP_ROOT.parents[1]
PROJECT_ROOT = MONOREPO_ROOT if (MONOREPO_ROOT / "scripts").is_dir() else APP_ROOT
CHECKER_COMMAND = [sys.executable, "-m", "hwerp.branding"]


def test_branding_checker_is_available_inside_the_packaged_app(tmp_path: Path) -> None:
    result = subprocess.run(
        [*CHECKER_COMMAND, str(tmp_path)],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert "HWERP namespace check passed" in result.stdout


def test_branding_checker_reports_forbidden_namespace(tmp_path: Path) -> None:
    retired_namespace = "hw" + "os"
    source = tmp_path / "legacy.py"
    source.write_text(
        f'ENDPOINT = "{retired_namespace}.api.v1.calculations.get"\n',
        encoding="utf-8",
    )

    result = subprocess.run(
        [*CHECKER_COMMAND, str(tmp_path)],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 1
    assert "legacy.py" in result.stdout
    assert retired_namespace in result.stdout


def test_branding_checker_is_case_insensitive(tmp_path: Path) -> None:
    retired_namespace = "hw" + "OS"
    source = tmp_path / "mixed-case.html"
    source.write_text(f"<title>{retired_namespace}</title>\n", encoding="utf-8")

    result = subprocess.run(
        [*CHECKER_COMMAND, str(tmp_path)],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 1
    assert "mixed-case.html" in result.stdout


def test_branding_checker_rejects_retired_long_product_name(tmp_path: Path) -> None:
    retired_product = "Handwerk" + "OS"
    source = tmp_path / "legacy.ts"
    source.write_text(f"const storageKey = '{retired_product}';\n", encoding="utf-8")

    result = subprocess.run(
        [*CHECKER_COMMAND, str(tmp_path)],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 1
    assert "legacy.ts" in result.stdout
    assert retired_product.casefold() in result.stdout.casefold()


def test_repository_uses_only_hwerp_namespace() -> None:
    result = subprocess.run(
        [*CHECKER_COMMAND, str(PROJECT_ROOT)],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stdout
