import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { asc, eq, sql } from 'drizzle-orm';
import app from '../src/app.js';
import { db, pool } from '../src/db/client.js';
import { cards, columns } from '../src/db/schema.js';
import { agregarMiembro, crearColumna, crearTablero, crearTarjeta, crearUsuarioYToken } from './helpers.js';

const FECHA_VIEJA = '2000-01-01T00:00:00Z';

async function leerTarjeta(cardId: number) {
    const [fila] = await db.select().from(cards).where(eq(cards.id, cardId));
    return fila;
}

// Crea un usuario con un tablero y una columna: el arranque de casi todos los tests.
async function tableroConColumna(email = 'ana@mail.com', name = 'Ana') {
    const dueño = await crearUsuarioYToken(email, name);
    const boardId = await crearTablero(dueño.token);
    const columna = await crearColumna(dueño.token, boardId);
    return { dueño, boardId, columna };
}

describe('POST /columns/:id/cards', () => {
    function crear(token: string, columnId: number | string, body: object) {
        return request(app)
            .post(`/columns/${columnId}/cards`)
            .set('Authorization', `Bearer ${token}`)
            .send(body);
    }

    it('crea la tarjeta con la posicion 1000, sin descripcion, y devuelve su cuerpo', async () => {
        const { dueño, columna } = await tableroConColumna();

        const response = await crear(dueño.token, columna.id, { title: 'Definir alcance' });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
            columnId: columna.id,
            title: 'Definir alcance',
            description: null,
            position: 1000,
        });
        expect(response.body.id).toBeTypeOf('number');
        expect(response.body.createdAt).toBeTypeOf('string');
        expect(response.body.updatedAt).toBeTypeOf('string');

        const fila = await leerTarjeta(response.body.id);
        expect(fila).toMatchObject({ columnId: columna.id, title: 'Definir alcance', description: null, position: 1000 });
    });

    it('guarda la descripcion si se envia', async () => {
        const { dueño, columna } = await tableroConColumna();

        const response = await crear(dueño.token, columna.id, { title: 'Con detalle', description: 'Un texto largo' });

        expect(response.status).toBe(201);
        expect(response.body.description).toBe('Un texto largo');
    });

    it('las siguientes tarjetas van al final de la columna: 2000, 3000...', async () => {
        const { dueño, columna } = await tableroConColumna();

        const primera = await crearTarjeta(dueño.token, columna.id, 'Uno');
        const segunda = await crearTarjeta(dueño.token, columna.id, 'Dos');
        const tercera = await crearTarjeta(dueño.token, columna.id, 'Tres');

        expect([primera.position, segunda.position, tercera.position]).toEqual([1000, 2000, 3000]);
    });

    it('calcula la posicion con las tarjetas de ESA columna, no las de otras', async () => {
        const { dueño, boardId, columna } = await tableroConColumna();
        const otraColumna = await crearColumna(dueño.token, boardId, 'Otra');
        await crearTarjeta(dueño.token, columna.id, 'A1');
        await crearTarjeta(dueño.token, columna.id, 'A2');

        const deLaOtra = await crearTarjeta(dueño.token, otraColumna.id, 'B1');

        expect(deLaOtra.position).toBe(1000);
    });

    it('ignora la posicion y el columnId que mande el cliente', async () => {
        const { dueño, boardId, columna } = await tableroConColumna();
        const otraColumna = await crearColumna(dueño.token, boardId, 'Otra');

        const response = await crear(dueño.token, columna.id, { title: 'X', position: 5, columnId: otraColumna.id });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ columnId: columna.id, position: 1000 });
    });

    it('recorta los espacios del titulo y de la descripcion', async () => {
        const { dueño, columna } = await tableroConColumna();

        const response = await crear(dueño.token, columna.id, { title: '   Con espacios  ', description: '  detalle  ' });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ title: 'Con espacios', description: 'detalle' });
    });

    it('un editor puede crear tarjetas', async () => {
        const { boardId, columna } = await tableroConColumna();
        const editor = await crearUsuarioYToken('beto@mail.com', 'Beto');
        await agregarMiembro(boardId, editor.user.id, 'editor');

        const response = await crear(editor.token, columna.id, { title: 'De Beto' });

        expect(response.status).toBe(201);
    });

    it('responde 403 a un viewer y no crea nada', async () => {
        const { boardId, columna } = await tableroConColumna();
        const lector = await crearUsuarioYToken('beto@mail.com', 'Beto');
        await agregarMiembro(boardId, lector.user.id, 'viewer');

        const response = await crear(lector.token, columna.id, { title: 'Hackeada' });

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: 'Prohibido' });
        expect(await db.select().from(cards)).toHaveLength(0);
    });

    it('el rol se evalua en el tablero de la columna, no en otro donde el usuario es owner', async () => {
        const { boardId: tableroDeAna, columna } = await tableroConColumna('ana@mail.com', 'Ana');
        const beto = await crearUsuarioYToken('beto@mail.com', 'Beto');
        await crearTablero(beto.token, 'De Beto');
        await agregarMiembro(tableroDeAna, beto.user.id, 'viewer');

        const response = await crear(beto.token, columna.id, { title: 'Hackeada' });

        expect(response.status).toBe(403);
        expect(await db.select().from(cards)).toHaveLength(0);
    });

    it('responde 404 a quien no es miembro, igual que a una columna inexistente, y no crea nada', async () => {
        const { columna } = await tableroConColumna();
        const ajeno = await crearUsuarioYToken('beto@mail.com', 'Beto');

        const deAjeno = await crear(ajeno.token, columna.id, { title: 'X' });
        const inexistente = await crear(ajeno.token, 999999, { title: 'X' });

        expect(deAjeno.status).toBe(404);
        expect(deAjeno.body).toEqual(inexistente.body);
        expect(await db.select().from(cards)).toHaveLength(0);
    });

    it.each([
        ['sin title', {}, 'title'],
        ['con un title vacio', { title: '' }, 'title'],
        ['con un title de solo espacios', { title: '   ' }, 'title'],
        ['con un title de mas de 100 caracteres', { title: 'a'.repeat(101) }, 'title'],
        ['con un title que no es texto', { title: 5 }, 'title'],
        ['con una descripcion de mas de 2000 caracteres', { title: 'X', description: 'a'.repeat(2001) }, 'description'],
        ['con una descripcion que no es texto', { title: 'X', description: 5 }, 'description'],
    ])('responde 400 %s y no crea nada', async (_caso, body, campo) => {
        const { dueño, columna } = await tableroConColumna();

        const response = await crear(dueño.token, columna.id, body);

        expect(response.status).toBe(400);
        expect(response.body.fields).toHaveProperty(campo);
        expect(await db.select().from(cards)).toHaveLength(0);
    });

    it('responde 401 sin token', async () => {
        const response = await request(app).post('/columns/1/cards').send({ title: 'X' });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });
});

