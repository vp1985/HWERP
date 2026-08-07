import { Router, Request, Response } from 'express';
import { pool } from '../db.js';

const router = Router();

type ServiceReportRow = {
  id: string;
  report_number: string;
  type: string;
  customer_id: string;
  location_id: string;
  asset_id: string | null;
  order_number: string | null;
  values: Record<string, unknown>;
  status: string;
  sync_status: string;
  sync_error: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  synced_at: string | null;
};

function toReport(row: ServiceReportRow) {
  return {
    id: row.id,
    reportNumber: row.report_number,
    type: row.type,
    customerId: row.customer_id,
    locationId: row.location_id,
    assetId: row.asset_id ?? undefined,
    orderNumber: row.order_number ?? undefined,
    values: row.values ?? {},
    status: row.status,
    syncStatus: row.sync_status,
    syncError: row.sync_error ?? undefined,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    syncedAt: row.synced_at ?? undefined,
  };
}

function normalizeReport(input: Record<string, unknown>) {
  const now = new Date().toISOString();
  const id = String(input.id ?? '').trim();
  const reportNumber = String(input.reportNumber ?? '').trim();
  const type = String(input.type ?? '').trim();
  const customerId = String(input.customerId ?? '').trim();
  const locationId = String(input.locationId ?? '').trim();

  if (!id) throw new Error('Bericht-ID ist erforderlich.');
  if (!reportNumber) throw new Error('Berichtnummer ist erforderlich.');
  if (!type) throw new Error('Berichtstyp ist erforderlich.');
  if (!customerId) throw new Error('Kunde ist erforderlich.');
  if (!locationId) throw new Error('Standort ist erforderlich.');

  return {
    id,
    reportNumber,
    type,
    customerId,
    locationId,
    assetId: input.assetId ? String(input.assetId) : null,
    orderNumber: input.orderNumber ? String(input.orderNumber) : null,
    values: typeof input.values === 'object' && input.values !== null ? input.values : {},
    status: String(input.status ?? 'abgeschlossen'),
    syncStatus: 'synced',
    syncError: null,
    createdBy: String(input.createdBy ?? ''),
    createdAt: String(input.createdAt ?? now),
    updatedAt: String(input.updatedAt ?? now),
    completedAt: input.completedAt ? String(input.completedAt) : null,
    syncedAt: now,
  };
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query<ServiceReportRow>('SELECT * FROM service_reports ORDER BY created_at DESC');
    res.json(result.rows.map(toReport));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post('/sync', async (req: Request, res: Response) => {
  const reports = Array.isArray(req.body?.reports) ? req.body.reports as Record<string, unknown>[] : [];
  if (reports.length === 0) return res.json({ syncedIds: [], reports: [] });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const synced = [];

    for (const item of reports) {
      const report = normalizeReport(item);
      const result = await client.query<ServiceReportRow>(
        `
          INSERT INTO service_reports
            (id, report_number, type, customer_id, location_id, asset_id, order_number, values, status, sync_status, sync_error, created_by, created_at, updated_at, completed_at, synced_at)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, NOW(), $14, $15)
          ON CONFLICT (id) DO UPDATE SET
            report_number = EXCLUDED.report_number,
            type = EXCLUDED.type,
            customer_id = EXCLUDED.customer_id,
            location_id = EXCLUDED.location_id,
            asset_id = EXCLUDED.asset_id,
            order_number = EXCLUDED.order_number,
            values = EXCLUDED.values,
            status = EXCLUDED.status,
            sync_status = EXCLUDED.sync_status,
            sync_error = NULL,
            created_by = EXCLUDED.created_by,
            updated_at = NOW(),
            completed_at = EXCLUDED.completed_at,
            synced_at = EXCLUDED.synced_at
          RETURNING *
        `,
        [
          report.id,
          report.reportNumber,
          report.type,
          report.customerId,
          report.locationId,
          report.assetId,
          report.orderNumber,
          JSON.stringify(report.values),
          report.status,
          report.syncStatus,
          report.syncError,
          report.createdBy,
          report.createdAt,
          report.completedAt,
          report.syncedAt,
        ]
      );
      synced.push(toReport(result.rows[0]));
    }

    await client.query('COMMIT');
    res.json({ syncedIds: synced.map((report) => report.id), reports: synced });
  } catch (error) {
    await client.query('ROLLBACK');
    const pgError = error as { code?: string; constraint?: string; detail?: string };
    const status = pgError.code === '23505' ? 409 : 400;
    const detail = pgError.detail ? ` ${pgError.detail}` : '';
    res.status(status).json({ error: `${String(error)}${detail}` });
  } finally {
    client.release();
  }
});

export default router;
