from __future__ import annotations

from types import SimpleNamespace

import pytest

from hwerp.api.pdf import generate_internal_calculation_pdf


class FakeFrappe:
	def __init__(self, allowed: bool = True) -> None:
		self.session = SimpleNamespace(user="user@example.com")
		self.allowed = allowed
		self.db = SimpleNamespace(
			get_value=lambda doctype, name, fieldname: "Aufschlag auf Kostenbasis"
		)

	def get_roles(self, user):
		return ["HWERP Calculation User"]

	def get_doc(self, doctype, name):
		return SimpleNamespace(
			as_dict=lambda: {
				"name": name,
				"price_group": "Standard",
				"status": "Entwurf",
				"company": "HWERP GmbH",
				"customer": "CUST-1",
				"responsible_user": "user@example.com",
				"currency": "EUR",
				"modified": "v1",
				"main_objects": [],
				"positions": [],
				"cost_total": "99999.00",
			},
		)

	def has_permission(self, doctype, ptype, doc, user):
		return self.allowed

	def render_template(self, template, context):
		assert template == "hwerp/templates/print_formats/internal_calculation.html"
		assert context["view"]["permissions"]["price_access"] == "hidden"
		assert "99999.00" not in str(context)
		return "<html>Preisfreie Kalkulation</html>"


def test_pdf_generation_rechecks_record_permission_and_uses_redacted_view() -> None:
	filename, content = generate_internal_calculation_pdf(
		FakeFrappe(),
		"KALK-1",
		pdf_renderer=lambda html: b"PDF:" + html.encode(),
	)

	assert filename == "KALK-1-interne-kalkulation.pdf"
	assert content == b"PDF:<html>Preisfreie Kalkulation</html>"


def test_pdf_generation_denies_the_download_without_current_record_permission() -> None:
	with pytest.raises(PermissionError):
		generate_internal_calculation_pdf(
			FakeFrappe(allowed=False),
			"KALK-1",
			pdf_renderer=lambda html: b"unused",
		)
