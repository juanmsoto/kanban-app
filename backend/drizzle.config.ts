import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const url =
    process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

if (!url) {
    throw new Error('Falta DATABASE_URL o TEST_DATABASE_URL en el .env');
}

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/db/schema.ts',
    out: './drizzle',
    dbCredentials: { url },
});
