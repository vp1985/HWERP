from __future__ import annotations

from hwerp.permissions import (
	Action,
	PriceLevel,
	can,
	price_level_for_roles,
	redact_price_data,
)


def test_price_level_uses_existing_frappe_roles() -> None:
	assert price_level_for_roles({"HWERP Price User"}) is PriceLevel.A
	assert price_level_for_roles({"HWERP Price Reviewer"}) is PriceLevel.B
	assert price_level_for_roles({"HWERP Calculation User"}) is PriceLevel.C
	assert price_level_for_roles({"System Manager"}) is PriceLevel.A


def test_price_blind_response_omits_sensitive_values_recursively() -> None:
	payload = {
		"name": "KALK-0001",
		"customer": "Kunde A",
		"total_price": 1200,
		"items": [
			{
				"description": "Montage",
				"quantity": 2,
				"unit_price": 600,
				"internal_cost": 400,
				"snapshot": {"margin_percent": 20, "risk_amount": 50},
			}
		],
	}

	result = redact_price_data(payload, PriceLevel.C, current_user="c@example.com")

	assert result == {
		"name": "KALK-0001",
		"customer": "Kunde A",
		"items": [{"description": "Montage", "quantity": 2, "snapshot": {}}],
	}
	assert "***" not in repr(result)


def test_price_blind_user_sees_only_own_proposal_without_effective_prices() -> None:
	payload = {
		"price_proposals": [
			{"owner": "c@example.com", "proposed_price": 900, "status": "Open", "effective_price": 1000},
			{"owner": "other@example.com", "proposed_price": 800, "status": "Open"},
		]
	}

	result = redact_price_data(payload, PriceLevel.C, current_user="c@example.com")

	assert result == {
		"price_proposals": [
			{"owner": "c@example.com", "proposed_price": 900, "status": "Open"},
		]
	}


def test_price_roles_receive_complete_payload_copy() -> None:
	payload = {"total_price": 1200, "nested": {"internal_cost": 800}}
	assert redact_price_data(payload, PriceLevel.A, current_user="a@example.com") == payload
	assert redact_price_data(payload, PriceLevel.B, current_user="b@example.com") == payload
	assert redact_price_data(payload, PriceLevel.A, current_user="a@example.com") is not payload


def test_action_matrix_requires_separate_business_roles() -> None:
	roles = {"HWERP Calculation User"}
	assert can(Action.EDIT_CALCULATION, roles)
	assert not can(Action.APPROVE_CALCULATION, roles)
	assert not can(Action.TRANSFER_QUOTATION, roles)
	assert not can(Action.CREATE_ITEM, roles)

	assert can(Action.APPROVE_CALCULATION, {"HWERP Calculation Approver"})
	assert can(Action.TRANSFER_QUOTATION, {"HWERP Quotation Transfer"})
	assert can(Action.CREATE_ITEM, {"HWERP Item Creator"})
