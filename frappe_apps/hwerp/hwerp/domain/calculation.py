from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from typing import Any, Mapping

from hwerp.domain.pricing import MarginMethod, PricingLine, calculate_pricing


def _decimal(value: Any, *, default: Decimal | None = Decimal("0")) -> Decimal | None:
	if value in (None, ""):
		return default
	return Decimal(str(value))


def _money(value: Decimal, precision: int) -> Decimal:
	return value.quantize(Decimal(1).scaleb(-precision), rounding=ROUND_HALF_UP)


def calculate_document_pricing(
	document: Mapping[str, Any],
	*,
	margin_method: MarginMethod,
	currency_precision: int = 2,
) -> dict[str, Any]:
	pricing_lines: list[PricingLine] = []
	position_values: dict[str, dict[str, Decimal | None]] = {}
	for raw_position in document.get("positions") or ():
		quantity = _decimal(raw_position.get("quantity")) or Decimal("0")
		unit_price = _decimal(raw_position.get("effective_rate")) or Decimal("0")
		internal_unit_cost = _decimal(
			raw_position.get("internal_cost_rate"),
			default=None,
		)
		pricing_lines.append(
			PricingLine(
				quantity=quantity,
				unit_price=unit_price,
				internal_unit_cost=internal_unit_cost,
				is_internal_labor=raw_position.get("position_type") == "Arbeitszeit",
			)
		)
		position_values[str(raw_position.get("position_id") or "")] = {
			"internal_cost_amount": _money(
				quantity * internal_unit_cost,
				currency_precision,
			) if internal_unit_cost is not None else None,
			"line_amount": _money(quantity * unit_price, currency_precision),
		}

	discount_input_type = document.get("discount_input_type") or "Prozent"
	discount_arguments: dict[str, Decimal] = {}
	if discount_input_type == "Betrag":
		discount_arguments["discount_amount"] = _decimal(document.get("discount_amount")) or Decimal("0")
	else:
		discount_percent = _decimal(document.get("discount_percent")) or Decimal("0")
		discount_arguments["discount_rate"] = discount_percent / Decimal("100")

	result = calculate_pricing(
		lines=pricing_lines,
		risk_rate=(_decimal(document.get("risk_percent")) or Decimal("0")) / Decimal("100"),
		target_margin=(_decimal(document.get("target_margin")) or Decimal("0")) / Decimal("100"),
		margin_method=margin_method,
		currency_precision=currency_precision,
		**discount_arguments,
	)
	return {
		"positions": position_values,
		"cost_total": result.cost_basis,
		"risk_amount": result.risk_amount,
		"minimum_selling_price": result.minimum_price,
		"target_selling_price": result.target_price,
		"gross_selling_amount": result.pre_discount_total,
		"discount_amount": result.discount_amount,
		"discount_percent": result.discount_rate * Decimal("100"),
		"net_selling_amount": result.final_price,
		"partial_margin_amount": result.contribution_amount,
		"partial_margin_ratio": result.contribution_ratio,
		"has_missing_labor_cost": result.has_missing_labor_costs,
	}
