from __future__ import annotations

import ast
import json
from pathlib import Path

import pytest

APP_PACKAGE = Path(__file__).resolve().parents[1]
DOCTYPE_ROOT = APP_PACKAGE / "hwerp" / "doctype"

CORE_DOCTYPES = {
    "HWERP Kalkulation": ("hwerp_kalkulation", False),
    "HWERP Kalkulationsposition": ("hwerp_kalkulationsposition", True),
    "HWERP Hauptobjekt": ("hwerp_hauptobjekt", True),
    "HWERP Preisvorschlag": ("hwerp_preisvorschlag", False),
    "HWERP Kalkulationssnapshot": ("hwerp_kalkulationssnapshot", False),
    "HWERP Angebotsuebertragung": ("hwerp_angebotsuebertragung", False),
    "HWERP Uebertragungsposition": ("hwerp_uebertragungsposition", False),
    "HWERP Fremdleistungsverknuepfung": ("hwerp_fremdleistungsverknuepfung", False),
    "HWERP Ressourcenbelegung": ("hwerp_ressourcenbelegung", False),
    "HWERP Teilnehmer": ("hwerp_teilnehmer", True),
    "HWERP Kalkulationsregel": ("hwerp_kalkulationsregel", False),
}

# Die Preisgruppe ist eine notwendige Abhaengigkeit des priorisierten Kernmodells.
SUPPORTING_DOCTYPES = {
    "HWERP Kalkulationspreisgruppe": ("hwerp_kalkulationspreisgruppe", False),
}

ALL_DOCTYPES = CORE_DOCTYPES | SUPPORTING_DOCTYPES

BUSINESS_ROLES = {
    "HWERP Calculation User",
    "HWERP Calculation Approver",
    "HWERP Price Reviewer",
    "HWERP Price User",
    "HWERP Quotation Transfer",
    "HWERP Submitted Quotation Editor",
    "HWERP Item Creator",
    "HWERP Item Price Manager",
    "HWERP Pricing Rule Manager",
    "HWERP Participant Manager",
    "HWERP Reservation Manager",
}

REQUIRED_DOCPERMS = {
    "HWERP Kalkulation": {
        ("HWERP Calculation User", 0): {"read", "create", "write"},
        ("HWERP Calculation Approver", 0): {"read", "write"},
        ("HWERP Price Reviewer", 0): {"read"},
        ("HWERP Price Reviewer", 1): {"read"},
        ("HWERP Price User", 0): {"read"},
        ("HWERP Price User", 1): {"read"},
        ("HWERP Quotation Transfer", 0): {"read"},
        ("HWERP Submitted Quotation Editor", 0): {"read"},
        ("HWERP Item Creator", 0): {"read"},
        ("HWERP Item Price Manager", 0): {"read"},
        ("HWERP Participant Manager", 0): {"read", "write"},
    },
    "HWERP Kalkulationspreisgruppe": {
        ("HWERP Calculation User", 0): {"read"},
        ("HWERP Price Reviewer", 0): {"read"},
        ("HWERP Price Reviewer", 1): {"read"},
        ("HWERP Price User", 0): {"read"},
        ("HWERP Price User", 1): {"read"},
        ("HWERP Pricing Rule Manager", 0): {"read", "create", "write", "delete"},
        ("HWERP Pricing Rule Manager", 1): {"read", "write"},
    },
    "HWERP Kalkulationsregel": {
        ("HWERP Pricing Rule Manager", 0): {"read", "create", "write", "delete"},
        ("HWERP Pricing Rule Manager", 1): {"read", "write"},
    },
    "HWERP Ressourcenbelegung": {
        ("HWERP Reservation Manager", 0): {"read"},
    },
}

ERP_LINK_TARGETS = {
    "Company",
    "Customer",
    "Project",
    "Item",
    "Asset",
    "Quotation",
    "Sales Order",
    "Purchase Order",
    "Purchase Invoice",
    "Supplier Quotation",
}

CONTROLLER_CLASSES = {
    name: name.replace(" ", "").replace("-", "") for name in ALL_DOCTYPES
}


