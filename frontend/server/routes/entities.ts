import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
import { toSnake, toCamel } from '../mappers/camelSnake.js';

const router = Router();

export type InquiryRole = 'employee' | 'dispatcher' | 'admin';

export interface InquiryAccessContext {
  userId: string | null;
  role: InquiryRole;
  canViewAllInquiries: boolean;
  canAssignInquiries: boolean;
}

interface InquiryUserPermissionRow {
  id?: unknown;
  role?: unknown;
  active?: unknown;
  can_view_all_inquiries?: unknown;
  can_assign_inquiries?: unknown;
}

type HeaderValue = string | string[] | undefined;

function firstHeaderValue(value: HeaderValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function trustInquiryIdentityHeaders(): boolean {
  return process.env.HWERP_TRUST_INQUIRY_HEADERS === 'true';
}

export function parseInquiryAccessHeaders(headers: Record<string, HeaderValue>): InquiryAccessContext {
  return {
    userId: firstHeaderValue(headers['x-hwerp-user-id'])?.trim() || null,
    role: 'employee',
    canViewAllInquiries: false,
    canAssignInquiries: false,
  };
}

export function buildInquiryAccessFromUserRow(
  row: InquiryUserPermissionRow | null,
  fallbackUserId: string | null,
): InquiryAccessContext {
  const rawRole = typeof row?.role === 'string' ? row.role.trim().toLowerCase() : '';
  const role: InquiryRole = rawRole === 'admin' || rawRole === 'dispatcher' ? rawRole : 'employee';
  const active = row?.active !== false;
  const roleCanManageBoard = active && (role === 'admin' || role === 'dispatcher');

  return {
    userId: (typeof row?.id === 'string' && row.id.trim()) || fallbackUserId,
    role: active ? role : 'employee',
    canViewAllInquiries: roleCanManageBoard && row?.can_view_all_inquiries !== false,
    canAssignInquiries: roleCanManageBoard && row?.can_assign_inquiries !== false,
  };
}

export function buildSingleUserInquiryAccess(): InquiryAccessContext {
  return { userId: 'hwerp-single-user', role: 'admin', canViewAllInquiries: true, canAssignInquiries: true };
}

async function resolveInquiryAccess(req: Request): Promise<InquiryAccessContext> {
  if (!trustInquiryIdentityHeaders()) {
    return buildSingleUserInquiryAccess();
  }

  const headerAccess = parseInquiryAccessHeaders(req.headers as Record<string, HeaderValue>);
  if (!headerAccess.userId) return headerAccess;

  const user = await pool.query(
    'SELECT id, role, active, can_view_all_inquiries, can_assign_inquiries FROM inquiry_users WHERE id = $1 AND active = TRUE',
    [headerAccess.userId],
  );
  return buildInquiryAccessFromUserRow(user.rows[0] ?? null, headerAccess.userId);
}

const INQUIRY_CHILD_VISIBILITY_TABLES: Partial<Record<string, string>> = {
  inquiryMessages: 'inquiry_messages',
  inquiryResponseDrafts: 'inquiry_response_drafts',
  inquiryAttachments: 'inquiry_attachments',
  inquiryExternalLinks: 'inquiry_external_links',
  inquiryScopeItems: 'inquiry_scope_items',
};

function isInquiryScopedEntity(entity: string): boolean {
  return entity === 'inquiries' || Boolean(INQUIRY_CHILD_VISIBILITY_TABLES[entity]);
}

export function buildInquiryVisibilityClause(
  entity: string,
  access: InquiryAccessContext,
  parameterStart = 1,
): { sql: string; values: string[] } {
  if (access.canViewAllInquiries) {
    return { sql: '', values: [] };
  }

  const childTable = INQUIRY_CHILD_VISIBILITY_TABLES[entity];
  if (entity !== 'inquiries' && !childTable) return { sql: '', values: [] };

  if (!access.userId) return { sql: '1 = 0', values: [] };

  if (entity === 'inquiries') {
    return { sql: `inquiries.assignee_user_id = $${parameterStart}`, values: [access.userId] };
  }

  return {
    sql: `EXISTS (SELECT 1 FROM inquiries visible_inquiry WHERE visible_inquiry.id = ${childTable}.inquiry_id AND visible_inquiry.assignee_user_id = $${parameterStart})`,
    values: [access.userId],
  };
}

const INQUIRY_ASSIGNMENT_COLUMNS = ['assignee_user_id', 'assigned_by_user_id', 'assigned_at'];

function normalizedDbValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? value : new Date(timestamp).toISOString();
  }
  return value === undefined ? null : value;
}

