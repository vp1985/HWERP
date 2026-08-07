from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Mapping

from hwerp.permissions import Action, PriceLevel, can, price_level_for_roles


_STATUS = {
	"Entwurf": "draft",
	"Freigegeben": "approved",
	"Storniert": "cancelled",
}
_MAIN_OBJECT_KIND = {
	"HWERP Technikobjekt": "hwerp_asset",
	"ERPNext Item": "freeform",
	"Eigenes ERPNext Asset": "erpnext_asset",
	"Kundenasset": "customer_asset",
	"Mietasset": "rental_asset",
	"Externes Mietmittel": "external_rental",
	"Freies technisches Objekt": "freeform",
}
_LINE_KIND = {
	"Material": "material",
	"Arbeitszeit": "labor",
	"Fremdleistung": "external_service",
	"Eigenes Asset": "own_asset",
	"Externes Mietmittel": "external_rental",
	"Transport": "transport",
	"Reise und Uebernachtung": "travel",
	"Gemeinkosten": "overhead",
	"Verkaufsleistung": "service",
	"Hinweis": "text",
}
_PRICE_SOURCE = {
	"Preislistenpreis": "price_list",
	"Pricing Rule": "pricing_rule",
	"HWERP Zielpreis": "target_price",
	"Preisvorschlag": "proposal",
	"Manuell": "manual",
}


def _string(value: Any, default: str = "") -> str:
	return default if value is None else str(value)


def _money_string(value: Any) -> str | None:
	if value in (None, ""):
		return None
	return format(Decimal(str(value)), ".2f")


def _rate_string(percent: Any) -> str:
	return format(Decimal(str(percent or 0)) / Decimal("100"), "f")


def _main_object(row: Mapping[str, Any]) -> dict[str, Any]:
	return {
		"id": _string(row.get("object_id")),
		"kind": _MAIN_OBJECT_KIND[row["object_type"]],
		"reference_id": (
			row.get("asset")
			or row.get("item")
			or row.get("reference_name")
			or row.get("external_resource_id")
		),
		"label": _string(row.get("description")),
		"sort_order": int(row.get("sort_order") or row.get("idx") or 0),
	}


def _price_free_line(row: Mapping[str, Any]) -> dict[str, Any]:
	return {
		"id": _string(row.get("position_id")),
		"position_number": _string(row.get("idx")) if row.get("idx") else None,
		"parent_id": None,
		"main_object_id": row.get("main_object_id") or None,
		"kind": _LINE_KIND[row["position_type"]],
		"item_code": row.get("item") or None,
		"description": _string(row.get("description")),
		"quantity": _string(row.get("quantity"), "0"),
		"uom": _string(row.get("uom")),
		"sort_order": int(row.get("idx") or 0),
	}


def present_calculation(
	document: Mapping[str, Any],
	*,
	roles: set[str],
	current_user: str,
	margin_method: str,
) -> dict[str, Any]:
	level = price_level_for_roles(roles)
	price_access = {
		PriceLevel.A: "edit",
		PriceLevel.B: "view",
		PriceLevel.C: "hidden",
	}[level]
	calculation = {
		"id": _string(document.get("name")),
		"number": document.get("name") or None,
		"company_id": _string(document.get("company")),
		"customer_id": _string(document.get("customer")),
		"project_id": document.get("project") or None,
		"price_group_id": _string(document.get("price_group")),
		"responsible_user_id": _string(document.get("responsible_user")),
		"status": _STATUS[document["status"]],
		"currency": _string(document.get("currency")),
		"notes": document.get("notes") or None,
		"internal_notes": document.get("internal_notes") if level is not PriceLevel.C else None,
		"modified_at": _string(document.get("modified")),
		"main_objects": [_main_object(row) for row in document.get("main_objects") or ()],
		"lines": [_price_free_line(row) for row in document.get("positions") or ()],
	}
	presented = {
		"conflict_token": _string(document.get("modified")),
		"permissions": {
			"price_access": price_access,
			"can_edit": can(Action.EDIT_CALCULATION, roles),
			"can_approve": can(Action.APPROVE_CALCULATION, roles),
			"can_transfer": can(Action.TRANSFER_QUOTATION, roles),
		},
		"calculation": calculation,
	}
	if level is PriceLevel.C:
		return presented

	for target, source in zip(
		calculation["lines"],
		document.get("positions") or (),
		strict=True,
	):
		target["pricing"] = {
			"internal_cost_amount": _money_string(source.get("internal_cost_amount")),
			"price_list_rate": _money_string(source.get("price_list_rate")),
			"pricing_rule_rate": _money_string(source.get("pricing_rule_rate")),
			"effective_unit_price": _money_string(source.get("effective_rate")),
			"rounded_net_amount": _money_string(source.get("line_amount")) or "0.00",
			"price_source": _PRICE_SOURCE.get(source.get("selected_price_source")),
		}
	minimum = Decimal(str(document.get("minimum_selling_price") or 0))
	final = Decimal(str(document.get("net_selling_amount") or 0))
	contribution = Decimal(str(document.get("partial_margin_amount") or 0))
	denominator = minimum if margin_method == "Aufschlag auf Kostenbasis" else final
	contribution_ratio = (
		(contribution / denominator).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
		if denominator
		else Decimal("0")
	)
	presented["pricing"] = {
		"margin_method": (
			"markup" if margin_method == "Aufschlag auf Kostenbasis" else "sales_margin"
		),
		"cost_base": _money_string(document.get("cost_total")) or "0.00",
		"risk_rate": _rate_string(document.get("risk_percent")),
		"risk_amount": _money_string(document.get("risk_amount")) or "0.00",
		"minimum_sale_price": _money_string(document.get("minimum_selling_price")) or "0.00",
		"target_margin_rate": _rate_string(document.get("target_margin")),
		"target_sale_price": _money_string(document.get("target_selling_price")) or "0.00",
		"line_net_total": _money_string(document.get("gross_selling_amount")) or "0.00",
		"discount_amount": _money_string(document.get("discount_amount")) or "0.00",
		"final_net_total": _money_string(document.get("net_selling_amount")) or "0.00",
		"contribution_amount": _money_string(document.get("partial_margin_amount")) or "0.00",
		"contribution_ratio": format(contribution_ratio, "f"),
		"has_missing_labor_costs": bool(document.get("has_missing_labor_cost")),
	}
	return presented
