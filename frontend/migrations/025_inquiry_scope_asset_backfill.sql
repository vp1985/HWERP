-- Backfill legacy single inquiry asset_id into inquiry_scope_items.
-- The UI now uses inquiry_scope_items for multi-asset persistence and keeps asset_id as legacy primary asset.

SET search_path TO public;

INSERT INTO inquiry_scope_items
  (inquiry_id, position_number, parent_id, kind, asset_id, material_id, service_id, title, quantity, unit, note, created_at, updated_at)
SELECT
  i.id,
  '1',
  NULL,
  'asset_section',
  i.asset_id,
  NULL,
  NULL,
  COALESCE(a.name, 'Asset'),
  1,
  'Stk',
  NULL,
  COALESCE(i.created_at, NOW()),
  NOW()
FROM inquiries i
LEFT JOIN assets a ON a.id = i.asset_id
WHERE i.asset_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM inquiry_scope_items existing
    WHERE existing.inquiry_id = i.id
      AND existing.kind = 'asset_section'
      AND existing.asset_id = i.asset_id
  );