def schema_path(name: str) -> Path:
    slug = ALL_DOCTYPES[name][0]
    return DOCTYPE_ROOT / slug / f"{slug}.json"


def controller_path(name: str) -> Path:
    slug = ALL_DOCTYPES[name][0]
    return DOCTYPE_ROOT / slug / f"{slug}.py"


def load_schema(name: str) -> dict:
    path = schema_path(name)
    assert path.is_file(), f"DocType-JSON fehlt: {path}"
    with path.open(encoding="utf-8") as source:
        return json.load(source)


def field_map(schema: dict) -> dict[str, dict]:
    return {field["fieldname"]: field for field in schema["fields"]}


def assert_field(
    schema: dict,
    fieldname: str,
    fieldtype: str,
    *,
    options: str | None = None,
    **properties: object,
) -> dict:
    fields = field_map(schema)
    assert fieldname in fields, f"{schema['name']}: Feld {fieldname!r} fehlt"
    field = fields[fieldname]
    assert field["fieldtype"] == fieldtype
    if options is not None:
        assert field.get("options") == options
    for property_name, expected in properties.items():
        assert field.get(property_name) == expected, (
            f"{schema['name']}.{fieldname}: {property_name}="
            f"{field.get(property_name)!r}, erwartet {expected!r}"
        )
    return field


@pytest.mark.parametrize("name", ALL_DOCTYPES)
def test_doctype_json_is_a_consistent_frappe_v16_schema(name: str) -> None:
    schema = load_schema(name)
    expected_slug, is_table = ALL_DOCTYPES[name]

    assert schema["doctype"] == "DocType"
    assert schema["name"] == name
    assert schema["module"] == "HWERP"
    assert schema["engine"] == "InnoDB"
    assert schema.get("istable", 0) == int(is_table)
    assert schema.get("permissions", []) == [] if is_table else schema.get("permissions")

    fieldnames = [field["fieldname"] for field in schema["fields"]]
    assert len(fieldnames) == len(set(fieldnames)), f"Doppelte Felder in {name}"
    assert schema["field_order"] == fieldnames

    folder = DOCTYPE_ROOT / expected_slug
    assert (folder / "__init__.py").is_file()

    controller = controller_path(name)
    assert controller.is_file(), f"Frappe-Controller fehlt: {controller}"
    tree = ast.parse(controller.read_text(encoding="utf-8"))
    expected_class = CONTROLLER_CLASSES[name]
    classes = {node.name: node for node in tree.body if isinstance(node, ast.ClassDef)}
    assert expected_class in classes
    assert any(
        isinstance(base, ast.Name) and base.id == "Document"
        for base in classes[expected_class].bases
    )


def test_business_roles_have_explicit_least_privilege_doctype_permissions() -> None:
    assigned_roles: set[str] = set()

    for doctype, expected_permissions in REQUIRED_DOCPERMS.items():
        schema = load_schema(doctype)
        actual = {
            (permission["role"], int(permission.get("permlevel", 0))): {
                action
                for action in ("read", "create", "write", "delete", "submit", "cancel")
                if permission.get(action) == 1
            }
            for permission in schema["permissions"]
        }
        for key, expected_actions in expected_permissions.items():
            assigned_roles.add(key[0])
            assert actual.get(key) == expected_actions, (
                f"{doctype}: DocPerm {key} ist {actual.get(key)}, erwartet {expected_actions}"
            )

    assert assigned_roles == BUSINESS_ROLES

    calculation_permissions = load_schema("HWERP Kalkulation")["permissions"]
    assert not any(
        permission["role"] == "HWERP Calculation User"
        and int(permission.get("permlevel", 0)) == 1
        for permission in calculation_permissions
    )
    assert not any(
        permission["role"] != "System Manager"
        and permission.get("permlevel", 0) == 0
        and any(permission.get(action) for action in ("email", "export", "print", "report", "share"))
        for permission in calculation_permissions
    )


