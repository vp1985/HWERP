import { Router, Request, Response } from 'express';
import { pool } from '../db.js';

const router = Router();

// POST /api/sequences/next-calc-number
router.post('/next-calc-number', async (_req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get the single sequences row (or create one if reset wiped it)
    let result = await client.query(
      'SELECT id, next_value FROM sequences LIMIT 1 FOR UPDATE'
    );

    if (result.rows.length === 0) {
      result = await client.query(
        'INSERT INTO sequences DEFAULT VALUES RETURNING id, next_value'
      );
    }

    const { id, next_value } = result.rows[0] as { id: string; next_value: number };

    await client.query(
      'UPDATE sequences SET next_value = next_value + 1, updated_at = NOW() WHERE id = $1',
      [id]
    );

    await client.query('COMMIT');

    const formatted = `K-${next_value.toString().padStart(6, '0')}`;
    res.json({ number: formatted });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: String(error) });
  } finally {
    client.release();
  }
});

export default router;
