from __future__ import annotations

from copy import deepcopy
from enum import Enum
from typing import Any, Mapping


class PriceLevel(str, Enum):
	A = "A"
	B = "B"
	C = "C"


class Action(str, Enum):
	VIEW_CALCULATION = "view_calculation"
	EDIT_CALCULATION = "edit_calculation"
	APPROVE_CALCULATION = "approve_calculation"
	TRANSFER_QUOTATION = "transfer_quotation"
	CHANGE_SUBMITTED_QUOTATION = "change_submitted_quotation"
	CREATE_ITEM = "create_item"
	WRITE_ITEM_PRICE = "write_item_price"
	MANAGE_PRICING_RULES = "manage_pricing_rules"
	MANAGE_PARTICIPANTS = "manage_participants"
	MANUAL_RESERVATION_RELEASE = "manual_reservation_release"


ROLE_PRICE_USER = "HWERP Price User"
ROLE_PRICE_REVIEWER = "HWERP Price Reviewer"
ROLE_CALCULATION_USER = "HWERP Calculation User"
ROLE_CALCULATION_APPROVER = "HWERP Calculation Approver"
ROLE_QUOTATION_TRANSFER = "HWERP Quotation Transfer"
ROLE_SUBMITTED_QUOTATION_EDITOR = "HWERP Submitted Quotation Editor"
ROLE_ITEM_CREATOR = "HWERP Item Creator"
ROLE_ITEM_PRICE_MANAGER = "HWERP Item Price Manager"
ROLE_PRICING_RULE_MANAGER = "HWERP Pricing Rule Manager"
ROLE_PARTICIPANT_MANAGER = "HWERP Participant Manager"
ROLE_RESERVATION_MANAGER = "HWERP Reservation Manager"
SYSTEM_MANAGER = "System Manager"

_ACTION_ROLES: dict[Action, frozenset[str]] = {
	Action.VIEW_CALCULATION: frozenset(
		{ROLE_CALCULATION_USER, ROLE_PRICE_USER, ROLE_PRICE_REVIEWER, ROLE_CALCULATION_APPROVER}
	),
	Action.EDIT_CALCULATION: frozenset({ROLE_CALCULATION_USER, ROLE_PRICE_USER, ROLE_PRICE_REVIEWER}),
	Action.APPROVE_CALCULATION: frozenset({ROLE_CALCULATION_APPROVER}),
	Action.TRANSFER_QUOTATION: frozenset({ROLE_QUOTATION_TRANSFER}),
	Action.CHANGE_SUBMITTED_QUOTATION: frozenset({ROLE_SUBMITTED_QUOTATION_EDITOR}),
	Action.CREATE_ITEM: frozenset({ROLE_ITEM_CREATOR}),
	Action.WRITE_ITEM_PRICE: frozenset({ROLE_ITEM_PRICE_MANAGER}),
	Action.MANAGE_PRICING_RULES: frozenset({ROLE_PRICING_RULE_MANAGER}),
	Action.MANAGE_PARTICIPANTS: frozenset({ROLE_PARTICIPANT_MANAGER}),
	Action.MANUAL_RESERVATION_RELEASE: frozenset({ROLE_RESERVATION_MANAGER}),
}

SENSITIVE_PRICE_FIELDS = frozenset(
	{
		"amount",
		"base_amount",
		"base_net_amount",
		"base_net_rate",
		"base_rate",
		"cost",
		"cost_basis",
		"cost_total",
		"condition_json",
		"discount_amount",
		"discount_percent",
		"discount_percentage",
		"effective_price",
		"effective_rate",
		"grand_total",
		"internal_cost",
		"internal_cost_amount",
		"internal_cost_rate",
		"line_amount",
		"margin",
		"margin_amount",
		"margin_percent",
		"minimum_selling_price",
		"net_amount",
		"net_rate",
		"price",
		"price_list_rate",
		"pricing_rule_rate",
		"proposed_price",
		"purchase_rate",
		"rate",
		"risk_amount",
		"risk_percent",
		"rule_value",
		"rounded_total",
		"target_price",
		"target_margin",
		"target_selling_price",
		"gross_selling_amount",
		"net_selling_amount",
		"partial_margin_amount",
		"submitted_amount",
		"reviewed_amount",
		"source_net_amount",
		"allocated_net_amount",
		"percent_value",
		"payload",
		"transfer_snapshot",
		"snapshot_json",
		"object_snapshot",
		"divergence_snapshot",
		"total",
		"total_cost",
		"total_price",
		"unit_price",
		"valuation_rate",
	}
)


class _Omitted:
	pass


_OMITTED = _Omitted()


def price_level_for_roles(roles: set[str] | frozenset[str]) -> PriceLevel:
	if SYSTEM_MANAGER in roles or ROLE_PRICE_USER in roles:
		return PriceLevel.A
	if ROLE_PRICE_REVIEWER in roles:
		return PriceLevel.B
	return PriceLevel.C


def can(action: Action, roles: set[str] | frozenset[str]) -> bool:
	return SYSTEM_MANAGER in roles or bool(_ACTION_ROLES[action].intersection(roles))


def redact_price_data(payload: Any, level: PriceLevel, current_user: str) -> Any:
	"""Return a copy that contains no protected values for price level C.

	Redaction means omission, never visual masking. This helper is used before
	serialising API, report, audit and print payloads.
	"""
	if level in (PriceLevel.A, PriceLevel.B):
		return deepcopy(payload)
	return _redact(payload, current_user=current_user, parent_key=None)


def _redact(value: Any, *, current_user: str, parent_key: str | None) -> Any:
	if isinstance(value, list):
		redacted_entries: list[Any] = []
		for entry in value:
			redacted = _redact(entry, current_user=current_user, parent_key=parent_key)
			if redacted is not _OMITTED:
				redacted_entries.append(redacted)
		return redacted_entries

	if not isinstance(value, Mapping):
		return deepcopy(value)

	fieldname = value.get("fieldname")
	if isinstance(fieldname, str) and fieldname in SENSITIVE_PRICE_FIELDS:
		return _OMITTED

	if parent_key == "price_proposals":
		if value.get("owner") != current_user:
			return _OMITTED
		return {
			key: deepcopy(item)
			for key, item in value.items()
			if key in {"owner", "proposed_price", "status", "creation", "modified"}
		}

	result: dict[str, Any] = {}
	for key, item in value.items():
		if key in SENSITIVE_PRICE_FIELDS:
			continue
		redacted = _redact(item, current_user=current_user, parent_key=key)
		if redacted is not _OMITTED:
			result[key] = redacted
	return result