def test_internal_audit_doctypes_do_not_expose_direct_business_role_access() -> None:
    internal_doctypes = {
        "HWERP Preisvorschlag",
        "HWERP Kalkulationssnapshot",
        "HWERP Angebotsuebertragung",
        "HWERP Uebertragungsposition",
        "HWERP Fremdleistungsverknuepfung",
    }
    for doctype in internal_doctypes:
        roles = {permission["role"] for permission in load_schema(doctype)["permissions"]}
        assert roles.isdisjoint(BUSINESS_ROLES), doctype


def test_core_model_uses_erpnext_links_instead_of_parallel_master_data() -> None:
    linked_doctypes = {
        field["options"]
        for name in ALL_DOCTYPES
        for field in load_schema(name)["fields"]
        if field["fieldtype"] == "Link"
    }

    assert ERP_LINK_TARGETS <= linked_doctypes
    forbidden_custom_masters = {
        "HWERP Company",
        "HWERP Customer",
        "HWERP Project",
        "HWERP Item",
        "HWERP Asset",
        "HWERP Quotation",
        "HWERP Sales Order",
        "HWERP Purchase Order",
        "HWERP Purchase Invoice",
        "HWERP Supplier Quotation",
    }
    assert forbidden_custom_masters.isdisjoint(linked_doctypes)


def test_calculation_header_is_versioned_required_and_indexed() -> None:
    schema = load_schema("HWERP Kalkulation")
    assert schema["autoname"] == "format:HWERP-KALK-{YYYY}-{#####}"
    assert schema["track_changes"] == 1

    for fieldname, target in {
        "company": "Company",
        "customer": "Customer",
        "responsible_user": "User",
        "currency": "Currency",
        "price_group": "HWERP Kalkulationspreisgruppe",
    }.items():
        assert_field(schema, fieldname, "Link", options=target, reqd=1)

    assert_field(schema, "company", "Link", options="Company", search_index=1, set_only_once=1)
    assert_field(schema, "customer", "Link", options="Customer", search_index=1, set_only_once=1)
    assert_field(schema, "project", "Link", options="Project", search_index=1)
    assert_field(
        schema,
        "status",
        "Select",
        reqd=1,
        default="Entwurf",
        options="Entwurf\nFreigegeben\nStorniert",
        search_index=1,
        no_copy=1,
    )
    assert_field(
        schema,
        "version_no",
        "Int",
        reqd=1,
        default="1",
        read_only=1,
        no_copy=1,
        search_index=1,
    )
    assert_field(
        schema,
        "previous_version",
        "Link",
        options="HWERP Kalkulation",
        read_only=1,
        no_copy=1,
    )

    for fieldname, child_doctype in {
        "main_objects": "HWERP Hauptobjekt",
        "positions": "HWERP Kalkulationsposition",
        "participants": "HWERP Teilnehmer",
    }.items():
        assert_field(schema, fieldname, "Table", options=child_doctype)

    assert_field(
        schema,
        "discount_input_type",
        "Select",
        reqd=1,
        default="Prozent",
        options="Prozent\nBetrag",
        permlevel=1,
        no_copy=1,
    )


@pytest.mark.parametrize(
    ("doctype", "fieldname"),
    [
        ("HWERP Kalkulation", "cost_total"),
        ("HWERP Kalkulation", "target_selling_price"),
        ("HWERP Kalkulationsposition", "internal_cost_rate"),
        ("HWERP Kalkulationsposition", "effective_rate"),
        ("HWERP Preisvorschlag", "submitted_amount"),
        ("HWERP Preisvorschlag", "reviewed_amount"),
        ("HWERP Kalkulationssnapshot", "cost_total"),
        ("HWERP Kalkulationssnapshot", "net_selling_amount"),
        ("HWERP Uebertragungsposition", "rate"),
        ("HWERP Uebertragungsposition", "amount"),
        ("HWERP Fremdleistungsverknuepfung", "allocated_net_amount"),
        ("HWERP Kalkulationsregel", "rule_value"),
    ],
)
def test_price_and_cost_fields_are_on_a_protected_permission_level(
    doctype: str, fieldname: str
) -> None:
    field = field_map(load_schema(doctype))[fieldname]
    assert field["fieldtype"] in {"Currency", "Percent", "Float"}
    assert field.get("permlevel") == 1