describe('PATCH /cards/:id', () => {
    function editar(token: string, cardId: number | string, body: object) {
        return request(app)
            .patch(`/cards/${cardId}`)
            .set('Authorization', `Bearer ${token}`)
            .send(body);
    }

    it.each(['owner', 'editor'] as const)('un %s cambia el titulo; no toca columna, posicion ni descripcion y updatedAt avanza', async (rol) => {
        const { dueño, boardId, columna } = await tableroConColumna();
        const miembro = await crearUsuarioYToken('beto@mail.com', 'Beto');
        if (rol !== 'owner') await agregarMiembro(boardId, miembro.user.id, rol);
        const tarjeta = await crearTarjeta(dueño.token, columna.id, 'Original', 'Detalle original');
        // Se retrocede updated_at para no depender de que el reloj de Postgres (defaultNow) y el de Node ($onUpdate)
        // coincidan al milisegundo: comparar los dos relojes haria fallar el test por 1 ms.
        await db.execute(sql`UPDATE cards SET updated_at = ${FECHA_VIEJA} WHERE id = ${tarjeta.id}`);
        const quien = rol === 'owner' ? dueño : miembro;

        const response = await editar(quien.token, tarjeta.id, { title: 'Nuevo titulo' });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            id: tarjeta.id,
            columnId: columna.id,
            title: 'Nuevo titulo',
            description: 'Detalle original',
            position: 1000,
        });
        const despues = await leerTarjeta(tarjeta.id);
        expect(despues).toMatchObject({ title: 'Nuevo titulo', description: 'Detalle original', columnId: columna.id });
        expect(despues!.updatedAt.getTime()).toBeGreaterThan(new Date(FECHA_VIEJA).getTime());
    });

    it('cambia la descripcion y deja el titulo igual', async () => {
        const { dueño, columna } = await tableroConColumna();
        const tarjeta = await crearTarjeta(dueño.token, columna.id, 'Original', 'Detalle original');

        const response = await editar(dueño.token, tarjeta.id, { description: 'Otro detalle' });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ title: 'Original', description: 'Otro detalle' });
    });

    it('description: null la borra (queda NULL en la base)', async () => {
        const { dueño, columna } = await tableroConColumna();
        const tarjeta = await crearTarjeta(dueño.token, columna.id, 'Original', 'Detalle original');

        const response = await editar(dueño.token, tarjeta.id, { description: null });

        expect(response.status).toBe(200);
        expect(response.body.description).toBeNull();
        const fila = await leerTarjeta(tarjeta.id);
        expect(fila?.description).toBeNull();
        expect(fila?.title).toBe('Original');
    });

    it('ignora columnId y position del body: editar no mueve la tarjeta', async () => {
        const { dueño, boardId, columna } = await tableroConColumna();
        const otraColumna = await crearColumna(dueño.token, boardId, 'Otra');
        const tarjeta = await crearTarjeta(dueño.token, columna.id, 'Original');

        const response = await editar(dueño.token, tarjeta.id, { title: 'X', columnId: otraColumna.id, position: 99 });

        expect(response.status).toBe(200);
        expect(await leerTarjeta(tarjeta.id)).toMatchObject({ title: 'X', columnId: columna.id, position: 1000 });
    });

    it('solo modifica la tarjeta indicada', async () => {
        const { dueño, columna } = await tableroConColumna();
        const primera = await crearTarjeta(dueño.token, columna.id, 'Primera');
        const segunda = await crearTarjeta(dueño.token, columna.id, 'Segunda');

        await editar(dueño.token, primera.id, { title: 'Editada' });

        expect((await leerTarjeta(primera.id))?.title).toBe('Editada');
        expect((await leerTarjeta(segunda.id))?.title).toBe('Segunda');
    });

    it('responde 403 a un viewer y no cambia nada', async () => {
        const { dueño, boardId, columna } = await tableroConColumna();
        const lector = await crearUsuarioYToken('beto@mail.com', 'Beto');
        await agregarMiembro(boardId, lector.user.id, 'viewer');
        const tarjeta = await crearTarjeta(dueño.token, columna.id, 'Original');

        const response = await editar(lector.token, tarjeta.id, { title: 'Hackeada' });

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: 'Prohibido' });
        expect((await leerTarjeta(tarjeta.id))?.title).toBe('Original');
    });

    it('el rol se evalua en el tablero de la tarjeta, no en otro donde el usuario es owner', async () => {
        const { dueño, boardId, columna } = await tableroConColumna('ana@mail.com', 'Ana');
        const beto = await crearUsuarioYToken('beto@mail.com', 'Beto');
        await crearTablero(beto.token, 'De Beto');
        await agregarMiembro(boardId, beto.user.id, 'viewer');
        const tarjeta = await crearTarjeta(dueño.token, columna.id, 'Original');

        const response = await editar(beto.token, tarjeta.id, { title: 'Hackeada' });

        expect(response.status).toBe(403);
        expect((await leerTarjeta(tarjeta.id))?.title).toBe('Original');
    });

    it('responde 404 a quien no es miembro, igual que a una tarjeta inexistente', async () => {
        const { dueño, columna } = await tableroConColumna();
        const ajeno = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const tarjeta = await crearTarjeta(dueño.token, columna.id, 'Original');

        const deAjeno = await editar(ajeno.token, tarjeta.id, { title: 'Hackeada' });
        const inexistente = await editar(ajeno.token, 999999, { title: 'Hackeada' });

        expect(deAjeno.status).toBe(404);
        expect(deAjeno.body).toEqual(inexistente.body);
        expect((await leerTarjeta(tarjeta.id))?.title).toBe('Original');
    });

    it.each([
        ['un body vacio', {}],
        ['solo campos desconocidos', { columnId: 5 }],
        ['un title vacio', { title: '' }],
        ['un title de solo espacios', { title: '   ' }],
        ['un title de mas de 100 caracteres', { title: 'a'.repeat(101) }],
        ['title: null (el titulo es obligatorio)', { title: null }],
        ['una descripcion de mas de 2000 caracteres', { description: 'a'.repeat(2001) }],
    ])('responde 400 con %s y no cambia nada', async (_caso, body) => {
        const { dueño, columna } = await tableroConColumna();
        const tarjeta = await crearTarjeta(dueño.token, columna.id, 'Original', 'Detalle original');

        const response = await editar(dueño.token, tarjeta.id, body);

        expect(response.status).toBe(400);
        expect(await leerTarjeta(tarjeta.id)).toMatchObject({
            title: 'Original',
            description: 'Detalle original',
            columnId: columna.id,
        });
    });

    it('responde 401 sin token', async () => {
        const response = await request(app).patch('/cards/1').send({ title: 'X' });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });
});

