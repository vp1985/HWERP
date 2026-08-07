from __future__ import annotations

from pathlib import Path

from hwerp.image_setup import register_app
from hwerp.install import REQUIRED_ROLES


def test_image_app_registration_handles_missing_trailing_newline_idempotently(tmp_path: Path) -> None:
	apps_file = tmp_path / "apps.txt"
	apps_file.write_text("frappe\nerpnext\ncrm", encoding="utf-8")

	register_app(apps_file)
	register_app(apps_file)

	assert apps_file.read_text(encoding="utf-8") == "frappe\nerpnext\ncrm\nhwerp\n"


def test_required_roles_cover_every_separate_v1_action() -> None:
	assert set(REQUIRED_ROLES) == {
		"HWERP Calculation User",
		"HWERP Calculation Approver",
		"HWERP Price Reviewer",
		"HWERP Price User",
		"HWERP Quotation Transfer",
		"HWERP Submitted Quotation Editor",
		"HWERP Item Creator",
		"HWERP Item Price Manager",
		"HWERP Pricing Rule Manager",
		"HWERP Participant Manager",
		"HWERP Reservation Manager",
	}
