from __future__ import annotations

from collections.abc import Callable
from typing import Any
from uuid import uuid4

from hwerp.domain.calculation import calculate_document_pricing
from hwerp.domain.pricing import MarginMethod


_MARGIN_METHODS = {
	"Aufschlag auf Kostenbasis": MarginMethod.MARKUP,
	"Marge vom Verkaufspreis": MarginMethod.SALES_MARGIN,
}


def _value(source: Any, fieldname: str, default: Any = None) -> Any:
	if isinstance(source, dict):
		return source.get(fieldname, default)
	return getattr(source, fieldname, default)


def _row_mapping(row: Any) -> dict[str, Any]:
	if hasattr(row, "as_dict"):
		return row.as_dict()
	if isinstance(row, dict):
		return dict(row)
	return vars(row).copy()


def apply_calculation_values(
	doc: Any,
	price_group: Any,
	*,
	currency_precision: int = 2,
	id_factory: Callable[[], str] = lambda: str(uuid4()),
) -> None:
	for position in _value(doc, "positions", ()) or ():
		if not _value(position, "position_id"):
			setattr(position, "position_id", id_factory())
	for main_object in _value(doc, "main_objects", ()) or ():
		if not _value(main_object, "object_id"):
			setattr(main_object, "object_id", id_factory())

	positions = [_row_mapping(row) for row in (_value(doc, "positions", ()) or ())]
	document_values = {
		"risk_percent": _value(doc, "risk_percent"),
		"target_margin": _value(doc, "target_margin"),
		"discount_input_type": _value(doc, "discount_input_type", "Prozent"),
		"discount_percent": _value(doc, "discount_percent"),
		"discount_amount": _value(doc, "discount_amount"),
		"positions": positions,
	}
	margin_method_name = _value(price_group, "margin_method")
	try:
		margin_method = _MARGIN_METHODS[margin_method_name]
	except KeyError as exc:
		raise ValueError(f"Unbekannte Margenberechnungsart: {margin_method_name}") from exc

	calculated = calculate_document_pricing(
		document_values,
		margin_method=margin_method,
		currency_precision=currency_precision,
	)
	for position in _value(doc, "positions", ()) or ():
		row_values = calculated["positions"][_value(position, "position_id")]
		for fieldname, value in row_values.items():
			setattr(position, fieldname, float(value) if value is not None else None)

	for fieldname in (
		"cost_total",
		"risk_amount",
		"minimum_selling_price",
		"target_selling_price",
		"gross_selling_amount",
		"discount_amount",
		"discount_percent",
		"net_selling_amount",
		"partial_margin_amount",
	):
		setattr(doc, fieldname, float(calculated[fieldname]))
	setattr(doc, "has_missing_labor_cost", int(calculated["has_missing_labor_cost"]))
