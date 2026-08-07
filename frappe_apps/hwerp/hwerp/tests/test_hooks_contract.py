from __future__ import annotations

import hwerp.hooks as hooks


def test_app_requires_erpnext_and_runs_update_safe_installation() -> None:
	assert hooks.required_apps == ["erpnext"]
	assert hooks.after_install == "hwerp.install.after_install"
	assert hooks.after_migrate == "hwerp.install.after_migrate"


def test_sales_order_events_drive_resource_reservations() -> None:
	events = hooks.doc_events["Sales Order"]
	assert events["on_submit"] == "hwerp.integrations.reservations.on_sales_order_submit"
	assert events["on_cancel"] == "hwerp.integrations.reservations.on_sales_order_cancel"
	assert events["on_update_after_submit"] == "hwerp.integrations.reservations.on_sales_order_update_after_submit"


def test_procurement_events_refresh_only_the_bounded_external_service_comparison() -> None:
	for doctype in ("Supplier Quotation", "Purchase Order", "Purchase Invoice"):
		events = hooks.doc_events[doctype]
		assert events["on_submit"] == "hwerp.integrations.procurement.on_source_document_changed"
		assert events["on_cancel"] == "hwerp.integrations.procurement.on_source_document_changed"
		assert events["on_update_after_submit"] == "hwerp.integrations.procurement.on_source_document_changed"


def test_quotation_update_is_audited_without_automatic_calculation_update() -> None:
	assert hooks.doc_events["Quotation"]["on_update_after_submit"] == (
		"hwerp.integrations.quotation.on_submitted_quotation_changed"
	)


def test_calculation_record_access_is_enforced_for_lists_and_documents() -> None:
	assert hooks.permission_query_conditions["HWERP Kalkulation"] == (
		"hwerp.record_permissions.get_calculation_permission_query_conditions"
	)
	assert hooks.has_permission["HWERP Kalkulation"] == (
		"hwerp.record_permissions.has_calculation_permission"
	)


def test_expired_soft_holds_are_released_by_scheduler() -> None:
	assert "hwerp.integrations.reservations.release_expired_soft_holds" in hooks.scheduler_events["daily"]
