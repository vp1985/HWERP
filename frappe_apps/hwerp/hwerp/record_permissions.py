from __future__ import annotations

from typing import Any

from hwerp.permissions import Action, SYSTEM_MANAGER, can


def _participant_value(participant: Any, fieldname: str) -> Any:
	if isinstance(participant, dict):
		return participant.get(fieldname)
	return getattr(participant, fieldname, None)


def _required_action(ptype: str) -> Action:
	if ptype == "submit":
		return Action.APPROVE_CALCULATION
	if ptype in {"create", "write", "delete", "cancel"}:
		return Action.EDIT_CALCULATION
	return Action.VIEW_CALCULATION


def has_record_access(doc: Any | None, user: str, roles: set[str], ptype: str) -> bool:
	if SYSTEM_MANAGER in roles:
		return True
	if not can(_required_action(ptype), roles):
		return False
	if ptype == "create" or doc is None or not getattr(doc, "name", None):
		return True
	if user in {getattr(doc, "owner", None), getattr(doc, "responsible_user", None)}:
		return True

	for participant in getattr(doc, "participants", ()) or ():
		if not _participant_value(participant, "active"):
			continue
		if _participant_value(participant, "user") != user:
			continue
		if ptype in {"create", "write", "delete", "cancel", "submit"}:
			return _participant_value(participant, "access_level") == "Bearbeiten"
		return True
	return False


def get_calculation_permission_query_conditions(user: str | None = None) -> str:
	import frappe

	user = user or frappe.session.user
	if user == "Administrator" or SYSTEM_MANAGER in set(frappe.get_roles(user)):
		return ""
	escaped_user = frappe.db.escape(user)
	return f"""(
		`tabHWERP Kalkulation`.`owner` = {escaped_user}
		or `tabHWERP Kalkulation`.`responsible_user` = {escaped_user}
		or exists (
			select 1 from `tabHWERP Teilnehmer` participant
			where participant.parent = `tabHWERP Kalkulation`.`name`
				and participant.parenttype = 'HWERP Kalkulation'
				and participant.parentfield = 'participants'
				and participant.user = {escaped_user}
				and participant.active = 1
		)
	)"""


def has_calculation_permission(doc: Any, ptype: str, user: str | None = None) -> bool:
	import frappe

	user = user or frappe.session.user
	return has_record_access(doc, user, set(frappe.get_roles(user)), ptype)
