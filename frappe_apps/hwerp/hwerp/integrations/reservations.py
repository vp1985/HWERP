from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable


BOOKING_DOCTYPE = "HWERP Ressourcenbelegung"
ALLOWED_RESOURCE_TYPES = {
	"ERPNext Asset",
	"HWERP Technikobjekt",
	"Wiederverwendbares externes Mietmittel",
}


class ReservationConflict(ValueError):
	pass


@dataclass(frozen=True, slots=True)
class ResourceInterval:
	resource_type: str
	resource_id: str
	starts_at: datetime
	ends_at: datetime

	def __post_init__(self) -> None:
		if self.resource_type not in ALLOWED_RESOURCE_TYPES:
			raise ValueError("Dieser Ressourcentyp ist in V1 nicht reservierbar")
		if not self.resource_id.strip():
			raise ValueError("Eine eindeutige Ressourcen-ID ist erforderlich")
		if self.starts_at >= self.ends_at:
			raise ValueError("Beginn muss vor Ende liegen")


def intervals_overlap(left: ResourceInterval, right: ResourceInterval) -> bool:
	if (left.resource_type, left.resource_id) != (right.resource_type, right.resource_id):
		return False
	return left.starts_at < right.ends_at and right.starts_at < left.ends_at


def assert_no_conflict(candidate: ResourceInterval, existing: Iterable[ResourceInterval]) -> None:
	for interval in existing:
		if intervals_overlap(candidate, interval):
			raise ReservationConflict(
			f"Ressource {candidate.resource_id} ist im gewählten Zeitraum bereits reserviert"
		)


def _quotation_names(sales_order: Any) -> set[str]:
	result: set[str] = set()
	for item in getattr(sales_order, "items", []):
		quotation = getattr(item, "prevdoc_docname", None) or getattr(item, "quotation", None)
		if quotation:
			result.add(quotation)
	return result


def _as_interval(booking: Any) -> ResourceInterval:
	return ResourceInterval(
		resource_type=booking.resource_type,
		resource_id=booking.resource_identifier,
		starts_at=booking.starts_at,
		ends_at=booking.ends_at,
	)


def on_sales_order_submit(doc: Any, method: str | None = None) -> None:
	"""Atomically convert quotation soft holds into hard reservations."""
	import frappe

	quotations = _quotation_names(doc)
	if not quotations:
		return

	hold_names = frappe.get_all(
		BOOKING_DOCTYPE,
		filters={
			"quotation": ["in", sorted(quotations)],
			"occupancy_type": "Vormerkung",
			"status": "Aktiv",
		},
		pluck="name",
	)
	for hold_name in hold_names:
		hold = frappe.get_doc(BOOKING_DOCTYPE, hold_name)
		# Lock every booking of the same resource before checking the half-open range.
		locked_names = frappe.db.sql(
			"""
			select name
			from `tabHWERP Ressourcenbelegung`
			where resource_type = %s and resource_identifier = %s
				and occupancy_type = 'Reservierung' and status = 'Aktiv'
			for update
			""",
			(hold.resource_type, hold.resource_identifier),
			pluck=True,
		)
		existing = [
			_as_interval(frappe.get_doc(BOOKING_DOCTYPE, name))
			for name in locked_names
			if name != hold.name
		]
		assert_no_conflict(_as_interval(hold), existing)
		hold.db_set(
			{
				"occupancy_type": "Reservierung",
				"sales_order": doc.name,
			},
			update_modified=True,
		)


def on_sales_order_cancel(doc: Any, method: str | None = None) -> None:
	import frappe

	for name in frappe.get_all(
		BOOKING_DOCTYPE,
		filters={"sales_order": doc.name, "occupancy_type": "Reservierung", "status": "Aktiv"},
		pluck="name",
	):
		frappe.db.set_value(
			BOOKING_DOCTYPE,
			name,
			{"status": "Beendet", "release_reason": "Sales Order storniert"},
		)


def on_sales_order_update_after_submit(doc: Any, method: str | None = None) -> None:
	"""Revalidate existing hard reservations after an allowed date amendment."""
	import frappe

	bookings = [
		frappe.get_doc(BOOKING_DOCTYPE, name)
		for name in frappe.get_all(
			BOOKING_DOCTYPE,
			filters={"sales_order": doc.name, "occupancy_type": "Reservierung", "status": "Aktiv"},
			pluck="name",
		)
	]
	for booking in bookings:
		other_names = frappe.get_all(
			BOOKING_DOCTYPE,
			filters={
				"resource_type": booking.resource_type,
				"resource_identifier": booking.resource_identifier,
				"occupancy_type": "Reservierung",
				"status": "Aktiv",
				"name": ["!=", booking.name],
			},
			pluck="name",
		)
		assert_no_conflict(
			_as_interval(booking),
			(_as_interval(frappe.get_doc(BOOKING_DOCTYPE, name)) for name in other_names),
		)


def release_expired_soft_holds() -> None:
	import frappe
	from frappe.utils import now_datetime

	for name in frappe.get_all(
		BOOKING_DOCTYPE,
		filters={
			"occupancy_type": "Vormerkung",
			"status": "Aktiv",
			"ends_at": ["<=", now_datetime()],
		},
		pluck="name",
	):
		frappe.db.set_value(
			BOOKING_DOCTYPE,
			name,
			{"status": "Beendet", "release_reason": "Vormerkungsende erreicht"},
		)
