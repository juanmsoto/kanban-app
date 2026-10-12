import { describe, it, expect, vi } from 'vitest';
import { inspect } from 'node:util';
import { DrizzleQueryError } from 'drizzle-orm';
import { DatabaseError } from 'pg';
import { errorHandler } from '../src/middlewares/errorHandler.js';

describe('errorHandler', () => {
    it('no vuelca el password_hash en el log cuando falla una consulta', () => {
        // 1) Preparar: un error igual al que arma Drizzle, con un hash reconocible en los params.
        const causa = new DatabaseError('duplicate key value violates unique constraint "users_email_key"', 0, 'error');
        causa.code = '23505';
        causa.constraint = 'users_email_key';
        causa.detail = 'Key (email)=(ana@x.com) already exists.';

        const err = new DrizzleQueryError(
            'insert into "users" ("name", "email", "password_hash") values ($1, $2, $3)',
            ['Ana', 'ana@x.com', '$2b$10$HASH_DE_PRUEBA'],
            causa,
        );

        // 2) Preparar: la "grabadora" en console.error y una respuesta falsa.
        const grabadora = vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

        // 3) Actuar: llamar al manejador como si Express se lo hubiera pasado.
        errorHandler(err, {} as never, res as never, vi.fn());

        // 4) Comprobar: respuesta 500 y el hash no aparece en nada de lo que se logueo.
        const logueado = inspect(grabadora.mock.calls, { depth: null });
        grabadora.mockRestore();

        expect(res.status).toHaveBeenCalledWith(500);
        expect(logueado).not.toContain('HASH_DE_PRUEBA');
    });
});
