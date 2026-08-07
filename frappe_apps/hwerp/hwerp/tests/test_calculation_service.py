from __future__ import annotations

from copy import deepcopy
from typing import Any

import pytest

from hwerp.api.calculation_service import (
	CalculationConflictError,
	change_status_with_gateway,
	save_with_gateway,
)


class FakeCalculationGateway:
	def __init__(self, *, roles: set[str], existing: dict[str, Any] | None = None) -> None:
		self.roles = roles
		self.existing = deepcopy(existing)
		self.saved: list[dict[str, Any]] = []

	def current_user(self) -> str:
		return "user@example.com"

	def has_calculation_permission(self, name: str, ptype: str) -> bool:
		return name == "KALK-1" and ptype == "write"

	def get_calculation(self, name: str) -> dict[str, Any]:
		assert self.existing is not None
		return deepcopy(self.existing)

	def save_calculation_bundle(self, existing: dict[str, Any] | None, bundle: dict[str, Any]) -> dict[str, Any]:
		self.saved.append(deepcopy(bundle))
		return {**bundle, "name": bundle.get("name") or "KALK-NEW", "modified": "v2"}

	def set_calculation_status(self, calculation: dict[str, Any], status: str) -> dict[str, Any]:
		result = {**calculation, "status": status, "modified": "v2"}
		self.saved.append(result)
		return result


def base_existing() -> dict[str, Any]:
	return {
		"name": "KALK-1",
		"modified": "v1",
		"company": "HTV GmbH",
		"customer": "KUNDE-1",
		"status": "Entwurf",
		"title": "Alt",
	}


def base_update() -> dict[str, Any]:
	return {
		"name": "KALK-1",
		"company": "HTV GmbH",
		"customer": "KUNDE-1",
		"title": "Neu",
		"positions": [
			{
				"position_id": "POS-1",
				"position_type": "Material",
				"description": "Material",
				"quantity": 2,
				"uom": "Stk",
			}
		],
	}


def test_save_requires_action_and_record_permission() -> None:
	with pytest.raises(PermissionError):
		save_with_gateway(
			FakeCalculationGateway(roles={"HWERP Quotation Transfer"}, existing=base_existing()),
			base_update(),
			expected_modified="v1",
		)

	gateway = FakeCalculationGateway(roles={"HWERP Calculation User"}, existing=base_existing())
	with pytest.raises(PermissionError):
		save_with_gateway(gateway, {**base_update(), "name": "OTHER"}, expected_modified="v1")


def test_save_uses_optimistic_lock_and_immutable_identity() -> None:
	gateway = FakeCalculationGateway(roles={"HWERP Calculation User"}, existing=base_existing())
	with pytest.raises(CalculationConflictError, match="zwischenzeitlich"):
		save_with_gateway(gateway, base_update(), expected_modified="old")

	with pytest.raises(ValueError, match="Company und Kunde"):
		save_with_gateway(
			gateway,
			{**base_update(), "customer": "KUNDE-2"},
			expected_modified="v1",
		)


def test_cancelled_calculation_is_not_normal_editable() -> None:
	existing = {**base_existing(), "status": "Storniert"}
	gateway = FakeCalculationGateway(roles={"HWERP Calculation User"}, existing=existing)
	with pytest.raises(ValueError, match="stornierte"):
		save_with_gateway(gateway, base_update(), expected_modified="v1")


def test_level_c_cannot_smuggle_price_fields_in_save_bundle() -> None:
	gateway = FakeCalculationGateway(roles={"HWERP Calculation User"}, existing=base_existing())
	payload = base_update()
	payload["positions"][0]["effective_rate"] = 999
	with pytest.raises(PermissionError, match="Preis"):
		save_with_gateway(gateway, payload, expected_modified="v1")


def test_bundle_save_replaces_children_once_and_ignores_server_calculated_fields() -> None:
	gateway = FakeCalculationGateway(
		roles={"HWERP Calculation User", "HWERP Price User"},
		existing=base_existing(),
	)
	payload = {**base_update(), "cost_total": 999, "doctype": "Other", "owner": "attacker"}

	result = save_with_gateway(gateway, payload, expected_modified="v1")

	assert len(gateway.saved) == 1
	assert gateway.saved[0]["positions"] == base_update()["positions"]
	assert "cost_total" not in gateway.saved[0]
	assert "doctype" not in gateway.saved[0]
	assert "owner" not in gateway.saved[0]
	assert result["modified"] == "v2"


def test_approval_and_cancellation_have_separate_server_side_rights() -> None:
	approver = FakeCalculationGateway(
		roles={"HWERP Calculation Approver"},
		existing=base_existing(),
	)
	approved = change_status_with_gateway(
		approver,
		"KALK-1",
		"Freigegeben",
		expected_modified="v1",
	)
	assert approved["status"] == "Freigegeben"

	editor = FakeCalculationGateway(
		roles={"HWERP Calculation User"},
		existing={**base_existing(), "status": "Freigegeben"},
	)
	with pytest.raises(PermissionError):
		change_status_with_gateway(editor, "KALK-1", "Freigegeben", expected_modified="v1")
	assert change_status_with_gateway(
		editor,
		"KALK-1",
		"Storniert",
		expected_modified="v1",
	)["status"] == "Storniert"


def test_cancelled_status_cannot_be_reopened() -> None:
	gateway = FakeCalculationGateway(
		roles={"HWERP Calculation Approver"},
		existing={**base_existing(), "status": "Storniert"},
	)
	with pytest.raises(ValueError, match="nicht zulässig"):
		change_status_with_gateway(gateway, "KALK-1", "Freigegeben", expected_modified="v1")
