import { beforeAll, beforeEach, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { db, pool } from '../src/db/client.js';

// Red de seguridad: este setup vacía tablas, así que se niega a correr
// contra cualquier base cuyo nombre no termine en "_test".
beforeAll(async () => {
  const result = await db.execute(sql`select current_database() as name`);
  const name = result.rows[0]?.name;

  if (typeof name !== 'string' || !name.endsWith('_test')) {
    throw new Error(
      `Los tests solo pueden correr contra una base *_test (conectado a: ${String(name)})`,
    );
  }
});

// Cada test arranca con las tablas vacías y los ids reiniciados.
beforeEach(async () => {
  await db.execute(
    sql`truncate table board_members, cards, columns, boards, users restart identity cascade`,
  );
});

afterAll(async () => {
  await pool.end();
});
