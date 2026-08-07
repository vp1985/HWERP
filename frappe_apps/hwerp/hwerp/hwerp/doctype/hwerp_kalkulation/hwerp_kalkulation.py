import frappe
from frappe.model.document import Document

from hwerp.domain.document import apply_calculation_values


class HWERPKalkulation(Document):
	def validate(self):
		old_doc = self.get_doc_before_save()
		if (
			old_doc
			and old_doc.status != self.status
			and not getattr(self.flags, "hwerp_status_change", False)
		):
			frappe.throw("Statuswechsel sind ausschließlich über die kontrollierte HWERP-API zulässig")
		company_currency = frappe.db.get_value("Company", self.company, "default_currency")
		if not self.currency:
			self.currency = company_currency
		if self.currency != company_currency:
			frappe.throw("Die Kalkulationswährung muss der Basiswährung der Company entsprechen")
		price_group = frappe.get_cached_doc("HWERP Kalkulationspreisgruppe", self.price_group)
		apply_calculation_values(self, price_group)
		if self.status == "Freigegeben" and any(
			position.position_type != "Hinweis"
			and getattr(position, "effective_rate", None) in (None, "")
			for position in self.positions
		):
			frappe.throw("Ein wirksamer Verkaufspreis fehlt bei mindestens einer preiswirksamen Position")
