from types import SimpleNamespace

from hwerp.domain.document import apply_calculation_values


def test_document_application_assigns_stable_ids_and_server_calculated_values() -> None:
	position = SimpleNamespace(
		position_id="",
		position_type="Material",
		quantity="1",
		internal_cost_rate="100.00",
		effective_rate="150.00",
	)
	main_object = SimpleNamespace(object_id="")
	doc = SimpleNamespace(
		risk_percent="5",
		target_margin="20",
		discount_input_type="Prozent",
		discount_percent="10",
		discount_amount="0",
		positions=[position],
		main_objects=[main_object],
	)
	price_group = SimpleNamespace(margin_method="Aufschlag auf Kostenbasis")
	ids = iter(("POS-ID", "OBJ-ID"))

	apply_calculation_values(doc, price_group, id_factory=lambda: next(ids))

	assert position.position_id == "POS-ID"
	assert main_object.object_id == "OBJ-ID"
	assert position.internal_cost_amount == 100.0
	assert position.line_amount == 150.0
	assert doc.cost_total == 100.0
	assert doc.discount_amount == 15.0
	assert doc.net_selling_amount == 135.0
