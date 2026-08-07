-- Supplier inquiry master data and maintained supplier capabilities.
-- Suppliers are existing rows in customers with role 'supplier'.

CREATE TABLE IF NOT EXISTS supplier_product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES supplier_product_categories(id) ON DELETE SET NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supplier_product_categories_active_idx
  ON supplier_product_categories(active, sort_order, name);

CREATE TABLE IF NOT EXISTS supplier_capability_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  parent_category_id UUID REFERENCES supplier_product_categories(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supplier_capability_tags_active_idx
  ON supplier_capability_tags(active, sort_order, name);

CREATE TABLE IF NOT EXISTS supplier_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES supplier_product_categories(id) ON DELETE RESTRICT,
  capability_label TEXT NOT NULL,
  product_terms TEXT[] NOT NULL DEFAULT '{}',
  materials TEXT[] NOT NULL DEFAULT '{}',
  service_tags TEXT[] NOT NULL DEFAULT '{}',
  fit_level TEXT NOT NULL DEFAULT 'passend',
  priority_rank INTEGER NOT NULL DEFAULT 100,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supplier_capabilities_customer_idx
  ON supplier_capabilities(customer_id);

CREATE INDEX IF NOT EXISTS supplier_capabilities_category_active_idx
  ON supplier_capabilities(category_id, active, priority_rank);