describe('DELETE /cards/:id', () => {
    function borrar(token: string, cardId: number | string) {
        return request(app)
            .delete(`/cards/${cardId}`)
            .set('Authorization', `Bearer ${token}`);
    }

    it.each(['owner', 'editor'] as const)('un %s borra la tarjeta: 204 sin cuerpo; las demas tarjetas y la columna siguen', async (rol) => {
        const { dueño, boardId, columna } = await tableroConColumna();
        const miembro = await crearUsuarioYToken('beto@mail.com', 'Beto');
        if (rol !== 'owner') await agregarMiembro(boardId, miembro.user.id, rol);
        const aBorrar = await crearTarjeta(dueño.token, columna.id, 'A borrar');
        const queDeja = await crearTarjeta(dueño.token, columna.id, 'Se queda');
        const quien = rol === 'owner' ? dueño : miembro;

        const response = await borrar(quien.token, aBorrar.id);

        expect(response.status).toBe(204);
        expect(response.text).toBe('');
        expect(await leerTarjeta(aBorrar.id)).toBeUndefined();
        expect(await leerTarjeta(queDeja.id)).toBeDefined();
        expect(await db.select().from(columns).where(eq(columns.id, columna.id))).toHaveLength(1);
    });

    it('responde 403 a un viewer y la tarjeta sigue existiendo', async () => {
        const { dueño, boardId, columna } = await tableroConColumna();
        const lector = await crearUsuarioYToken('beto@mail.com', 'Beto');
        await agregarMiembro(boardId, lector.user.id, 'viewer');
        const tarjeta = await crearTarjeta(dueño.token, columna.id);

        const response = await borrar(lector.token, tarjeta.id);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: 'Prohibido' });
        expect(await leerTarjeta(tarjeta.id)).toBeDefined();
    });

    it('responde 404 a quien no es miembro, igual que a una tarjeta inexistente, y la tarjeta sigue existiendo', async () => {
        const { dueño, columna } = await tableroConColumna();
        const ajeno = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const tarjeta = await crearTarjeta(dueño.token, columna.id);

        const deAjeno = await borrar(ajeno.token, tarjeta.id);
        const inexistente = await borrar(ajeno.token, 999999);

        expect(deAjeno.status).toBe(404);
        expect(deAjeno.body).toEqual(inexistente.body);
        expect(await leerTarjeta(tarjeta.id)).toBeDefined();
    });

    it('responde 401 sin token y no borra nada', async () => {
        const { dueño, columna } = await tableroConColumna();
        const tarjeta = await crearTarjeta(dueño.token, columna.id);

        const response = await request(app).delete(`/cards/${tarjeta.id}`);

        expect(response.status).toBe(401);
        expect(await leerTarjeta(tarjeta.id)).toBeDefined();
    });
});

