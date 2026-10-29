import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import app from '../src/app.js';
import { db } from '../src/db/client.js';
import { cards, columns } from '../src/db/schema.js';
import { agregarMiembro, crearColumna, crearTablero, crearUsuarioYToken } from './helpers.js';

async function leerColumna(columnId: number) {
    const [fila] = await db.select().from(columns).where(eq(columns.id, columnId));
    return fila;
}

describe('POST /boards/:id/columns', () => {
    it('crea la columna con la posicion 1000 y devuelve su cuerpo', async () => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTablero(token);

        const response = await request(app)
            .post(`/boards/${boardId}/columns`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'Por hacer' });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ boardId, title: 'Por hacer', position: 1000 });
        expect(response.body.id).toBeTypeOf('number');
        expect(response.body.createdAt).toBeTypeOf('string');

        const fila = await leerColumna(response.body.id);
        expect(fila).toMatchObject({ boardId, title: 'Por hacer', position: 1000 });
    });

    it('las siguientes columnas van al final: 2000, 3000...', async () => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTablero(token);

        const primera = await crearColumna(token, boardId, 'Uno');
        const segunda = await crearColumna(token, boardId, 'Dos');
        const tercera = await crearColumna(token, boardId, 'Tres');

        expect([primera.position, segunda.position, tercera.position]).toEqual([1000, 2000, 3000]);
    });

    it('calcula la posicion a partir de la ultima columna del mismo tablero, no de otros', async () => {
        const { token } = await crearUsuarioYToken();
        const tableroA = await crearTablero(token, 'A');
        const tableroB = await crearTablero(token, 'B');

        await crearColumna(token, tableroA, 'A1');
        await crearColumna(token, tableroA, 'A2');
        const deB = await crearColumna(token, tableroB, 'B1');

        expect(deB.position).toBe(1000);
    });

    it('ignora la posicion y el boardId que mande el cliente', async () => {
        const { token } = await crearUsuarioYToken();
        const tableroA = await crearTablero(token, 'A');
        const tableroB = await crearTablero(token, 'B');

        const response = await request(app)
            .post(`/boards/${tableroA}/columns`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title: 'X', position: 5, boardId: tableroB });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ boardId: tableroA, position: 1000 });
    });

    it('recorta los espacios del titulo', async () => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTablero(token);

        const response = await request(app)
            .post(`/boards/${boardId}/columns`)
            .set('Authorization', `Bearer ${token}`)
            .send({ title: '   En curso   ' });

        expect(response.status).toBe(201);
        expect(response.body.title).toBe('En curso');
    });

    it('un editor puede crear columnas', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const editor = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await agregarMiembro(boardId, editor.user.id, 'editor');

        const response = await request(app)
            .post(`/boards/${boardId}/columns`)
            .set('Authorization', `Bearer ${editor.token}`)
            .send({ title: 'De Beto' });

        expect(response.status).toBe(201);
    });

    it('responde 403 a un viewer y no crea nada', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const lector = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await agregarMiembro(boardId, lector.user.id, 'viewer');

        const response = await request(app)
            .post(`/boards/${boardId}/columns`)
            .set('Authorization', `Bearer ${lector.token}`)
            .send({ title: 'Hackeada' });

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: 'Prohibido' });
        expect(await db.select().from(columns)).toHaveLength(0);
    });

    it('responde 404 a quien no es miembro, igual que a un tablero inexistente, y no crea nada', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const ajeno = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);

        const deAjeno = await request(app)
            .post(`/boards/${boardId}/columns`)
            .set('Authorization', `Bearer ${ajeno.token}`)
            .send({ title: 'X' });
        const inexistente = await request(app)
            .post('/boards/999999/columns')
            .set('Authorization', `Bearer ${ajeno.token}`)
            .send({ title: 'X' });

        expect(deAjeno.status).toBe(404);
        expect(deAjeno.body).toEqual(inexistente.body);
        expect(await db.select().from(columns)).toHaveLength(0);
    });

    it.each([
        ['sin title', {}],
        ['con un title vacio', { title: '' }],
        ['con un title de solo espacios', { title: '   ' }],
        ['con un title de mas de 100 caracteres', { title: 'a'.repeat(101) }],
        ['con un title que no es texto', { title: 5 }],
    ])('responde 400 %s y no crea nada', async (_caso, body) => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTablero(token);

        const response = await request(app)
            .post(`/boards/${boardId}/columns`)
            .set('Authorization', `Bearer ${token}`)
            .send(body);

        expect(response.status).toBe(400);
        expect(response.body.fields).toHaveProperty('title');
        expect(await db.select().from(columns)).toHaveLength(0);
    });

    it('responde 401 sin token', async () => {
        const response = await request(app)
            .post('/boards/1/columns')
            .send({ title: 'X' });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });
});

