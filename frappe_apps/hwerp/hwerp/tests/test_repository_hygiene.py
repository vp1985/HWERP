from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

APP_ROOT = Path(__file__).resolve().parents[2]
MONOREPO_ROOT = APP_ROOT.parents[1]
PROJECT_ROOT = MONOREPO_ROOT if (MONOREPO_ROOT / "scripts").is_dir() else APP_ROOT
CHECKER_COMMAND = [sys.executable, "-m", "hwerp.repository_hygiene"]


def run_checker(root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [*CHECKER_COMMAND, str(root)],
        check=False,
        capture_output=True,
        text=True,
    )


def test_hygiene_checker_is_available_inside_the_packaged_app(tmp_path: Path) -> None:
    result = subprocess.run(
        [*CHECKER_COMMAND, str(tmp_path)],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert "Repository hygiene check passed" in result.stdout


def test_hygiene_checker_rejects_non_reserved_fixture_email_domain(tmp_path: Path) -> None:
    domain = "customer" + ".de"
    (tmp_path / "fixture.ts").write_text(f"email: 'person@{domain}'\n", encoding="utf-8")

    result = run_checker(tmp_path)

    assert result.returncode == 1
    assert "fixture.ts" in result.stdout
    assert domain in result.stdout
    assert "person@" not in result.stdout


def test_hygiene_checker_allows_reserved_and_publisher_domains(tmp_path: Path) -> None:
    (tmp_path / "fixture.ts").write_text(
        "emails = ['demo@example.com', 'user@example.test', 'info@ht-v.de']\n",
        encoding="utf-8",
    )

    result = run_checker(tmp_path)

    assert result.returncode == 0, result.stdout


def test_repository_contains_only_publishable_fixture_domains() -> None:
    result = run_checker(PROJECT_ROOT)

    assert result.returncode == 0, result.stdout


def test_docker_image_registers_hwerp_in_frappe_apps_txt() -> None:
    dockerfile = PROJECT_ROOT / "Dockerfile"
    if not dockerfile.is_file():
        pytest.skip("repository-level Dockerfile is not part of the installed app layout")

    content = dockerfile.read_text(encoding="utf-8")
    assert "/home/frappe/frappe-bench/sites/apps.txt" in content
    assert "-m hwerp.image_setup" in content