describe('PATCH /cards/:id/move', () => {
    function mover(token: string, cardId: number | string, body: object) {
        return request(app)
            .patch(`/cards/${cardId}/move`)
            .set('Authorization', `Bearer ${token}`)
            .send(body);
    }

    // Las tarjetas de una columna tal como las ordena la base (position y desempate por id): [titulo, position].
    async function tarjetasDe(columnId: number) {
        const filas = await db
            .select()
            .from(cards)
            .where(eq(cards.columnId, columnId))
            .orderBy(asc(cards.position), asc(cards.id));
        return filas.map((fila) => [fila.title, fila.position]);
    }

    function idDe(ids: Record<string, number>, titulo: string) {
        const id = ids[titulo];
        if (id === undefined) throw new Error(`No hay una tarjeta ${titulo}`);
        return id;
    }

    // Tablero con una columna de origen (con X y O2) y una de destino (con D1 y D2, posiciones 1000 y 2000).
    async function tableroConDosColumnas() {
        const { dueño, boardId, columna: origen } = await tableroConColumna();
        const destino = await crearColumna(dueño.token, boardId, 'Destino');
        const x = await crearTarjeta(dueño.token, origen.id, 'X');
        await crearTarjeta(dueño.token, origen.id, 'O2');
        const d1 = await crearTarjeta(dueño.token, destino.id, 'D1');
        const d2 = await crearTarjeta(dueño.token, destino.id, 'D2');
        return { dueño, boardId, origen, destino, x, d1, d2 };
    }

    async function estadoCompleto(origenId: number, destinoId: number) {
        return [await tarjetasDe(origenId), await tarjetasDe(destinoId)];
    }

    it.each<[string, string, string | null, Array<[string, number]>]>([
        ['al principio (afterId null)', 'C', null, [['C', 0], ['A', 1000], ['B', 2000]]],
        ['entre otras dos (punto medio)', 'C', 'A', [['A', 1000], ['C', 1500], ['B', 2000]]],
        ['al final (1000 despues de la ultima)', 'A', 'C', [['B', 2000], ['C', 3000], ['A', 4000]]],
        ['despues de la que ya tiene arriba (no cambia el orden)', 'B', 'A', [['A', 1000], ['B', 2000], ['C', 3000]]],
    ])('dentro de la misma columna: %s', async (_caso, mueve, despuesDe, esperado) => {
        const { dueño, columna } = await tableroConColumna();
        const a = await crearTarjeta(dueño.token, columna.id, 'A');
        const b = await crearTarjeta(dueño.token, columna.id, 'B');
        const c = await crearTarjeta(dueño.token, columna.id, 'C');
        const ids = { A: a.id, B: b.id, C: c.id };

        const response = await mover(dueño.token, idDe(ids, mueve), {
            columnId: columna.id,
            afterId: despuesDe === null ? null : idDe(ids, despuesDe),
        });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ id: idDe(ids, mueve), columnId: columna.id });
        expect(await tarjetasDe(columna.id)).toEqual(esperado);
    });

    it('a otra columna del mismo tablero: queda entre las dos vecinas, sale del origen y no toca a las demas', async () => {
        const { dueño, origen, destino, x, d1 } = await tableroConDosColumnas();

        const response = await mover(dueño.token, x.id, { columnId: destino.id, afterId: d1.id });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ id: x.id, columnId: destino.id, position: 1500 });
        expect(await estadoCompleto(origen.id, destino.id)).toEqual([
            [['O2', 2000]],
            [['D1', 1000], ['X', 1500], ['D2', 2000]],
        ]);
    });

    it.each<[string, 'D2' | null, number, Array<[string, number]>]>([
        ['al principio de la otra columna', null, 0, [['X', 0], ['D1', 1000], ['D2', 2000]]],
        ['al final de la otra columna', 'D2', 3000, [['D1', 1000], ['D2', 2000], ['X', 3000]]],
    ])('a otra columna, %s', async (_caso, despuesDe, posicion, esperado) => {
        const { dueño, destino, x, d2 } = await tableroConDosColumnas();

        const response = await mover(dueño.token, x.id, {
            columnId: destino.id,
            afterId: despuesDe === 'D2' ? d2.id : null,
        });

        expect(response.status).toBe(200);
        expect(response.body.position).toBe(posicion);
        expect(await tarjetasDe(destino.id)).toEqual(esperado);
    });

    it('a una columna vacia queda con la posicion 1000', async () => {
        const { dueño, boardId, x } = await tableroConDosColumnas();
        const vacia = await crearColumna(dueño.token, boardId, 'Vacia');

        const response = await mover(dueño.token, x.id, { columnId: vacia.id, afterId: null });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ columnId: vacia.id, position: 1000 });
    });

    // Se fuerza el hueco agotado por SQL: D1 y D2 con la misma posicion, o con dos numeros double consecutivos.
    it.each([
        ['iguales', 1000, 1000],
        ['consecutivas en double', 1, 1 + Number.EPSILON],
    ])('si las vecinas del destino estan pegadas (%s) renumera solo esa columna de a 1000', async (_caso, posD1, posD2) => {
        const { dueño, origen, destino, x, d1, d2 } = await tableroConDosColumnas();
        await crearTarjeta(dueño.token, destino.id, 'D3');
        await db.update(cards).set({ position: posD1 }).where(eq(cards.id, d1.id));
        await db.update(cards).set({ position: posD2 }).where(eq(cards.id, d2.id));

        const response = await mover(dueño.token, x.id, { columnId: destino.id, afterId: d1.id });

        expect(response.status).toBe(200);
        expect(response.body.position).toBe(2000);
        expect(await estadoCompleto(origen.id, destino.id)).toEqual([
            [['O2', 2000]],
            [['D1', 1000], ['X', 2000], ['D2', 3000], ['D3', 4000]],
        ]);
    });

    // Dos tarjetas empatadas se ordenan por id. Sin ese desempate quedaria el orden fisico de la base, que normalmente
    // coincide con el de id; por eso se reescriben B y A (en ese orden) para que sus filas pasen al final: fisicamente B va antes que A.
    it('si dos vecinas tienen la misma posicion las desempata por id, no por su orden fisico en la base', async () => {
        const { dueño, columna } = await tableroConColumna();
        const a = await crearTarjeta(dueño.token, columna.id, 'A');
        const b = await crearTarjeta(dueño.token, columna.id, 'B');
        await crearTarjeta(dueño.token, columna.id, 'C');
        const d = await crearTarjeta(dueño.token, columna.id, 'D');
        await db.update(cards).set({ position: 1000 }).where(eq(cards.id, b.id));
        await db.update(cards).set({ position: 1000 }).where(eq(cards.id, a.id));

        const response = await mover(dueño.token, d.id, { columnId: columna.id, afterId: a.id });

        expect(response.status).toBe(200);
        expect(await tarjetasDe(columna.id)).toEqual([['A', 1000], ['D', 2000], ['B', 3000], ['C', 4000]]);
    });

    it('el rescate no toca las tarjetas de otros tableros', async () => {
        const { dueño, columna } = await tableroConColumna();
        const a = await crearTarjeta(dueño.token, columna.id, 'A');
        const b = await crearTarjeta(dueño.token, columna.id, 'B');
        const d = await crearTarjeta(dueño.token, columna.id, 'D');
        const otroTablero = await crearTablero(dueño.token, 'Otro');
        const otraColumna = await crearColumna(dueño.token, otroTablero);
        await crearTarjeta(dueño.token, otraColumna.id, 'Z1');
        await crearTarjeta(dueño.token, otraColumna.id, 'Z2');
        await db.update(cards).set({ position: 1000 }).where(eq(cards.id, b.id));

        const response = await mover(dueño.token, d.id, { columnId: columna.id, afterId: a.id });

        expect(response.status).toBe(200);
        expect(await tarjetasDe(otraColumna.id)).toEqual([['Z1', 1000], ['Z2', 2000]]);
    });

    it('al moverla conserva el titulo, la descripcion y la fecha de creacion', async () => {
        const { dueño, destino, origen } = await tableroConDosColumnas();
        const conTexto = await crearTarjeta(dueño.token, origen.id, 'Con texto', 'una descripcion');
        const antes = await leerTarjeta(conTexto.id);

        const response = await mover(dueño.token, conTexto.id, { columnId: destino.id, afterId: null });

        expect(response.status).toBe(200);
        const despues = await leerTarjeta(conTexto.id);
        expect(despues).toMatchObject({ title: 'Con texto', description: 'una descripcion' });
        expect(despues?.createdAt).toEqual(antes?.createdAt);
    });

    it.each(['owner', 'editor'] as const)('un %s puede mover tarjetas', async (rol) => {
        const { dueño, boardId, origen, destino, x } = await tableroConDosColumnas();
        const miembro = await crearUsuarioYToken('beto@mail.com', 'Beto');
        if (rol !== 'owner') await agregarMiembro(boardId, miembro.user.id, rol);
        const quien = rol === 'owner' ? dueño : miembro;

        const response = await mover(quien.token, x.id, { columnId: destino.id, afterId: null });

        expect(response.status).toBe(200);
        expect(await tarjetasDe(origen.id)).toEqual([['O2', 2000]]);
    });

    it('responde 403 a un viewer y no cambia nada', async () => {
        const { boardId, origen, destino, x } = await tableroConDosColumnas();
        const lector = await crearUsuarioYToken('beto@mail.com', 'Beto');
        await agregarMiembro(boardId, lector.user.id, 'viewer');
        const antes = await estadoCompleto(origen.id, destino.id);

        const response = await mover(lector.token, x.id, { columnId: destino.id, afterId: null });

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: 'Prohibido' });
        expect(await estadoCompleto(origen.id, destino.id)).toEqual(antes);
    });

    it('el rol se evalua en el tablero de la tarjeta, no en otro donde el usuario es owner', async () => {
        const { boardId, origen, destino, x } = await tableroConDosColumnas();
        const beto = await crearUsuarioYToken('beto@mail.com', 'Beto');
        await crearTablero(beto.token, 'De Beto');
        await agregarMiembro(boardId, beto.user.id, 'viewer');
        const antes = await estadoCompleto(origen.id, destino.id);

        const response = await mover(beto.token, x.id, { columnId: destino.id, afterId: null });

        expect(response.status).toBe(403);
        expect(await estadoCompleto(origen.id, destino.id)).toEqual(antes);
    });

    it('responde 404 a quien no es miembro, igual que a una tarjeta inexistente', async () => {
        const { origen, destino, x } = await tableroConDosColumnas();
        const ajeno = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const antes = await estadoCompleto(origen.id, destino.id);

        const deAjeno = await mover(ajeno.token, x.id, { columnId: destino.id, afterId: null });
        const inexistente = await mover(ajeno.token, 999999, { columnId: destino.id, afterId: null });

        expect(deAjeno.status).toBe(404);
        expect(deAjeno.body).toEqual(inexistente.body);
        expect(await estadoCompleto(origen.id, destino.id)).toEqual(antes);
    });

    it('responde 400 si la columna destino no existe, y no cambia nada', async () => {
        const { dueño, origen, destino, x } = await tableroConDosColumnas();
        const antes = await estadoCompleto(origen.id, destino.id);

        const response = await mover(dueño.token, x.id, { columnId: 999999, afterId: null });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Movimiento invalido' });
        expect(await estadoCompleto(origen.id, destino.id)).toEqual(antes);
    });

    it('responde 400 si la columna destino es de otro tablero (propio o ajeno), con el mismo cuerpo que si no existiera', async () => {
        const { dueño, origen, destino, x } = await tableroConDosColumnas();
        const otroTableroPropio = await crearTablero(dueño.token, 'Otro propio');
        const columnaPropia = await crearColumna(dueño.token, otroTableroPropio);
        const ajeno = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const tableroAjeno = await crearTablero(ajeno.token, 'De Beto');
        const columnaAjena = await crearColumna(ajeno.token, tableroAjeno);
        const antes = await estadoCompleto(origen.id, destino.id);

        const aPropia = await mover(dueño.token, x.id, { columnId: columnaPropia.id, afterId: null });
        const aAjena = await mover(dueño.token, x.id, { columnId: columnaAjena.id, afterId: null });
        const inexistente = await mover(dueño.token, x.id, { columnId: 999999, afterId: null });

        expect(aPropia.status).toBe(400);
        expect(aPropia.body).toEqual(inexistente.body);
        expect(aAjena.status).toBe(400);
        expect(aAjena.body).toEqual(inexistente.body);
        expect(await estadoCompleto(origen.id, destino.id)).toEqual(antes);
        expect(await tarjetasDe(columnaPropia.id)).toEqual([]);
        expect(await tarjetasDe(columnaAjena.id)).toEqual([]);
    });

    it('responde 400 si afterId no existe, y no cambia nada', async () => {
        const { dueño, origen, destino, x } = await tableroConDosColumnas();
        const antes = await estadoCompleto(origen.id, destino.id);

        const response = await mover(dueño.token, x.id, { columnId: destino.id, afterId: 999999 });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Movimiento invalido' });
        expect(await estadoCompleto(origen.id, destino.id)).toEqual(antes);
    });

    it('responde 400 si afterId es una tarjeta que no esta en la columna destino (aunque sea del mismo tablero)', async () => {
        const { dueño, origen, destino, x } = await tableroConDosColumnas();
        const [o2] = await db.select().from(cards).where(eq(cards.title, 'O2'));
        const antes = await estadoCompleto(origen.id, destino.id);

        const response = await mover(dueño.token, x.id, { columnId: destino.id, afterId: o2?.id ?? 0 });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Movimiento invalido' });
        expect(await estadoCompleto(origen.id, destino.id)).toEqual(antes);
    });

    it('responde 400 si afterId es una tarjeta de otro tablero, con el mismo cuerpo que si no existiera', async () => {
        const { dueño, origen, destino, x } = await tableroConDosColumnas();
        const otroTablero = await crearTablero(dueño.token, 'Otro');
        const otraColumna = await crearColumna(dueño.token, otroTablero);
        const ajena = await crearTarjeta(dueño.token, otraColumna.id, 'Ajena');
        const antes = await estadoCompleto(origen.id, destino.id);

        const deOtro = await mover(dueño.token, x.id, { columnId: destino.id, afterId: ajena.id });
        const inexistente = await mover(dueño.token, x.id, { columnId: destino.id, afterId: 999999 });

        expect(deOtro.status).toBe(400);
        expect(deOtro.body).toEqual(inexistente.body);
        expect(await estadoCompleto(origen.id, destino.id)).toEqual(antes);
        expect(await tarjetasDe(otraColumna.id)).toEqual([['Ajena', 1000]]);
    });

    it.each(['en otra columna', 'en la misma columna'])('responde 400 si afterId es la propia tarjeta (%s)', async (caso) => {
        const { dueño, origen, destino, x } = await tableroConDosColumnas();
        const antes = await estadoCompleto(origen.id, destino.id);
        const columnId = caso === 'en la misma columna' ? origen.id : destino.id;

        const response = await mover(dueño.token, x.id, { columnId, afterId: x.id });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Movimiento invalido' });
        expect(await estadoCompleto(origen.id, destino.id)).toEqual(antes);
    });

    it.each([
        ['sin columnId', { afterId: null }, 'columnId'],
        ['con columnId como texto', { columnId: '1', afterId: null }, 'columnId'],
        ['con columnId 0', { columnId: 0, afterId: null }, 'columnId'],
        ['con columnId negativo', { columnId: -1, afterId: null }, 'columnId'],
        ['con columnId decimal', { columnId: 1.5, afterId: null }, 'columnId'],
        ['con columnId mayor al maximo de un int4', { columnId: 2_147_483_648, afterId: null }, 'columnId'],
        ['con columnId null', { columnId: null, afterId: null }, 'columnId'],
        ['sin afterId', { columnId: 1 }, 'afterId'],
        ['con afterId como texto', { columnId: 1, afterId: '1' }, 'afterId'],
        ['con afterId 0', { columnId: 1, afterId: 0 }, 'afterId'],
        ['con afterId negativo', { columnId: 1, afterId: -1 }, 'afterId'],
        ['con afterId decimal', { columnId: 1, afterId: 1.5 }, 'afterId'],
        ['con afterId mayor al maximo de un int4', { columnId: 1, afterId: 2_147_483_648 }, 'afterId'],
    ])('responde 400 %s y no cambia nada', async (_caso, body, campo) => {
        const { dueño, origen, destino, x } = await tableroConDosColumnas();
        const antes = await estadoCompleto(origen.id, destino.id);

        const response = await mover(dueño.token, x.id, body);

        expect(response.status).toBe(400);
        expect(response.body.fields).toHaveProperty(campo);
        expect(await estadoCompleto(origen.id, destino.id)).toEqual(antes);
    });

    it('ignora position, title y description del body: solo mandan columnId y afterId', async () => {
        const { dueño, destino, x } = await tableroConDosColumnas();

        const response = await mover(dueño.token, x.id, {
            columnId: destino.id,
            afterId: null,
            position: 99999,
            title: 'Hackeada',
            description: 'Hackeada',
        });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ title: 'X', description: null, position: 0 });
    });

    it('responde 401 sin token', async () => {
        const response = await request(app).patch('/cards/1/move').send({ columnId: 1, afterId: null });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });

    // Carrera determinista: una transaccion "T" (a mano) bloquea las columnas del tablero y mueve D2 al principio de
    // la columna destino SIN confirmar todavia. Mientras tanto se pide mover X a esa columna, despues de D1. Ese pedido
    // tiene que esperar el candado y, cuando T confirma, calcular sobre el orden NUEVO (D2, D1): X queda en 2000.
    // Sin el candado el pedido no espera, ve el orden viejo (D1, D2) y deja a X en 1500.
    it('un pedido que espera el candado del tablero calcula sobre el orden confirmado por el otro movimiento', async () => {
        const { dueño, boardId, destino, x, d1, d2 } = await tableroConDosColumnas();

        const conexionT = await pool.connect();
        try {
            await conexionT.query('BEGIN');
            await conexionT.query('SELECT id FROM columns WHERE board_id = $1 FOR UPDATE', [boardId]);
            await conexionT.query('UPDATE cards SET position = 500 WHERE id = $1', [d2.id]);

            // .then() hace que supertest envie la request ahora, sin esperar la respuesta.
            const pedido = mover(dueño.token, x.id, { columnId: destino.id, afterId: d1.id }).then((r) => r);

            await new Promise((resolve) => setTimeout(resolve, 400));
            await conexionT.query('COMMIT');

            const respuesta = await pedido;

            expect(respuesta.status).toBe(200);
            expect(respuesta.body.position).toBe(2000);
        } finally {
            await conexionT.query('ROLLBACK').catch(() => undefined);
            conexionT.release();
        }

        expect(await tarjetasDe(destino.id)).toEqual([['D2', 500], ['D1', 1000], ['X', 2000]]);
    });
});

