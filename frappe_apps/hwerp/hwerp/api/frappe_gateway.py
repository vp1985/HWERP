from __future__ import annotations

from decimal import Decimal
import json
from typing import Any


class FrappeQuotationGateway:
	"""Narrow adapter around Frappe used by the tested transfer service."""

	def __init__(self, frappe_module: Any) -> None:
		self.frappe = frappe_module
		self.roles = set(frappe_module.get_roles(frappe_module.session.user))

	def current_user(self) -> str:
		return self.frappe.session.user

	def has_calculation_permission(self, name: str, ptype: str = "read") -> bool:
		return bool(
			self.frappe.has_permission(
				"HWERP Kalkulation",
				ptype,
				doc=name,
				user=self.current_user(),
			)
		)

	def get_calculation(self, name: str) -> dict[str, Any]:
		return dict(self.frappe.get_doc("HWERP Kalkulation", name).as_dict())

	def save_calculation_bundle(
		self,
		existing: dict[str, Any] | None,
		bundle: dict[str, Any],
	) -> dict[str, Any]:
		if existing:
			doc = self.frappe.get_doc("HWERP Kalkulation", existing["name"])
		else:
			doc = self.frappe.get_doc({"doctype": "HWERP Kalkulation"})

		for fieldname, value in bundle.items():
			if fieldname != "name":
				doc.set(fieldname, value)
		if existing:
			doc.save()
		else:
			doc.insert()
		return dict(doc.as_dict())

	def set_calculation_status(
		self,
		calculation: dict[str, Any],
		status: str,
	) -> dict[str, Any]:
		doc = self.frappe.get_doc("HWERP Kalkulation", calculation["name"])
		doc.flags.hwerp_status_change = True
		doc.set("status", status)
		doc.save()
		return dict(doc.as_dict())

	def get_selling_price_list(self, price_group: str) -> str:
		price_list = self.frappe.db.get_value(
			"HWERP Kalkulationspreisgruppe",
			price_group,
			"price_list",
		)
		if not price_list:
			raise ValueError("Für die Preisgruppe ist keine Verkaufspreisliste hinterlegt")
		return str(price_list)

	def find_quotation_by_key(self, key: str) -> str | None:
		return self.frappe.db.get_value(
			"Quotation",
			{"custom_hwerp_transfer_key": key},
			"name",
		)

	def create_quotation(self, payload: dict[str, Any]) -> dict[str, Any]:
		doc = self.frappe.get_doc(payload)
		# Do not bypass ERPNext's standard Quotation create permission.
		doc.insert()
		return {
			"name": doc.name,
			"status": doc.status,
			"items": [{"name": item.name} for item in doc.items],
		}

	def create_transfer_record(
		self,
		calculation: dict[str, Any],
		quotation: dict[str, Any],
		snapshot: dict[str, Any],
	) -> str:
		from frappe.utils import now_datetime

		header = self.frappe.get_doc(
			{
				"doctype": "HWERP Angebotsuebertragung",
				"idempotency_key": snapshot["transfer_key"],
				"calculation": calculation["name"],
				"calculation_number": calculation["name"],
				"calculation_version": calculation.get("version_no", 1),
				"company": calculation["company"],
				"customer": calculation["customer"],
				"quotation": quotation["name"],
				"status": "Erstellt",
				"transferred_at": now_datetime(),
				"transferred_by": self.current_user(),
				"position_count": len(snapshot["items"]),
				"transfer_snapshot": snapshot["snapshot_json"],
			}
		).insert(ignore_permissions=True)

		for quotation_row, source in zip(quotation["items"], snapshot["items"], strict=True):
			qty = Decimal(source["qty"])
			rate = Decimal(source["rate"])
			self.frappe.get_doc(
				{
					"doctype": "HWERP Uebertragungsposition",
					"transfer": header.name,
					"quotation": quotation["name"],
					"quotation_item_id": quotation_row["name"],
					"source_calculation": calculation["name"],
					"source_calculation_number": calculation["name"],
					"source_position_id": source["source_position"],
					"source_version": calculation.get("version_no", 1),
					"item": source.get("item_code"),
					"description": source["description"],
					"quantity": qty,
					"uom": source["uom"],
					"currency": calculation["currency"],
					"rate": rate,
					"amount": qty * rate,
					"main_object_ids": "[]",
					"object_snapshot": json.dumps(
						{"source": source, "snapshot_hash": source["snapshot_hash"]},
						ensure_ascii=False,
						sort_keys=True,
					),
				}
			).insert(ignore_permissions=True)

		return str(header.name)