function changesInquiryAssignment(
  current: Record<string, unknown> | null,
  next: Record<string, unknown>,
): boolean {
  return INQUIRY_ASSIGNMENT_COLUMNS.some((column) => {
    if (!(column in next)) return false;
    return normalizedDbValue(current?.[column]) !== normalizedDbValue(next[column]);
  });
}

export function canMutateInquiryAssignment(
  current: Record<string, unknown> | null,
  next: Record<string, unknown>,
  access: InquiryAccessContext,
): boolean {
  if (access.canAssignInquiries) return true;
  return !changesInquiryAssignment(current, next);
}

export function canAccessInquiryRecord(
  row: Record<string, unknown> | null,
  access: InquiryAccessContext,
): boolean {
  if (access.canViewAllInquiries) return true;
  if (!row || !access.userId) return false;
  return row.assignee_user_id === access.userId;
}

async function canAccessInquiryId(inquiryId: string, access: InquiryAccessContext): Promise<boolean> {
  if (access.canViewAllInquiries) return true;
  if (!access.userId) return false;
  const result = await pool.query(
    'SELECT id FROM inquiries WHERE id = $1 AND assignee_user_id = $2',
    [inquiryId, access.userId],
  );
  return result.rows.length > 0;
}

export function canRetargetInquiryChildEntity(currentInquiryId: unknown, targetInquiryId: string): boolean {
  return typeof currentInquiryId !== 'string' || currentInquiryId === targetInquiryId;
}

// Entity → PG table name mapping. null = no PG equivalent (return empty / pass-through).
const TABLE_MAP: Record<string, string | null> = {
  customers: 'customers',
  supplierProductCategories: 'supplier_product_categories',
  supplierCapabilities: 'supplier_capabilities',
  supplierCapabilityTags: 'supplier_capability_tags',
  assets: 'assets',
  materials: 'materials',
  services: 'services',
  servicePackages: 'service_packages',
  servicePackageItems: 'service_package_items',
  calculations: 'calculations',
  calculationLineItems: 'calculation_line_items',
  transformerInventoryCalculationLinks: 'transformer_inventory_calculation_links',
  transformerInventoryReservations: 'transformer_inventory_reservations',
  transformerInventoryDetailOverrides: 'transformer_inventory_detail_overrides',
  transformerInventoryAttachments: 'transformer_inventory_attachments',
  transformerInventoryCostItems: 'transformer_inventory_cost_items',
  inquiries: 'inquiries',
  inquiryMasterDataCategories: 'inquiry_master_data_categories',
  inquiryMessages: 'inquiry_messages',
  inquiryResponseDrafts: 'inquiry_response_drafts',
  inquiryAttachments: 'inquiry_attachments',
  inquiryExternalLinks: 'inquiry_external_links',
  inquiryScopeItems: 'inquiry_scope_items',
  workshopTaskTemplates: 'workshop_task_templates',
  workshopCards: 'workshop_cards',
  workshopCardTasks: 'workshop_card_tasks',
  checklistTemplates: 'checklist_templates',
  checklistTemplateGroups: 'checklist_template_groups',
  checklistTemplateItems: 'checklist_template_items',
  checklistTemplateLinks: 'checklist_template_links',
  checklistItemActions: 'checklist_item_actions',
  checklistRuns: 'checklist_runs',
  checklistRunLinks: 'checklist_run_links',
  checklistRunItems: 'checklist_run_items',
  tags: 'tags',
  locations: 'locations',
  locationCustomers: 'location_customers',
  contactPersons: 'contact_persons',
  customerContactPersons: 'customer_contact_persons',
  locationContactOverrides: 'location_contact_overrides',
  assetContactOverrides: 'asset_contact_overrides',
  transferReceipts: 'transfer_receipts',
  transferReceiptItems: 'transfer_receipt_items',
  assetDocuments: 'asset_documents',
  assetHistoryEntries: 'asset_history_entries',
  selectOptions: 'select_options',
  sequences: 'sequences',
  settings: 'app_settings',
  // No PG equivalent → empty arrays
  calculationDevices: null,
  calculationItems: null,
};