def test_position_and_main_object_are_child_tables_with_stable_ids() -> None:
    position = load_schema("HWERP Kalkulationsposition")
    main_object = load_schema("HWERP Hauptobjekt")

    assert position["istable"] == 1
    assert main_object["istable"] == 1
    assert_field(
        position,
        "position_id",
        "Data",
        reqd=1,
        set_only_once=1,
        search_index=1,
    )
    assert_field(position, "item", "Link", options="Item")
    assert_field(position, "asset", "Link", options="Asset")
    assert_field(position, "description", "Small Text", reqd=1)
    assert_field(position, "quantity", "Float", reqd=1, non_negative=1)
    assert_field(position, "uom", "Link", options="UOM", reqd=1)
    assert_field(
        main_object,
        "object_id",
        "Data",
        reqd=1,
        set_only_once=1,
        search_index=1,
    )
    assert_field(main_object, "object_type", "Select", reqd=1)
    assert_field(main_object, "item", "Link", options="Item")
    assert_field(main_object, "asset", "Link", options="Asset")


def test_participant_is_a_user_child_table() -> None:
    schema = load_schema("HWERP Teilnehmer")
    assert schema["istable"] == 1
    assert_field(schema, "user", "Link", options="User", reqd=1)
    assert_field(schema, "access_level", "Select", reqd=1)


def test_price_proposal_has_an_auditable_review_lifecycle() -> None:
    schema = load_schema("HWERP Preisvorschlag")
    assert schema["autoname"] == "hash"
    assert schema["track_changes"] == 1
    assert_field(
        schema,
        "calculation",
        "Link",
        options="HWERP Kalkulation",
        reqd=1,
        set_only_once=1,
        search_index=1,
    )
    assert_field(schema, "proposed_by", "Link", options="User", reqd=1, set_only_once=1)
    assert_field(schema, "reviewer", "Link", options="User", reqd=1, set_only_once=1)
    assert_field(
        schema,
        "status",
        "Select",
        reqd=1,
        default="Entwurf",
        options="Entwurf\nEingereicht\nAngenommen\nAbgelehnt",
        search_index=1,
        no_copy=1,
    )
    assert_field(schema, "todo", "Link", options="ToDo", read_only=1, no_copy=1)


def test_calculation_snapshot_is_immutable_versioned_and_price_protected() -> None:
    schema = load_schema("HWERP Kalkulationssnapshot")
    assert schema["autoname"] == "hash"
    assert schema["track_changes"] == 1
    assert_field(
        schema,
        "snapshot_version",
        "Int",
        reqd=1,
        default="1",
        read_only=1,
        no_copy=1,
    )
    assert_field(
        schema,
        "calculation",
        "Link",
        options="HWERP Kalkulation",
        reqd=1,
        read_only=1,
        no_copy=1,
        search_index=1,
    )
    for fieldname in (
        "snapshot_type",
        "snapshot_version",
        "company",
        "currency",
        "price_group",
        "payload",
        "captured_at",
        "captured_by",
    ):
        field = field_map(schema)[fieldname]
        assert field.get("read_only") == 1
        assert field.get("no_copy") == 1
    assert field_map(schema)["payload"].get("permlevel") == 1