describe('GET /boards/:id/columns', () => {
    it('devuelve [] si el tablero no tiene columnas', async () => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTablero(token);

        const response = await request(app)
            .get(`/boards/${boardId}/columns`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it('las devuelve ordenadas por posicion, sin importar el orden en que se crearon', async () => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTablero(token);
        await db.insert(columns).values({ boardId, title: 'Tercera', position: 3000 });
        await db.insert(columns).values({ boardId, title: 'Primera', position: 1000 });
        await db.insert(columns).values({ boardId, title: 'Entre medio', position: 1500 });

        const response = await request(app)
            .get(`/boards/${boardId}/columns`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.map((c: { title: string }) => c.title)).toEqual(['Primera', 'Entre medio', 'Tercera']);
    });

    it('con la misma posicion desempata por id (orden estable)', async () => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTablero(token);
        const [primera] = await db.insert(columns).values({ boardId, title: 'x', position: 1000 }).returning();
        await db.insert(columns).values({ boardId, title: 'Creada despues', position: 1000 });
        // Un UPDATE deja la version nueva de la fila al final del almacenamiento fisico de la tabla: sin ORDER BY id,
        // Postgres devolveria los empatados en ese orden fisico (la 'primera' ultima). Asi el test puede fallar.
        await db.update(columns).set({ title: 'Creada primero' }).where(eq(columns.id, primera!.id));

        const response = await request(app)
            .get(`/boards/${boardId}/columns`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.body.map((c: { title: string }) => c.title)).toEqual(['Creada primero', 'Creada despues']);
    });

    it('solo lista las columnas de ese tablero', async () => {
        const { token } = await crearUsuarioYToken();
        const tableroA = await crearTablero(token, 'A');
        const tableroB = await crearTablero(token, 'B');
        await crearColumna(token, tableroA, 'De A');
        await crearColumna(token, tableroB, 'De B');

        const response = await request(app)
            .get(`/boards/${tableroA}/columns`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].title).toBe('De A');
    });

    it('un viewer puede listar', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const lector = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await agregarMiembro(boardId, lector.user.id, 'viewer');
        await crearColumna(dueño.token, boardId);

        const response = await request(app)
            .get(`/boards/${boardId}/columns`)
            .set('Authorization', `Bearer ${lector.token}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
    });

    it('responde 404 a quien no es miembro, igual que a un tablero inexistente', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const ajeno = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await crearColumna(dueño.token, boardId);

        const deAjeno = await request(app)
            .get(`/boards/${boardId}/columns`)
            .set('Authorization', `Bearer ${ajeno.token}`);
        const inexistente = await request(app)
            .get('/boards/999999/columns')
            .set('Authorization', `Bearer ${ajeno.token}`);

        expect(deAjeno.status).toBe(404);
        expect(deAjeno.body).toEqual(inexistente.body);
    });

    it('responde 401 sin token', async () => {
        const response = await request(app).get('/boards/1/columns');

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });
});

describe('PATCH /columns/:id', () => {
    function renombrar(token: string, columnId: number | string, body: object) {
        return request(app)
            .patch(`/columns/${columnId}`)
            .set('Authorization', `Bearer ${token}`)
            .send(body);
    }

    it.each(['owner', 'editor'] as const)('un %s cambia el titulo y no toca la posicion ni el tablero', async (rol) => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const miembro = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        if (rol !== 'owner') await agregarMiembro(boardId, miembro.user.id, rol);
        const columna = await crearColumna(dueño.token, boardId, 'Original');
        const quien = rol === 'owner' ? dueño : miembro;

        const response = await renombrar(quien.token, columna.id, { title: 'Nuevo titulo' });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ id: columna.id, boardId, title: 'Nuevo titulo', position: 1000 });
        const fila = await leerColumna(columna.id);
        expect(fila).toMatchObject({ title: 'Nuevo titulo', position: 1000, boardId });
    });

    it('ignora position y boardId del body: no se puede mover la columna a otro tablero', async () => {
        const { token } = await crearUsuarioYToken();
        const tableroA = await crearTablero(token, 'A');
        const tableroB = await crearTablero(token, 'B');
        const columna = await crearColumna(token, tableroA, 'Original');

        const response = await renombrar(token, columna.id, { title: 'X', position: 99, boardId: tableroB });

        expect(response.status).toBe(200);
        const fila = await leerColumna(columna.id);
        expect(fila).toMatchObject({ title: 'X', position: 1000, boardId: tableroA });
    });

    it('solo modifica la columna indicada', async () => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTablero(token);
        const primera = await crearColumna(token, boardId, 'Primera');
        const segunda = await crearColumna(token, boardId, 'Segunda');

        await renombrar(token, primera.id, { title: 'Editada' });

        expect((await leerColumna(primera.id))?.title).toBe('Editada');
        expect((await leerColumna(segunda.id))?.title).toBe('Segunda');
    });

    it('responde 403 a un viewer y no cambia nada', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const lector = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await agregarMiembro(boardId, lector.user.id, 'viewer');
        const columna = await crearColumna(dueño.token, boardId, 'Original');

        const response = await renombrar(lector.token, columna.id, { title: 'Hackeada' });

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: 'Prohibido' });
        expect((await leerColumna(columna.id))?.title).toBe('Original');
    });

    it('el rol se evalua en el tablero de la columna, no en otro donde el usuario es owner', async () => {
        const ana = await crearUsuarioYToken('ana@mail.com');
        const beto = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const tableroDeAna = await crearTablero(ana.token, 'De Ana');
        await crearTablero(beto.token, 'De Beto');
        await agregarMiembro(tableroDeAna, beto.user.id, 'viewer');
        const columna = await crearColumna(ana.token, tableroDeAna, 'Original');

        const response = await renombrar(beto.token, columna.id, { title: 'Hackeada' });

        expect(response.status).toBe(403);
        expect((await leerColumna(columna.id))?.title).toBe('Original');
    });

    it('responde 404 a quien no es miembro, igual que a una columna inexistente', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const ajeno = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        const columna = await crearColumna(dueño.token, boardId, 'Original');

        const deAjeno = await renombrar(ajeno.token, columna.id, { title: 'Hackeada' });
        const inexistente = await renombrar(ajeno.token, 999999, { title: 'Hackeada' });

        expect(deAjeno.status).toBe(404);
        expect(deAjeno.body).toEqual(inexistente.body);
        expect((await leerColumna(columna.id))?.title).toBe('Original');
    });

    it.each([
        ['sin title', {}],
        ['con un title vacio', { title: '' }],
        ['con un title de solo espacios', { title: '   ' }],
        ['con un title de mas de 100 caracteres', { title: 'a'.repeat(101) }],
        ['con title: null', { title: null }],
    ])('responde 400 %s y no cambia nada', async (_caso, body) => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTablero(token);
        const columna = await crearColumna(token, boardId, 'Original');

        const response = await renombrar(token, columna.id, body);

        expect(response.status).toBe(400);
        expect(response.body.fields).toHaveProperty('title');
        expect((await leerColumna(columna.id))?.title).toBe('Original');
    });

    it('responde 401 sin token', async () => {
        const response = await request(app).patch('/columns/1').send({ title: 'X' });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });
});

describe('DELETE /columns/:id', () => {
    function borrar(token: string, columnId: number | string) {
        return request(app)
            .delete(`/columns/${columnId}`)
            .set('Authorization', `Bearer ${token}`);
    }

    it.each(['owner', 'editor'] as const)('un %s borra la columna: 204 y se van sus tarjetas, pero no las de otras columnas', async (rol) => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const miembro = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        if (rol !== 'owner') await agregarMiembro(boardId, miembro.user.id, rol);
        const aBorrar = await crearColumna(dueño.token, boardId, 'A borrar');
        const queDeja = await crearColumna(dueño.token, boardId, 'Se queda');
        await db.insert(cards).values({ columnId: aBorrar.id, title: 'Se va', position: 1000 });
        await db.insert(cards).values({ columnId: queDeja.id, title: 'Se queda', position: 1000 });
        const quien = rol === 'owner' ? dueño : miembro;

        const response = await borrar(quien.token, aBorrar.id);

        expect(response.status).toBe(204);
        expect(response.text).toBe('');
        expect(await leerColumna(aBorrar.id)).toBeUndefined();
        expect(await leerColumna(queDeja.id)).toBeDefined();

        const restantes = await db.select().from(cards);
        expect(restantes).toHaveLength(1);
        expect(restantes[0]?.title).toBe('Se queda');
    });

    it('responde 403 a un viewer y la columna sigue existiendo', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const lector = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await agregarMiembro(boardId, lector.user.id, 'viewer');
        const columna = await crearColumna(dueño.token, boardId);

        const response = await borrar(lector.token, columna.id);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: 'Prohibido' });
        expect(await leerColumna(columna.id)).toBeDefined();
    });

    it('responde 404 a quien no es miembro, igual que a una columna inexistente, y la columna sigue existiendo', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const ajeno = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        const columna = await crearColumna(dueño.token, boardId);

        const deAjeno = await borrar(ajeno.token, columna.id);
        const inexistente = await borrar(ajeno.token, 999999);

        expect(deAjeno.status).toBe(404);
        expect(deAjeno.body).toEqual(inexistente.body);
        expect(await leerColumna(columna.id)).toBeDefined();
    });

    it('responde 401 sin token y no borra nada', async () => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTablero(token);
        const columna = await crearColumna(token, boardId);

        const response = await request(app).delete(`/columns/${columna.id}`);

        expect(response.status).toBe(401);
        expect(await leerColumna(columna.id)).toBeDefined();
    });
});

// Un id invalido en la URL tiene que dar 404 en JSON y nunca llegar a la base (que respondería 500).
// Se usa un tablero y una columna reales para que un id invalido que se colara por el schema llegue a la consulta.
describe('ids invalidos en la URL (columnas)', () => {
    const INVALIDOS = ['abc', '0', '-1', '1.5', '99999999999'];

    const RUTAS = [
        { metodo: 'get', ruta: '/boards/:id/columns' },
        { metodo: 'post', ruta: '/boards/:id/columns', body: { title: 'X' } },
        { metodo: 'patch', ruta: '/columns/:id', body: { title: 'X' } },
        { metodo: 'delete', ruta: '/columns/:id' },
    ] as const;

    it.each(RUTAS)('$metodo $ruta responde 404 (no 500) con cada id invalido', async ({ metodo, ruta, ...resto }) => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTablero(token);
        const columna = await crearColumna(token, boardId);

        for (const invalido of INVALIDOS) {
            const url = ruta.replace(':id', invalido);

            const pedido = request(app)[metodo](url).set('Authorization', `Bearer ${token}`);
            const response = await ('body' in resto ? pedido.send(resto.body) : pedido);

            expect(response.status, `${metodo.toUpperCase()} ${url}`).toBe(404);
            expect(response.body, `${metodo.toUpperCase()} ${url}`).toEqual({ error: 'No encontrado' });
        }

        expect(await leerColumna(columna.id)).toBeDefined();
    });
});
