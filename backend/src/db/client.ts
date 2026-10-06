import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

const connectionString =
    process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

if(!connectionString) {
    throw new Error('Falta DATABASE_URL o TEST_DATABASE_URL en el .env');
}

export const pool = new Pool({ connectionString });
export const db = drizzle({ client: pool });