app_name = "hwerp"
app_title = "HWERP"
app_publisher = "HTV"
app_description = "HWERP Verkaufskalkulation fuer ERPNext"
app_email = "info@ht-v.de"
app_license = "mit"

required_apps = ["erpnext"]

# Keep ERPNext core untouched: standard document metadata is extended through
# update-safe Custom Fields created by the app lifecycle.
after_install = "hwerp.install.after_install"
after_migrate = "hwerp.install.after_migrate"

permission_query_conditions = {
	"HWERP Kalkulation": "hwerp.record_permissions.get_calculation_permission_query_conditions",
}

has_permission = {
	"HWERP Kalkulation": "hwerp.record_permissions.has_calculation_permission",
}

doc_events = {
	"Sales Order": {
		"on_submit": "hwerp.integrations.reservations.on_sales_order_submit",
		"on_cancel": "hwerp.integrations.reservations.on_sales_order_cancel",
		"on_update_after_submit": "hwerp.integrations.reservations.on_sales_order_update_after_submit",
	},
	"Supplier Quotation": {
		"on_submit": "hwerp.integrations.procurement.on_source_document_changed",
		"on_cancel": "hwerp.integrations.procurement.on_source_document_changed",
		"on_update_after_submit": "hwerp.integrations.procurement.on_source_document_changed",
	},
	"Purchase Order": {
		"on_submit": "hwerp.integrations.procurement.on_source_document_changed",
		"on_cancel": "hwerp.integrations.procurement.on_source_document_changed",
		"on_update_after_submit": "hwerp.integrations.procurement.on_source_document_changed",
	},
	"Purchase Invoice": {
		"on_submit": "hwerp.integrations.procurement.on_source_document_changed",
		"on_cancel": "hwerp.integrations.procurement.on_source_document_changed",
		"on_update_after_submit": "hwerp.integrations.procurement.on_source_document_changed",
	},
	"Quotation": {
		"on_update_after_submit": "hwerp.integrations.quotation.on_submitted_quotation_changed",
	},
}

scheduler_events = {
	"daily": ["hwerp.integrations.reservations.release_expired_soft_holds"],
}

export_python_type_annotations = True

# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
# add_to_apps_screen = [
# 	{
# 		"name": "hwerp",
# 		"logo": "/assets/hwerp/logo.png",
# 		"title": "HWERP",
# 		"route": "/hwerp",
# 		"has_permission": "hwerp.api.permission.has_app_permission"
# 	}
# ]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/hwerp/css/hwerp.css"
# app_include_js = "/assets/hwerp/js/hwerp.js"

# include js, css files in header of web template
# web_include_css = "/assets/hwerp/css/hwerp.css"
# web_include_js = "/assets/hwerp/js/hwerp.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "hwerp/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "hwerp/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# automatically load and sync documents of this doctype from downstream apps
# importable_doctypes = [doctype_1]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "hwerp.utils.jinja_methods",
# 	"filters": "hwerp.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "hwerp.install.before_install"
# after_install = "hwerp.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "hwerp.uninstall.before_uninstall"
# after_uninstall = "hwerp.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "hwerp.utils.before_app_install"
# after_app_install = "hwerp.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "hwerp.utils.before_app_uninstall"
# after_app_uninstall = "hwerp.utils.after_app_uninstall"

# Build
# ------------------
# To hook into the build process

# after_build = "hwerp.build.after_build"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "hwerp.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }
#
# has_permission = {
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {
# 	"*": {
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
# 	}
# }

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"hwerp.tasks.all"
# 	],
# 	"daily": [
# 		"hwerp.tasks.daily"
# 	],
# 	"hourly": [
# 		"hwerp.tasks.hourly"
# 	],
# 	"weekly": [
# 		"hwerp.tasks.weekly"
# 	],
# 	"monthly": [
# 		"hwerp.tasks.monthly"
# 	],
# }

# Testing
# -------

# before_tests = "hwerp.install.before_tests"

# Extend DocType Class
# ------------------------------
#
# Specify custom mixins to extend the standard doctype controller.
# extend_doctype_class = {
# 	"Task": "hwerp.custom.task.CustomTaskMixin"
# }

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "hwerp.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "hwerp.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]

# Request Events
# ----------------
# before_request = ["hwerp.utils.before_request"]
# after_request = ["hwerp.utils.after_request"]

# Job Events
# ----------
# before_job = ["hwerp.utils.before_job"]
# after_job = ["hwerp.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"hwerp.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }

# Translation
# ------------
# List of apps whose translatable strings should be excluded from this app's translations.
# ignore_translatable_strings_from = []
