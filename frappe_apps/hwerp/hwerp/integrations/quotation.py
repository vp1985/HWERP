from __future__ import annotations

from decimal import Decimal, InvalidOperation
from copy import deepcopy
from hashlib import sha256
import json
from typing import Any, Mapping


class TransferValidationError(ValueError):
	pass


class SubmittedQuotationChangeError(ValueError):
	pass


def _required(calculation: Mapping[str, Any], field: str, message: str) -> Any:
	value = calculation.get(field)
	if value in (None, ""):
		raise TransferValidationError(message)
	return value


def _decimal(value: Any, *, field: str) -> Decimal:
	try:
		return Decimal(str(value))
	except (InvalidOperation, ValueError) as exc:
		raise TransferValidationError(f"Ungültiger Zahlenwert für {field}") from exc


def _decimal_text(value: Decimal) -> str:
	return format(value, "f")


def _validate_transfer(calculation: Mapping[str, Any], transfer_key: str) -> None:
	if calculation.get("status") != "Freigegeben":
		raise TransferValidationError("Nur freigegebene Kalkulationen dürfen übertragen werden")
	_required(calculation, "name", "Kalkulationsnummer fehlt")
	_required(calculation, "customer", "Kunde fehlt")
	_required(calculation, "company", "Company fehlt")
	_required(calculation, "currency", "Währung fehlt")
	_required(calculation, "selling_price_list", "Verkaufspreisliste fehlt")
	if not transfer_key or not transfer_key.strip():
		raise TransferValidationError("Idempotency-Key fehlt")
	if not calculation.get("items"):
		raise TransferValidationError("Die Kalkulation enthält keine übertragbaren Positionen")


def calculation_doc_to_transfer_mapping(
	doc: Mapping[str, Any], *, selling_price_list: str
) -> dict[str, Any]:
	"""Translate the versioned HWERP DocType into the ERPNext transfer contract."""
	positions = []
	for position in doc.get("positions", []):
		positions.append(
			{
				"name": position.get("position_id") or position.get("name"),
				"item_code": position.get("item"),
				"description": position.get("description"),
				"qty": position.get("quantity"),
				"uom": position.get("uom"),
				"rate": position.get("effective_rate"),
			}
		)
	return {
		"name": doc.get("name"),
		"status": doc.get("status"),
		"company": doc.get("company"),
		"customer": doc.get("customer"),
		"currency": doc.get("currency"),
		"selling_price_list": selling_price_list,
		"modified": str(doc.get("modified") or ""),
		"items": positions,
	}


def build_quotation_payload(calculation: Mapping[str, Any], *, transfer_key: str) -> dict[str, Any]:
	_validate_transfer(calculation, transfer_key)
	quotation_items: list[dict[str, Any]] = []

	for source in calculation["items"]:
		description = str(source.get("description") or "").strip()
		if not description:
			raise TransferValidationError("Eine Angebotsposition hat keine Beschreibung")
		qty = _decimal(source.get("qty"), field="Menge")
		rate = _decimal(source.get("rate"), field="Preis")
		if qty <= 0:
			raise TransferValidationError("Die Menge muss größer als null sein")
		if rate < 0:
			raise TransferValidationError("Der Preis darf nicht negativ sein")
		uom = str(source.get("uom") or "").strip()
		if not uom:
			raise TransferValidationError("Eine Angebotsposition hat keine Einheit")

		row: dict[str, Any] = {
			"item_name": str(source.get("item_name") or description),
			"description": description,
			"qty": _decimal_text(qty),
			"uom": uom,
			"conversion_factor": "1",
			"rate": _decimal_text(rate),
			"amount": _decimal_text(qty * rate),
			"custom_hwerp_source_calculation": calculation["name"],
			"custom_hwerp_source_position": source.get("name"),
		}
		if source.get("item_code"):
			row["item_code"] = source["item_code"]
		quotation_items.append(row)

	snapshot = build_transfer_snapshot(calculation, transfer_key=transfer_key)
	for row, source_snapshot in zip(quotation_items, snapshot["items"], strict=True):
		row["custom_hwerp_transfer_snapshot_hash"] = source_snapshot["snapshot_hash"]

	return {
		"doctype": "Quotation",
		"quotation_to": "Customer",
		"party_name": calculation["customer"],
		"company": calculation["company"],
		"currency": calculation["currency"],
		"selling_price_list": calculation["selling_price_list"],
		"custom_hwerp_calculation": calculation["name"],
		"custom_hwerp_transfer_key": transfer_key.strip(),
		"items": quotation_items,
	}


