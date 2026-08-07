from __future__ import annotations

from copy import deepcopy
from typing import Any, Mapping, Protocol

from hwerp.permissions import (
	Action,
	PriceLevel,
	SENSITIVE_PRICE_FIELDS,
	can,
	price_level_for_roles,
	redact_price_data,
)


class CalculationConflictError(RuntimeError):
	pass


class CalculationSaveGateway(Protocol):
	roles: set[str]

	def current_user(self) -> str: ...

	def has_calculation_permission(self, name: str, ptype: str) -> bool: ...

	def get_calculation(self, name: str) -> dict[str, Any]: ...

	def save_calculation_bundle(
		self,
		existing: dict[str, Any] | None,
		bundle: dict[str, Any],
	) -> dict[str, Any]: ...

	def set_calculation_status(
		self,
		calculation: dict[str, Any],
		status: str,
	) -> dict[str, Any]: ...


_EDITABLE_FIELDS = frozenset(
	{
		"name",
		"title",
		"company",
		"customer",
		"project",
		"responsible_user",
		"price_group",
		"is_sensitive",
		"participants",
		"main_objects",
		"positions",
		"risk_percent",
		"target_margin",
		"discount_percent",
		"discount_amount",
		"notes",
		"internal_notes",
	}
)


def _contains_sensitive_key(value: Any) -> bool:
	if isinstance(value, Mapping):
		return any(
			key in SENSITIVE_PRICE_FIELDS or _contains_sensitive_key(item)
			for key, item in value.items()
		)
	if isinstance(value, list | tuple):
		return any(_contains_sensitive_key(item) for item in value)
	return False


def save_with_gateway(
	gateway: CalculationSaveGateway,
	payload: Mapping[str, Any],
	*,
	expected_modified: str | None,
) -> dict[str, Any]:
	roles = gateway.roles
	if not can(Action.EDIT_CALCULATION, roles):
		raise PermissionError("Keine Berechtigung zum Bearbeiten von Kalkulationen")

	level = price_level_for_roles(roles)
	if level is PriceLevel.C and _contains_sensitive_key(payload):
		raise PermissionError("Geschützte Preiswerte dürfen nicht gespeichert werden")

	name = str(payload.get("name") or "").strip()
	existing: dict[str, Any] | None = None
	if name:
		if not gateway.has_calculation_permission(name, "write"):
			raise PermissionError("Kein Schreibzugriff auf die Kalkulation")
		existing = gateway.get_calculation(name)
		if existing.get("status") == "Storniert":
			raise ValueError("Eine stornierte Kalkulation ist nicht normal bearbeitbar")
		if not expected_modified or str(existing.get("modified")) != expected_modified:
			raise CalculationConflictError("Die Kalkulation wurde zwischenzeitlich geändert")
		if (
			payload.get("company") != existing.get("company")
			or payload.get("customer") != existing.get("customer")
		):
			raise ValueError("Company und Kunde einer bestehenden Kalkulation sind unveränderlich")

	bundle = {
		key: deepcopy(value)
		for key, value in payload.items()
		if key in _EDITABLE_FIELDS
	}
	if not bundle.get("company") or not bundle.get("customer"):
		raise ValueError("Company und Kunde sind Pflichtfelder")
	for table_field in ("participants", "main_objects", "positions"):
		bundle.setdefault(table_field, [])

	saved = gateway.save_calculation_bundle(existing, bundle)
	return redact_price_data(saved, level, gateway.current_user())


def change_status_with_gateway(
	gateway: CalculationSaveGateway,
	calculation_name: str,
	target_status: str,
	*,
	expected_modified: str | None,
) -> dict[str, Any]:
	roles = gateway.roles
	required_action = (
		Action.APPROVE_CALCULATION
		if target_status == "Freigegeben"
		else Action.EDIT_CALCULATION
	)
	if target_status not in {"Freigegeben", "Storniert"} or not can(required_action, roles):
		raise PermissionError("Keine Berechtigung für diese Statusänderung")
	if not gateway.has_calculation_permission(calculation_name, "write"):
		raise PermissionError("Kein Schreibzugriff auf die Kalkulation")

	calculation = gateway.get_calculation(calculation_name)
	if not expected_modified or str(calculation.get("modified")) != expected_modified:
		raise CalculationConflictError("Die Kalkulation wurde zwischenzeitlich geändert")
	current_status = calculation.get("status")
	allowed = {
		("Entwurf", "Freigegeben"),
		("Entwurf", "Storniert"),
		("Freigegeben", "Storniert"),
	}
	if (current_status, target_status) not in allowed:
		raise ValueError("Diese Statusänderung ist nicht zulässig")

	saved = gateway.set_calculation_status(calculation, target_status)
	level = price_level_for_roles(roles)
	return redact_price_data(saved, level, gateway.current_user())