def test_offer_transfer_is_idempotent_and_preserves_source_identity() -> None:
    transfer = load_schema("HWERP Angebotsuebertragung")
    assert transfer["autoname"] == "format:HWERP-TR-{YYYY}-{#####}"
    assert_field(
        transfer,
        "idempotency_key",
        "Data",
        reqd=1,
        unique=1,
        set_only_once=1,
        search_index=1,
        no_copy=1,
    )
    assert_field(transfer, "quotation", "Link", options="Quotation", reqd=1, search_index=1)
    assert_field(transfer, "company", "Link", options="Company", reqd=1)
    assert_field(transfer, "customer", "Link", options="Customer", reqd=1)
    for fieldname in (
        "calculation_number",
        "calculation_version",
        "idempotency_key",
        "transferred_at",
        "transferred_by",
    ):
        field = field_map(transfer)[fieldname]
        assert field.get("no_copy") == 1

    position = load_schema("HWERP Uebertragungsposition")
    assert position.get("istable", 0) == 0
    assert_field(
        position,
        "transfer",
        "Link",
        options="HWERP Angebotsuebertragung",
        reqd=1,
        set_only_once=1,
        search_index=1,
    )
    assert_field(position, "quotation", "Link", options="Quotation", reqd=1)
    for fieldname in (
        "source_calculation_number",
        "source_position_id",
        "source_version",
        "description",
        "quantity",
        "uom",
        "rate",
        "amount",
        "object_snapshot",
    ):
        field = field_map(position)[fieldname]
        assert field.get("read_only") == 1
        assert field.get("no_copy") == 1


def test_external_service_link_models_exact_erpnext_source_rows() -> None:
    schema = load_schema("HWERP Fremdleistungsverknuepfung")
    assert schema["autoname"] == "hash"
    assert_field(schema, "supplier_quotation", "Link", options="Supplier Quotation")
    assert_field(schema, "purchase_order", "Link", options="Purchase Order")
    assert_field(schema, "purchase_invoice", "Link", options="Purchase Invoice")
    assert_field(schema, "source_row_id", "Data", reqd=1, set_only_once=1)
    assert_field(
        schema,
        "allocation_key",
        "Data",
        unique=1,
        read_only=1,
        no_copy=1,
        search_index=1,
    )
    assert_field(schema, "company", "Link", options="Company", reqd=1)
    assert_field(schema, "currency", "Link", options="Currency", reqd=1)
    assert_field(schema, "source_net_amount", "Currency", read_only=1, no_copy=1, permlevel=1)


def test_resource_occupancy_links_reservations_to_erpnext_documents() -> None:
    schema = load_schema("HWERP Ressourcenbelegung")
    assert schema["autoname"] == "hash"
    assert_field(schema, "company", "Link", options="Company", reqd=1, search_index=1)
    assert_field(schema, "asset", "Link", options="Asset")
    assert_field(schema, "quotation", "Link", options="Quotation")
    assert_field(schema, "sales_order", "Link", options="Sales Order")
    assert_field(schema, "starts_at", "Datetime", reqd=1, search_index=1)
    assert_field(schema, "ends_at", "Datetime", reqd=1, search_index=1)
    assert_field(
        schema,
        "status",
        "Select",
        reqd=1,
        default="Aktiv",
        options="Aktiv\nBeendet\nAufgehoben\nStorniert",
        search_index=1,
        no_copy=1,
    )


def test_calculation_rule_has_deterministic_priority_and_version() -> None:
    schema = load_schema("HWERP Kalkulationsregel")
    assert schema["autoname"] == "field:rule_name"
    assert schema["track_changes"] == 1
    assert_field(schema, "rule_name", "Data", reqd=1, unique=1)
    assert_field(schema, "active", "Check", default="1", search_index=1)
    assert_field(schema, "priority", "Int", reqd=1, default="0", search_index=1)
    assert_field(schema, "target_field", "Select", reqd=1, search_index=1)
    assert_field(
        schema,
        "rule_version",
        "Int",
        reqd=1,
        default="1",
        read_only=1,
        no_copy=1,
    )
    assert_field(schema, "erpnext_pricing_rule", "Link", options="Pricing Rule")


def test_price_group_binds_exactly_one_erpnext_price_list() -> None:
    schema = load_schema("HWERP Kalkulationspreisgruppe")
    assert schema["autoname"] == "field:price_group_name"
    assert_field(schema, "price_group_name", "Data", reqd=1, unique=1)
    assert_field(schema, "price_list", "Link", options="Price List", reqd=1)
    assert_field(schema, "target_margin", "Percent", reqd=1, permlevel=1)
    assert_field(schema, "default_risk", "Percent", reqd=1, permlevel=1)
