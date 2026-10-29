import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { eq, sql } from 'drizzle-orm';
import app from '../src/app.js';
import { db } from '../src/db/client.js';
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

// Un id invalido en la URL tiene que dar 404 en JSON y nunca llegar a la base (que respondería 500).
// Se usa una columna y una tarjeta reales para que un id invalido que se colara por el schema llegue a la consulta.
describe('ids invalidos en la URL (tarjetas)', () => {
    const INVALIDOS = ['abc', '0', '-1', '1.5', '99999999999'];

    const RUTAS = [
        { metodo: 'post', ruta: '/columns/:id/cards', body: { title: 'X' } },
        { metodo: 'patch', ruta: '/cards/:id', body: { title: 'X' } },
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
