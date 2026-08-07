from __future__ import annotations

from hwerp.custom_fields import setup_custom_fields
from hwerp.permissions import (
	ROLE_CALCULATION_APPROVER,
	ROLE_CALCULATION_USER,
	ROLE_ITEM_CREATOR,
	ROLE_ITEM_PRICE_MANAGER,
	ROLE_PARTICIPANT_MANAGER,
	ROLE_PRICE_REVIEWER,
	ROLE_PRICE_USER,
	ROLE_PRICING_RULE_MANAGER,
	ROLE_QUOTATION_TRANSFER,
	ROLE_RESERVATION_MANAGER,
	ROLE_SUBMITTED_QUOTATION_EDITOR,
)

REQUIRED_ROLES = (
	ROLE_CALCULATION_USER,
	ROLE_CALCULATION_APPROVER,
	ROLE_PRICE_REVIEWER,
	ROLE_PRICE_USER,
	ROLE_QUOTATION_TRANSFER,
	ROLE_SUBMITTED_QUOTATION_EDITOR,
	ROLE_ITEM_CREATOR,
	ROLE_ITEM_PRICE_MANAGER,
	ROLE_PRICING_RULE_MANAGER,
	ROLE_PARTICIPANT_MANAGER,
	ROLE_RESERVATION_MANAGER,
)


def after_install() -> None:
	_apply_metadata()


def after_migrate() -> None:
	_apply_metadata()


def _apply_metadata() -> None:
	ensure_roles()
	setup_custom_fields()


def ensure_roles() -> None:
	import frappe

	for role_name in REQUIRED_ROLES:
		if frappe.db.exists("Role", role_name):
			continue
		frappe.get_doc(
			{
				"doctype": "Role",
				"role_name": role_name,
				"desk_access": 1,
			}
		).insert(ignore_permissions=True)
