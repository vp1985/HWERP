import { Router, Request, Response } from 'express';
import type { PoolClient } from 'pg';
import { pool } from '../db.js';
import {
  DEFAULT_NUMBER_CIRCLE_SEEDS,
  applyYearlyReset,
  findReusableReturnedBlock,
  formatNumberCircle,
  getPreviewForCircle,
  parseReusableNumberValue,
  parseTrailingNumber,
  validateNumberCircleConfig,
} from '../lib/numberCircles.js';
import type { NumberCircle } from '../lib/numberCircles.js';

const router = Router();

type NumberCircleRow = {
  key: string;
  label: string;
  prefix: string;
  format_template: string;
  padding: number;
  next_value: number;
  reset_yearly: boolean;
  last_year: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ReturnedNumberRow = {
  number: string;
};

function toNumberCircle(row: NumberCircleRow, maxUsedNumber: number | null = null): NumberCircle {
  return {
    key: row.key,
    label: row.label,
    prefix: row.prefix,
    formatTemplate: row.format_template,
    padding: row.padding,
    nextValue: row.next_value,
    resetYearly: row.reset_yearly,
    lastYear: row.last_year,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    maxUsedNumber,
  };
}

async function ensureDefaultNumberCircles(client: PoolClient) {
  const currentYear = new Date().getFullYear();
  const sequenceResult = await client.query<{ next_value: number }>('SELECT next_value FROM sequences LIMIT 1');
  const sequenceNextValue = sequenceResult.rows[0]?.next_value ?? 1;

  for (const seed of DEFAULT_NUMBER_CIRCLE_SEEDS) {
    await client.query(
      `
        INSERT INTO number_circles
          (key, label, prefix, format_template, padding, next_value, reset_yearly, last_year, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (key) DO NOTHING
      `,
      [
        seed.key,
        seed.label,
        seed.prefix,
        seed.formatTemplate,
        seed.padding,
        seed.key === 'calculations' ? sequenceNextValue : seed.nextValue,
        seed.resetYearly,
        currentYear,
        seed.isActive,
      ],
    );
  }
}

async function getMaxUsedNumber(key: string): Promise<number | null> {
  if (key === 'calculations') {
    const result = await pool.query<{ number: string }>('SELECT number FROM calculations');
    const parsed = result.rows
      .map((row) => parseTrailingNumber(row.number))
      .filter((value): value is number => value !== null);

    return parsed.length > 0 ? Math.max(...parsed) : null;
  }

  if (key === 'customers') {
    const result = await pool.query<{ customer_number: string | null }>('SELECT customer_number FROM customers WHERE customer_number IS NOT NULL');
    const parsed = result.rows
      .map((row) => parseTrailingNumber(row.customer_number ?? ''))
      .filter((value): value is number => value !== null);

    return parsed.length > 0 ? Math.max(...parsed) : null;
  }

  if (key === 'inquiries') {
    const result = await pool.query<{ inquiry_number: string | null }>('SELECT inquiry_number FROM inquiries WHERE inquiry_number IS NOT NULL');
    const parsed = result.rows
      .map((row) => parseTrailingNumber(row.inquiry_number ?? ''))
      .filter((value): value is number => value !== null);

    return parsed.length > 0 ? Math.max(...parsed) : null;
  }

  return null;
}

async function getNumberCircle(client: PoolClient, key: string, forUpdate = false): Promise<NumberCircleRow | null> {
  const result = await client.query<NumberCircleRow>(
    `SELECT * FROM number_circles WHERE key = $1${forUpdate ? ' FOR UPDATE' : ''}`,
    [key]
  );
  return result.rows[0] ?? null;
}

async function getReturnedNumbers(client: PoolClient, key: string): Promise<string[]> {
  const result = await client.query<ReturnedNumberRow>(
    'SELECT number FROM number_circle_returned_numbers WHERE circle_key = $1 ORDER BY number ASC',
    [key]
  );
  return result.rows.map((row) => row.number);
}

async function reserveReturnedNumbers(
  client: PoolClient,
  row: NumberCircleRow,
  quantity: number
): Promise<string[]> {
  const result = await client.query<ReturnedNumberRow>(
    `
      SELECT number
      FROM number_circle_returned_numbers
      WHERE circle_key = $1
      ORDER BY number ASC
      FOR UPDATE
    `,
    [row.key]
  );
  const numbers = findReusableReturnedBlock(result.rows.map((item) => item.number), quantity);
  if (numbers.length !== quantity) return [];

  await client.query(
    'DELETE FROM number_circle_returned_numbers WHERE circle_key = $1 AND number = ANY($2::text[])',
    [row.key, numbers]
  );
  return numbers;
}

export async function reserveNextNumbers(key: string, quantity = 1): Promise<{ number: string; numbers: string[] }> {
  const safeQuantity = Number(quantity);
  if (!Number.isInteger(safeQuantity) || safeQuantity < 1 || safeQuantity > 100) {
    throw new Error('Menge muss eine ganze Zahl zwischen 1 und 100 sein.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureDefaultNumberCircles(client);

    const row = await getNumberCircle(client, key, true);
    if (!row) {
      throw new Error(`Unbekannter Nummernkreis: ${key}`);
    }
    if (!row.is_active) {
      throw new Error(`Nummernkreis ist inaktiv: ${key}`);
    }

    const returnedNumbers = await reserveReturnedNumbers(client, row, safeQuantity);
    if (returnedNumbers.length === safeQuantity) {
      await client.query('COMMIT');
      return { number: returnedNumbers[0], numbers: returnedNumbers };
    }

    const reset = applyYearlyReset({
      nextValue: row.next_value,
      resetYearly: row.reset_yearly,
      lastYear: row.last_year,
    });

    const numbers: string[] = [];
    for (let index = 0; index < safeQuantity; index += 1) {
      numbers.push(formatNumberCircle({
        prefix: row.prefix,
        formatTemplate: row.format_template,
        padding: row.padding,
        value: reset.nextValue + index,
      }));
    }

    await client.query(
      `
        UPDATE number_circles
        SET next_value = $2,
            last_year = $3,
            updated_at = NOW()
        WHERE key = $1
      `,
      [key, reset.nextValue + safeQuantity, reset.lastYear]
    );

    if (key === 'calculations') {
      await client.query(
        'UPDATE sequences SET next_value = $1, updated_at = NOW() WHERE id = (SELECT id FROM sequences LIMIT 1)',
        [reset.nextValue + safeQuantity]
      );
      await client.query(
        'INSERT INTO sequences (next_value) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM sequences)',
        [reset.nextValue + safeQuantity]
      );
    }

    await client.query('COMMIT');
    return { number: numbers[0], numbers };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// GET /api/number-circles
router.get('/', async (_req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await ensureDefaultNumberCircles(client);
    const result = await client.query<NumberCircleRow>('SELECT * FROM number_circles ORDER BY label ASC');
    const circles = [];
    for (const row of result.rows) {
      const circle = toNumberCircle(row, await getMaxUsedNumber(row.key));
      const returnedNumbers = await getReturnedNumbers(client, row.key);
      circles.push({ ...circle, preview: getPreviewForCircle(circle, new Date(), returnedNumbers) });
    }
    res.json(circles);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  } finally {
    client.release();
  }
});

// POST /api/number-circles
router.post('/', async (req: Request, res: Response) => {
  const body = req.body as Partial<NumberCircle>;
  const normalized = {
    key: String(body.key ?? '').trim(),
    label: String(body.label ?? '').trim(),
    prefix: String(body.prefix ?? ''),
    formatTemplate: String(body.formatTemplate ?? ''),
    padding: Number(body.padding),
    nextValue: Number(body.nextValue),
    resetYearly: Boolean(body.resetYearly),
    lastYear: body.lastYear === null || body.lastYear === undefined ? new Date().getFullYear() : Number(body.lastYear),
    isActive: body.isActive !== false,
  };

  const errors = validateNumberCircleConfig(normalized);
  if (!Number.isInteger(normalized.lastYear)) {
    errors.push('Letztes Jahr muss eine ganze Zahl sein.');
  }
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  try {
    const result = await pool.query<NumberCircleRow>(
      `
        INSERT INTO number_circles
          (key, label, prefix, format_template, padding, next_value, reset_yearly, last_year, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (key) DO UPDATE SET
          label = EXCLUDED.label,
          prefix = EXCLUDED.prefix,
          format_template = EXCLUDED.format_template,
          padding = EXCLUDED.padding,
          next_value = EXCLUDED.next_value,
          reset_yearly = EXCLUDED.reset_yearly,
          last_year = EXCLUDED.last_year,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
        RETURNING *
      `,
      [
        normalized.key,
        normalized.label,
        normalized.prefix,
        normalized.formatTemplate,
        normalized.padding,
        normalized.nextValue,
        normalized.resetYearly,
        normalized.lastYear,
        normalized.isActive,
      ]
    );

    const circle = toNumberCircle(result.rows[0], await getMaxUsedNumber(result.rows[0].key));
    res.json({ ...circle, preview: getPreviewForCircle(circle) });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// POST /api/number-circles/preview
router.post('/preview', (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<NumberCircle>;
    const preview = formatNumberCircle({
      prefix: String(body.prefix ?? ''),
      formatTemplate: String(body.formatTemplate ?? ''),
      padding: Number(body.padding),
      value: Number(body.nextValue ?? 1),
    });
    res.json({ preview });
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// POST /api/number-circles/:key/next
router.post('/:key/next', async (req: Request, res: Response) => {
  try {
    const key = String(req.params.key);
    const quantity = req.body?.quantity === undefined ? 1 : Number(req.body.quantity);
    const result = await reserveNextNumbers(key, quantity);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: String(error) });
  }
});

// POST /api/number-circles/:key/return
router.post('/:key/return', async (req: Request, res: Response) => {
  const key = String(req.params.key);
  const number = String(req.body?.number ?? '').trim();
  if (!number) {
    return res.status(400).json({ error: 'Nummer ist erforderlich.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureDefaultNumberCircles(client);

    const row = await getNumberCircle(client, key, true);
    if (!row) {
      throw new Error(`Unbekannter Nummernkreis: ${key}`);
    }
    if (!row.is_active) {
      throw new Error(`Nummernkreis ist inaktiv: ${key}`);
    }

    if (!parseReusableNumberValue(number)) {
      throw new Error('Nummer muss mit einer laufenden Zahl enden.');
    }

    await client.query(
      `
        INSERT INTO number_circle_returned_numbers (circle_key, number)
        VALUES ($1, $2)
        ON CONFLICT (circle_key, number) DO NOTHING
      `,
      [row.key, number]
    );

    await client.query('COMMIT');
    res.json({ returned: true, number });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: String(error) });
  } finally {
    client.release();
  }
});

export default router;
