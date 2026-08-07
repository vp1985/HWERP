from __future__ import annotations

from typing import Any

import pytest

from hwerp.api.quotation import transfer_with_gateway


class FakeGateway:
	def __init__(self, *, roles: set[str], existing: str | None = None) -> None:
		self.roles = roles
		self.existing = existing
		self.created_payloads: list[dict[str, Any]] = []
		self.transfer_snapshots: list[dict[str, Any]] = []

	def current_user(self) -> str:
		return "user@example.com"

	def has_calculation_permission(self, name: str) -> bool:
		return name == "HWERP-KALK-2026-00001"

	def get_calculation(self, name: str) -> dict[str, Any]:
		return {
			"name": name,
			"status": "Freigegeben",
			"company": "HTV GmbH",
			"customer": "KUNDE-0001",
			"currency": "EUR",
			"price_group": "STANDARD",
			"version_no": 1,
			"modified": "2026-08-07 12:00:00.000000",
			"positions": [
				{
					"position_id": "POS-1",
					"item": "MAT-1",
					"description": "Material",
					"quantity": 2,
					"uom": "Stk",
					"effective_rate": 100,
				}
			],
		}

	def get_selling_price_list(self, price_group: str) -> str:
		return "Standardverkauf"

	def find_quotation_by_key(self, key: str) -> str | None:
		return self.existing

	def create_quotation(self, payload: dict[str, Any]) -> dict[str, Any]:
		self.created_payloads.append(payload)
		return {"name": "QTN-0001", "status": "Draft", "items": [{"name": "QI-1"}]}

	def create_transfer_record(
		self,
		calculation: dict[str, Any],
		quotation: dict[str, Any],
		snapshot: dict[str, Any],
	) -> str:
		self.transfer_snapshots.append(snapshot)
		return "HWERP-TR-2026-00001"


def test_transfer_requires_server_side_action_and_record_permission() -> None:
	with pytest.raises(PermissionError):
		transfer_with_gateway(
			FakeGateway(roles={"HWERP Calculation User"}),
			"HWERP-KALK-2026-00001",
			"request-1",
		)

	gateway = FakeGateway(roles={"HWERP Quotation Transfer"})
	with pytest.raises(PermissionError):
		transfer_with_gateway(gateway, "NOT-ALLOWED", "request-1")


def test_retry_returns_same_quotation_without_duplicate_creation() -> None:
	gateway = FakeGateway(roles={"HWERP Quotation Transfer"}, existing="QTN-0001")
	result = transfer_with_gateway(gateway, "HWERP-KALK-2026-00001", "request-1")

	assert result == {"quotation": "QTN-0001", "idempotent_replay": True}
	assert gateway.created_payloads == []
	assert gateway.transfer_snapshots == []


def test_transfer_creates_standard_quotation_and_independent_snapshot_once() -> None:
	gateway = FakeGateway(roles={"HWERP Quotation Transfer"})
	result = transfer_with_gateway(gateway, "HWERP-KALK-2026-00001", "request-1")

	assert result == {
		"quotation": "QTN-0001",
		"transfer": "HWERP-TR-2026-00001",
		"idempotent_replay": False,
	}
	assert len(gateway.created_payloads) == 1
	assert gateway.created_payloads[0]["doctype"] == "Quotation"
	assert gateway.created_payloads[0]["items"][0]["rate"] == "100"
	assert len(gateway.transfer_snapshots) == 1
	assert gateway.transfer_snapshots[0]["source_calculation"] == "HWERP-KALK-2026-00001"