def build_transfer_snapshot(calculation: Mapping[str, Any], *, transfer_key: str) -> dict[str, Any]:
	_validate_transfer(calculation, transfer_key)
	item_snapshots: list[dict[str, Any]] = []
	for source in calculation["items"]:
		canonical = {
			"source_position": source.get("name"),
			"item_code": source.get("item_code"),
			"description": source.get("description"),
			"qty": str(source.get("qty")),
			"uom": source.get("uom"),
			"rate": str(source.get("rate")),
		}
		serialized = json.dumps(canonical, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
		item_snapshots.append(
			{
				**canonical,
				"snapshot_json": serialized,
				"snapshot_hash": sha256(serialized.encode("utf-8")).hexdigest(),
			}
		)

	root = {
		"source_calculation": calculation["name"],
		"source_modified": calculation.get("modified"),
		"company": calculation["company"],
		"customer": calculation["customer"],
		"currency": calculation["currency"],
		"transfer_key": transfer_key.strip(),
		"items": item_snapshots,
	}
	serialized_root = json.dumps(root, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
	return {
		**root,
		"snapshot_json": serialized_root,
		"snapshot_hash": sha256(serialized_root.encode("utf-8")).hexdigest(),
	}


def validate_submitted_quotation_change(
	before: Mapping[str, Any],
	after: Mapping[str, Any],
	*,
	expected_modified: str,
	confirmed: bool,
	follow_up_documents: list[str] | None = None,
	follow_ups_acknowledged: bool = False,
) -> dict[str, Any]:
	"""Validate the deliberately narrow V1 exception for submitted quotations."""
	if not confirmed:
		raise SubmittedQuotationChangeError("Eine ausdrückliche Bestätigung ist erforderlich")
	if before.get("docstatus") != 1:
		raise SubmittedQuotationChangeError("Das Angebot ist nicht eingereicht")
	if not before.get("custom_hwerp_calculation"):
		raise SubmittedQuotationChangeError("Das Angebot stammt nicht aus einer HWERP-Kalkulation")
	if before.get("modified") != expected_modified:
		raise SubmittedQuotationChangeError("Das Angebot wurde zwischenzeitlich geändert")

	for field in ("name", "company", "party_name", "currency", "custom_hwerp_calculation"):
		if after.get(field) != before.get(field):
			raise SubmittedQuotationChangeError(f"Das Feld {field} darf nicht geändert werden")

	if follow_up_documents and not follow_ups_acknowledged:
		raise SubmittedQuotationChangeError("Vorhandene Folgebelege müssen ausdrücklich bestätigt werden")

	before_rows = {row.get("name"): row for row in before.get("items", []) if row.get("name")}
	validated_rows: list[dict[str, Any]] = []
	provenance_fields = (
		"custom_hwerp_source_calculation",
		"custom_hwerp_source_position",
		"custom_hwerp_transfer_snapshot_hash",
	)
	for raw_row in after.get("items", []):
		row = deepcopy(dict(raw_row))
		original = before_rows.get(row.get("name"))
		if original:
			for field in provenance_fields:
				if row.get(field) != original.get(field):
					raise SubmittedQuotationChangeError("Die HWERP-Herkunft einer Angebotszeile ist unveränderlich")
		qty = _decimal(row.get("qty"), field="Menge")
		rate = _decimal(row.get("rate"), field="Preis")
		if qty <= 0 or rate < 0:
			raise SubmittedQuotationChangeError("Menge und Preis der Angebotszeile sind ungültig")
		if not str(row.get("description") or "").strip() or not str(row.get("uom") or "").strip():
			raise SubmittedQuotationChangeError("Beschreibung und Einheit sind erforderlich")
		validated_rows.append(row)

	validated = deepcopy(dict(before))
	validated["items"] = validated_rows
	return validated


def on_submitted_quotation_changed(doc: Any, method: str | None = None) -> None:
	"""Mark HWERP quotations after a controlled submitted-document update.

	The actual mutation is performed by a separately authorised API method. This
	hook only records that the standard document changed; it never changes the
	source calculation.
	"""
	if not getattr(doc, "custom_hwerp_calculation", None):
		return

	import frappe

	frappe.db.set_value(
		"Quotation",
		doc.name,
		"custom_hwerp_changed_after_sending",
		1,
		update_modified=False,
	)