// Entities that have tag junction tables
const TAG_JUNCTIONS: Partial<Record<string, { table: string; fk: string }>> = {
  assets: { table: 'asset_tags', fk: 'asset_id' },
  locations: { table: 'location_tags', fk: 'location_id' },
  contactPersons: { table: 'contact_person_tags', fk: 'contact_person_id' },
};

function isValidColumnName(col: string): boolean {
  return /^[a-z_][a-z0-9_]*$/.test(col);
}

export function getEntityTableName(entity: string): string | null | undefined {
  return TABLE_MAP[entity];
}

function buildSelectWithTags(tableName: string, junction: { table: string; fk: string }, whereId?: boolean): string {
  const where = whereId ? 'WHERE e.id = $1' : '';
  return `
    SELECT e.*, COALESCE(ARRAY_AGG(jt.tag_id) FILTER (WHERE jt.tag_id IS NOT NULL), '{}') AS tag_ids
    FROM ${tableName} e
    LEFT JOIN ${junction.table} jt ON jt.${junction.fk} = e.id
    ${where}
    GROUP BY e.id
  `;
}

// GET /api/entities/:entity
router.get('/:entity', async (req: Request, res: Response) => {
  const entity = String(req.params.entity);
  const tableName = TABLE_MAP[entity];

  if (tableName === undefined) {
    return res.status(404).json({ error: `Unknown entity: ${entity}` });
  }
  if (tableName === null) {
    return res.json([]);
  }

  try {
    const visibility = isInquiryScopedEntity(entity)
      ? buildInquiryVisibilityClause(entity, await resolveInquiryAccess(req))
      : { sql: '', values: [] };
    const junction = TAG_JUNCTIONS[entity];
    let sql: string;
    let values: string[] = [];
    if (junction) {
      sql = buildSelectWithTags(tableName, junction);
    } else {
      sql = `SELECT * FROM ${tableName}`;
      if (visibility.sql) {
        sql += ` WHERE ${visibility.sql}`;
        values = visibility.values;
      }
    }
    const result = await pool.query(sql, values);
    res.json(result.rows.map((row) => toCamel(row)));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// GET /api/entities/:entity/:id
router.get('/:entity/:id', async (req: Request, res: Response) => {
  const entity = String(req.params.entity);
  const id = String(req.params.id);
  const tableName = TABLE_MAP[entity];

  if (tableName === undefined) {
    return res.status(404).json({ error: `Unknown entity: ${entity}` });
  }
  if (tableName === null) {
    return res.json(null);
  }

  try {
    const visibility = isInquiryScopedEntity(entity)
      ? buildInquiryVisibilityClause(entity, await resolveInquiryAccess(req), 2)
      : { sql: '', values: [] };
    const junction = TAG_JUNCTIONS[entity];
    let sql: string;
    const values = [id, ...visibility.values];
    if (junction) {
      sql = buildSelectWithTags(tableName, junction, true);
    } else {
      sql = `SELECT * FROM ${tableName} WHERE id = $1`;
      if (visibility.sql) {
        sql += ` AND ${visibility.sql}`;
      }
    }
    const result = await pool.query(sql, values);
    if (result.rows.length === 0) return res.json(null);
    res.json(toCamel(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/entities/:entity  → upsert
router.post('/:entity', async (req: Request, res: Response) => {
  const entity = String(req.params.entity);
  const tableName = TABLE_MAP[entity];

  if (tableName === undefined) {
    return res.status(404).json({ error: `Unknown entity: ${entity}` });
  }
  if (tableName === null) {
    // No PG equivalent – echo back the body so the app still works
    return res.json(req.body);
  }

  const { tagIds, ...bodyWithoutTags } = req.body as Record<string, unknown> & { tagIds?: string[] };
  const snakeObj = toSnake(bodyWithoutTags);
  const inquiryAccess = isInquiryScopedEntity(entity) ? await resolveInquiryAccess(req) : null;

  if (entity === 'inquiries' && inquiryAccess) {
    let currentInquiry: Record<string, unknown> | null = null;
    if (typeof snakeObj.id === 'string') {
      const current = await pool.query(
        'SELECT assignee_user_id, assigned_by_user_id, assigned_at FROM inquiries WHERE id = $1',
        [snakeObj.id],
      );
      currentInquiry = current.rows[0] ?? null;
    }

    if (currentInquiry && !canAccessInquiryRecord(currentInquiry, inquiryAccess)) {
      return res.status(403).json({ error: 'Not allowed to modify this inquiry' });
    }

    if (!canMutateInquiryAssignment(currentInquiry, snakeObj, inquiryAccess)) {
      return res.status(403).json({ error: 'Not allowed to change inquiry assignment' });
    }
  }

  if (INQUIRY_CHILD_VISIBILITY_TABLES[entity] && inquiryAccess) {
    const targetInquiryId = snakeObj.inquiry_id;
    if (typeof targetInquiryId !== 'string' || !(await canAccessInquiryId(targetInquiryId, inquiryAccess))) {
      return res.status(403).json({ error: 'Not allowed to modify this inquiry child entity' });
    }

    if (typeof snakeObj.id === 'string') {
      const currentChild = await pool.query(
        `SELECT inquiry_id FROM ${tableName} WHERE id = $1`,
        [snakeObj.id],
      );
      const currentInquiryId = currentChild.rows[0]?.inquiry_id;
      if (!canRetargetInquiryChildEntity(currentInquiryId, targetInquiryId)) {
        return res.status(403).json({ error: 'Not allowed to move inquiry child entity' });
      }
    }
  }

  const cols = Object.keys(snakeObj).filter(isValidColumnName);
  const vals = cols.map((c) => snakeObj[c]);
  const placeholders = cols.map((_, i) => `$${i + 1}`);
  const setCols = cols.filter((c) => c !== 'id' && c !== 'created_at');
  const setClause = setCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ');

  const sql = `
    INSERT INTO ${tableName} (${cols.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (id) DO UPDATE SET ${setClause}
    RETURNING *
  `;

  const junction = TAG_JUNCTIONS[entity];

  if (junction && tagIds !== undefined) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(sql, vals);
      const inserted = result.rows[0];

      await client.query(
        `DELETE FROM ${junction.table} WHERE ${junction.fk} = $1`,
        [inserted.id]
      );

      if (tagIds.length > 0) {
        const junctionPlaceholders = tagIds
          .map((_, i) => `($1, $${i + 2})`)
          .join(', ');
        await client.query(
          `INSERT INTO ${junction.table} (${junction.fk}, tag_id) VALUES ${junctionPlaceholders}`,
          [inserted.id, ...tagIds]
        );
      }

      await client.query('COMMIT');
      res.json({ ...toCamel(inserted), tagIds: tagIds });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: String(error) });
    } finally {
      client.release();
    }
  } else {
    try {
      const result = await pool.query(sql, vals);
      res.json(toCamel(result.rows[0]));
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  }
});

// DELETE /api/entities/:entity/:id
router.delete('/:entity/:id', async (req: Request, res: Response) => {
  const entity = String(req.params.entity);
  const id = String(req.params.id);
  const tableName = TABLE_MAP[entity];

  if (tableName === undefined) {
    return res.status(404).json({ error: `Unknown entity: ${entity}` });
  }
  if (tableName === null) {
    return res.json({});
  }

  try {
    if (isInquiryScopedEntity(entity)) {
      const access = await resolveInquiryAccess(req);
      const visibility = buildInquiryVisibilityClause(entity, access, 2);
      const values = [id, ...visibility.values];
      let sql = `DELETE FROM ${tableName} WHERE id = $1`;
      if (visibility.sql) sql += ` AND ${visibility.sql}`;
      await pool.query(sql, values);
    } else {
      await pool.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    }
    res.json({});
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// DELETE /api/entities/:entity  → clear collection
router.delete('/:entity', async (req: Request, res: Response) => {
  const entity = String(req.params.entity);
  const tableName = TABLE_MAP[entity];

  if (tableName === undefined) {
    return res.status(404).json({ error: `Unknown entity: ${entity}` });
  }
  if (tableName === null) {
    return res.json({});
  }

  try {
    if (isInquiryScopedEntity(entity)) {
      const access = await resolveInquiryAccess(req);
      if (!access.canViewAllInquiries) {
        return res.status(403).json({ error: 'Not allowed to clear inquiry entities' });
      }
    }
    await pool.query(`TRUNCATE ${tableName} CASCADE`);
    res.json({});
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
