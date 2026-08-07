import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../db.js';
import { toSnake, toCamel } from '../mappers/camelSnake.js';

const router = Router();

// GET /api/asset-types
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM asset_types ORDER BY sort_order ASC NULLS LAST, label ASC'
    );
    res.json(result.rows.map((row) => toCamel(row)));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/asset-types  → upsert
router.post('/', async (req: Request, res: Response) => {
  try {
    const snakeObj = toSnake(req.body as Record<string, unknown>);
    const cols = Object.keys(snakeObj).filter((c) => /^[a-z_][a-z0-9_]*$/.test(c));
    const vals = cols.map((c) => snakeObj[c]);
    const placeholders = cols.map((_, i) => `$${i + 1}`);
    const setCols = cols.filter((c) => c !== 'id' && c !== 'created_at' && c !== 'code');
    const setClause = setCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ');

    const sql = `
      INSERT INTO asset_types (${cols.join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT (id) DO UPDATE SET ${setClause}
      RETURNING *
    `;
    const result = await pool.query(sql, vals);
    res.json(toCamel(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// PATCH /api/asset-types/:id/deactivate
router.patch('/:id/deactivate', async (req: Request, res: Response) => {
  try {
    await pool.query(
      'UPDATE asset_types SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );
    res.json({});
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// PATCH /api/asset-types/:id/reactivate
router.patch('/:id/reactivate', async (req: Request, res: Response) => {
  try {
    await pool.query(
      'UPDATE asset_types SET is_active = TRUE, updated_at = NOW() WHERE id = $1',
      [req.params.id]
    );
    res.json({});
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/asset-types/seed
router.post('/seed', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM asset_types');
    if (rows[0].count > 0) {
      return res.json({ seeded: false });
    }

    const now = new Date().toISOString();
    const trafoId = randomUUID();
    const seedData = [
      { id: trafoId, code: 'trafo', label: 'Transformator', short: 'Trafo', parent_type_id: null, sort_order: 1 },
      { id: randomUUID(), code: 'trafo_3w', label: 'Transformator – Dreiwickler', short: 'Trafo 3W', parent_type_id: trafoId, sort_order: 1 },
      { id: randomUUID(), code: 'leistungsschalter', label: 'Leistungsschalter', short: 'LS', parent_type_id: null, sort_order: 2 },
      { id: randomUUID(), code: 'trafostation', label: 'Trafostation', short: 'TS', parent_type_id: null, sort_order: 3 },
      { id: randomUUID(), code: 'schaltanlage_mv', label: 'Schaltanlage (MS)', short: 'SA MS', parent_type_id: null, sort_order: 4 },
      { id: randomUUID(), code: 'nshv', label: 'NSHV', short: 'NSHV', parent_type_id: null, sort_order: 5 },
    ];

    for (const row of seedData) {
      await pool.query(
        `INSERT INTO asset_types (id, code, label, short, parent_type_id, sort_order, icon, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NULL, TRUE, $7, $7)`,
        [row.id, row.code, row.label, row.short, row.parent_type_id, row.sort_order, now]
      );
    }

    res.json({ seeded: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
