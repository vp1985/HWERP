import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';

const { Pool, types } = pg;

// Return TIMESTAMPTZ/TIMESTAMP as ISO strings (not Date objects)
types.setTypeParser(types.builtins.TIMESTAMPTZ, (val: string) => new Date(val).toISOString());
types.setTypeParser(types.builtins.TIMESTAMP, (val: string) => new Date(val).toISOString());

// Return NUMERIC as float (not string)
types.setTypeParser(types.builtins.NUMERIC, parseFloat);

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
