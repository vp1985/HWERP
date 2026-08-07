from __future__ import annotations

from types import SimpleNamespace

from hwerp.record_permissions import has_record_access


def calculation(**overrides):
	values = {
		"name": "KALK-1",
		"owner": "owner@example.com",
		"responsible_user": "responsible@example.com",
		"participants": [
			{"user": "reader@example.com", "access_level": "Lesen", "active": 1},
			{"user": "editor@example.com", "access_level": "Bearbeiten", "active": 1},
		],
	}
	values.update(overrides)
	return SimpleNamespace(**values)


def test_system_manager_and_direct_owners_have_record_access() -> None:
	doc = calculation()
	assert has_record_access(doc, "any@example.com", {"System Manager"}, "read")
	assert has_record_access(doc, "owner@example.com", {"HWERP Calculation User"}, "write")
	assert has_record_access(doc, "responsible@example.com", {"HWERP Calculation User"}, "write")


def test_participant_access_level_is_enforced_server_side() -> None:
	doc = calculation()
	assert has_record_access(doc, "reader@example.com", {"HWERP Calculation User"}, "read")
	assert not has_record_access(doc, "reader@example.com", {"HWERP Calculation User"}, "write")
	assert has_record_access(doc, "editor@example.com", {"HWERP Calculation User"}, "write")


def test_action_role_alone_does_not_bypass_record_membership() -> None:
	doc = calculation()
	assert not has_record_access(doc, "stranger@example.com", {"HWERP Calculation Approver"}, "read")
	assert not has_record_access(doc, "stranger@example.com", {"HWERP Price User"}, "write")


def test_create_checks_action_role_without_existing_membership() -> None:
	assert has_record_access(None, "user@example.com", {"HWERP Calculation User"}, "create")
	assert not has_record_access(None, "user@example.com", {"HWERP Quotation Transfer"}, "create")