// Un id invalido en la URL tiene que dar 404 en JSON y nunca llegar a la base (que respondería 500).
// Se usa una columna y una tarjeta reales para que un id invalido que se colara por el schema llegue a la consulta.
describe('ids invalidos en la URL (tarjetas)', () => {
    const INVALIDOS = ['abc', '0', '-1', '1.5', '99999999999'];

    const RUTAS = [
        { metodo: 'post', ruta: '/columns/:id/cards', body: { title: 'X' } },
        { metodo: 'patch', ruta: '/cards/:id', body: { title: 'X' } },
        { metodo: 'patch', ruta: '/cards/:id/move', body: { columnId: 1, afterId: null } },
        { metodo: 'delete', ruta: '/cards/:id' },
    ] as const;

    it.each(RUTAS)('$metodo $ruta responde 404 (no 500) con cada id invalido', async ({ metodo, ruta, ...resto }) => {
        const { dueño, columna } = await tableroConColumna();
        const tarjeta = await crearTarjeta(dueño.token, columna.id);

        for (const invalido of INVALIDOS) {
            const url = ruta.replace(':id', invalido);

            const pedido = request(app)[metodo](url).set('Authorization', `Bearer ${dueño.token}`);
            const response = await ('body' in resto ? pedido.send(resto.body) : pedido);

            expect(response.status, `${metodo.toUpperCase()} ${url}`).toBe(404);
            expect(response.body, `${metodo.toUpperCase()} ${url}`).toEqual({ error: 'No encontrado' });
        }

        expect(await leerTarjeta(tarjeta.id)).toBeDefined();
        expect(await db.select().from(cards)).toHaveLength(1);
    });
});
