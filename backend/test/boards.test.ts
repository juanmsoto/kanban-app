import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import app from '../src/app.js';
import { db, pool } from '../src/db/client.js';
import { boards, boardMembers, columns, cards, users } from '../src/db/schema.js';
import { crearUsuarioYToken } from './helpers.js';
import { assertBoardRole } from '../src/modules/boards/boards.service.js';
import { BoardNotFoundError, ForbiddenError } from '../src/errors.js';

describe('POST /boards', () => {
    it('crea el tablero y deja al usuario como owner', async () => {
        const { token, user } = await crearUsuarioYToken();

        const response = await request(app)
            .post('/boards')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Mi tablero', description: 'Primer tablero' });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ name: 'Mi tablero', description: 'Primer tablero', role: 'owner' });
        expect(response.body).not.toHaveProperty('board');

        const filasBoards = await db.select().from(boards);
        expect(filasBoards).toHaveLength(1);

        const membresias = await db
            .select()
            .from(boardMembers)
            .where(eq(boardMembers.boardId, response.body.id));

        expect(membresias).toHaveLength(1);
        expect(membresias[0]).toMatchObject({ userId: user.id, role: 'owner' });
    });

    it('responde 401 sin token y no crea nada', async () => {
        const response = await request(app)
            .post('/boards')
            .send({ name: 'Mi tablero' });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
        expect(await db.select().from(boards)).toHaveLength(0);
    });

    it('responde 400 si falta el nombre y no crea nada', async () => {
        const { token } = await crearUsuarioYToken();

        const response = await request(app)
            .post('/boards')
            .set('Authorization', `Bearer ${token}`)
            .send({ description: 'Sin nombre' });

        expect(response.status).toBe(400);
        expect(response.body.fields).toHaveProperty('name');
        expect(await db.select().from(boards)).toHaveLength(0);
        expect(await db.select().from(boardMembers)).toHaveLength(0);
    });

    it('ignora un userId enviado en el body: el dueño es quien tiene el token', async () => {
        const { token, user } = await crearUsuarioYToken();

        const response = await request(app)
            .post('/boards')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Mi tablero', userId: 999 });

        expect(response.status).toBe(201);

        const membresias = await db.select().from(boardMembers);
        expect(membresias).toHaveLength(1);
        expect(membresias[0]).toMatchObject({ userId: user.id, role: 'owner' });
    });
});

// Crea un tablero con `token` como dueño y devuelve su id.
async function crearTablero(token: string, name = 'Mi tablero') {
    const response = await request(app)
        .post('/boards')
        .set('Authorization', `Bearer ${token}`)
        .send({ name });
    return response.body.id as number;
}

describe('GET /boards/:id', () => {
    it('devuelve el tablero y el rol al owner', async () => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTablero(token);

        const response = await request(app)
            .get(`/boards/${boardId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ id: boardId, name: 'Mi tablero', role: 'owner' });
        expect(response.body).not.toHaveProperty('board');
    });

    it('devuelve el tablero con rol viewer a un miembro viewer', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const lector = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await db.insert(boardMembers).values({ boardId, userId: lector.user.id, role: 'viewer' });

        const response = await request(app)
            .get(`/boards/${boardId}`)
            .set('Authorization', `Bearer ${lector.token}`);

        expect(response.status).toBe(200);
        expect(response.body.role).toBe('viewer');
    });

    it('responde 404 a quien no es miembro, igual que a un tablero inexistente', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const ajeno = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);

        const deAjeno = await request(app)
            .get(`/boards/${boardId}`)
            .set('Authorization', `Bearer ${ajeno.token}`);

        const inexistente = await request(app)
            .get('/boards/999999')
            .set('Authorization', `Bearer ${ajeno.token}`);

        expect(deAjeno.status).toBe(404);
        expect(deAjeno.status).toBe(inexistente.status);
        expect(deAjeno.body).toEqual(inexistente.body);
        expect(deAjeno.body).not.toHaveProperty('name');
    });

    it.each(['abc', '0', '-1', '1.5', '99999999999'])(
        'responde 404 (no 500) si el id es %s',
        async (idInvalido) => {
            const { token } = await crearUsuarioYToken();

            const response = await request(app)
                .get(`/boards/${idInvalido}`)
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(404);
            expect(response.body).toEqual({ error: 'No encontrado' });
        },
    );

    it('responde 401 sin token', async () => {
        const response = await request(app).get('/boards/1');

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });
});

describe('GET /boards', () => {
    it('devuelve [] si el usuario no tiene tableros', async () => {
        const { token } = await crearUsuarioYToken();

        const response = await request(app)
            .get('/boards')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it('lista solo los tableros del usuario, con el rol correcto en cada uno', async () => {
        const ana = await crearUsuarioYToken('ana@mail.com');
        const beto = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const propio = await crearTablero(ana.token, 'De Ana');
        const compartido = await crearTablero(beto.token, 'De Beto compartido');
        const ajeno = await crearTablero(beto.token, 'De Beto privado');
        await db.insert(boardMembers).values({ boardId: compartido, userId: ana.user.id, role: 'viewer' });

        const response = await request(app)
            .get('/boards')
            .set('Authorization', `Bearer ${ana.token}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);

        const porId = new Map(response.body.map((b: { id: number; role: string }) => [b.id, b.role]));
        expect(porId.get(propio)).toBe('owner');
        expect(porId.get(compartido)).toBe('viewer');
        expect(porId.has(ajeno)).toBe(false);
    });

    it('devuelve objetos planos con los campos del tablero y el rol', async () => {
        const { token } = await crearUsuarioYToken();
        await crearTablero(token);

        const response = await request(app)
            .get('/boards')
            .set('Authorization', `Bearer ${token}`);

        expect(Object.keys(response.body[0]).sort()).toEqual(
            ['createdAt', 'description', 'id', 'name', 'role', 'updatedAt'],
        );
    });

    it('ordena del mas nuevo al mas viejo', async () => {
        const { token } = await crearUsuarioYToken();
        const primero = await crearTablero(token, 'Primero');
        const segundo = await crearTablero(token, 'Segundo');
        const tercero = await crearTablero(token, 'Tercero');

        const response = await request(app)
            .get('/boards')
            .set('Authorization', `Bearer ${token}`);

        const ids = response.body.map((b: { id: number }) => b.id);
        expect(ids).toEqual([tercero, segundo, primero]);
    });

    it('responde 401 sin token', async () => {
        const response = await request(app).get('/boards');

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });
});

describe('GET /boards/:id/members', () => {
    it('lista a los miembros con su rol, del mas antiguo al mas nuevo, sin datos sensibles', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const editor = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const lector = await crearUsuarioYToken('carla@mail.com', 'Carla');
        const boardId = await crearTablero(dueño.token);
        await db.insert(boardMembers).values({ boardId, userId: editor.user.id, role: 'editor' });
        await db.insert(boardMembers).values({ boardId, userId: lector.user.id, role: 'viewer' });

        const response = await request(app)
            .get(`/boards/${boardId}/members`)
            .set('Authorization', `Bearer ${dueño.token}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([
            { id: dueño.user.id, name: 'Ana', email: 'ana@mail.com', role: 'owner' },
            { id: editor.user.id, name: 'Beto', email: 'beto@mail.com', role: 'editor' },
            { id: lector.user.id, name: 'Carla', email: 'carla@mail.com', role: 'viewer' },
        ]);
        expect(JSON.stringify(response.body)).not.toMatch(/password/i);
    });

    it('un viewer tambien puede listar los miembros', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const lector = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await db.insert(boardMembers).values({ boardId, userId: lector.user.id, role: 'viewer' });

        const response = await request(app)
            .get(`/boards/${boardId}/members`)
            .set('Authorization', `Bearer ${lector.token}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
    });

    it('solo lista los miembros de ese tablero, no los de otros', async () => {
        const ana = await crearUsuarioYToken('ana@mail.com');
        const beto = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const tableroDeAna = await crearTablero(ana.token);
        await crearTablero(beto.token);

        const response = await request(app)
            .get(`/boards/${tableroDeAna}/members`)
            .set('Authorization', `Bearer ${ana.token}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].email).toBe('ana@mail.com');
    });

    it('responde 404 a quien no es miembro, igual que a un tablero inexistente', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const ajeno = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);

        const deAjeno = await request(app)
            .get(`/boards/${boardId}/members`)
            .set('Authorization', `Bearer ${ajeno.token}`);

        const inexistente = await request(app)
            .get('/boards/999999/members')
            .set('Authorization', `Bearer ${ajeno.token}`);

        expect(deAjeno.status).toBe(404);
        expect(deAjeno.body).toEqual(inexistente.body);
        expect(deAjeno.body).not.toHaveProperty('email');
    });

    it.each(['abc', '0', '-1', '1.5', '99999999999'])(
        'responde 404 (no 500) si el id es %s',
        async (idInvalido) => {
            const { token } = await crearUsuarioYToken();

            const response = await request(app)
                .get(`/boards/${idInvalido}/members`)
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(404);
            expect(response.body).toEqual({ error: 'No encontrado' });
        },
    );

    it('responde 401 sin token', async () => {
        const response = await request(app).get('/boards/1/members');

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });
});

describe('POST /boards/:id/members', () => {
    it('el owner agrega a un usuario por email y el tablero le aparece en GET /boards', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const nuevo = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);

        const response = await request(app)
            .post(`/boards/${boardId}/members`)
            .set('Authorization', `Bearer ${dueño.token}`)
            .send({ email: 'beto@mail.com', role: 'editor' });

        expect(response.status).toBe(201);
        expect(response.body).toEqual({ id: nuevo.user.id, name: 'Beto', email: 'beto@mail.com', role: 'editor' });
        expect(JSON.stringify(response.body)).not.toMatch(/password/i);

        const lista = await request(app)
            .get('/boards')
            .set('Authorization', `Bearer ${nuevo.token}`);

        expect(lista.body).toHaveLength(1);
        expect(lista.body[0]).toMatchObject({ id: boardId, role: 'editor' });
    });

    it('normaliza el email (espacios y mayusculas)', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const nuevo = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);

        const response = await request(app)
            .post(`/boards/${boardId}/members`)
            .set('Authorization', `Bearer ${dueño.token}`)
            .send({ email: '  BETO@Mail.com ', role: 'viewer' });

        expect(response.status).toBe(201);
        expect(response.body.id).toBe(nuevo.user.id);
    });

    it('responde 409 si ya es miembro y no le cambia el rol', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const miembro = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await db.insert(boardMembers).values({ boardId, userId: miembro.user.id, role: 'viewer' });

        const response = await request(app)
            .post(`/boards/${boardId}/members`)
            .set('Authorization', `Bearer ${dueño.token}`)
            .send({ email: 'beto@mail.com', role: 'owner' });

        expect(response.status).toBe(409);
        expect(response.body).toEqual({ error: 'El usuario ya es miembro del tablero' });

        const filas = await db.select().from(boardMembers).where(eq(boardMembers.userId, miembro.user.id));
        expect(filas).toHaveLength(1);
        expect(filas[0]?.role).toBe('viewer');
    });

    it('responde 409 si el owner se agrega a si mismo', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const boardId = await crearTablero(dueño.token);

        const response = await request(app)
            .post(`/boards/${boardId}/members`)
            .set('Authorization', `Bearer ${dueño.token}`)
            .send({ email: 'ana@mail.com', role: 'viewer' });

        expect(response.status).toBe(409);
        const filas = await db.select().from(boardMembers).where(eq(boardMembers.boardId, boardId));
        expect(filas).toHaveLength(1);
        expect(filas[0]?.role).toBe('owner');
    });

    it('responde 404 si el email no pertenece a ningun usuario y no crea nada', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const boardId = await crearTablero(dueño.token);

        const response = await request(app)
            .post(`/boards/${boardId}/members`)
            .set('Authorization', `Bearer ${dueño.token}`)
            .send({ email: 'nadie@mail.com', role: 'viewer' });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'Usuario no encontrado' });
        expect(await db.select().from(boardMembers)).toHaveLength(1);
    });

    it.each(['editor', 'viewer'] as const)('responde 403 si quien pide es %s y no agrega a nadie', async (rol) => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const solicitante = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const candidato = await crearUsuarioYToken('carla@mail.com', 'Carla');
        const boardId = await crearTablero(dueño.token);
        await db.insert(boardMembers).values({ boardId, userId: solicitante.user.id, role: rol });

        const response = await request(app)
            .post(`/boards/${boardId}/members`)
            .set('Authorization', `Bearer ${solicitante.token}`)
            .send({ email: 'carla@mail.com', role: 'viewer' });

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: 'Prohibido' });
        const filas = await db.select().from(boardMembers).where(eq(boardMembers.userId, candidato.user.id));
        expect(filas).toHaveLength(0);
    });

    it('responde 404 a quien no es miembro, sin revelar si el email existe', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const ajeno = await crearUsuarioYToken('beto@mail.com', 'Beto');
        await crearUsuarioYToken('carla@mail.com', 'Carla');
        const boardId = await crearTablero(dueño.token);

        const conEmailReal = await request(app)
            .post(`/boards/${boardId}/members`)
            .set('Authorization', `Bearer ${ajeno.token}`)
            .send({ email: 'carla@mail.com', role: 'viewer' });

        const conEmailInexistente = await request(app)
            .post(`/boards/${boardId}/members`)
            .set('Authorization', `Bearer ${ajeno.token}`)
            .send({ email: 'nadie@mail.com', role: 'viewer' });

        expect(conEmailReal.status).toBe(404);
        expect(conEmailReal.body).toEqual(conEmailInexistente.body);
        expect(conEmailReal.body).toEqual({ error: 'No encontrado' });
    });

    it.each([
        ['sin role', { email: 'beto@mail.com' }, 'role'],
        ['con un role inexistente', { email: 'beto@mail.com', role: 'admin' }, 'role'],
        ['sin email', { role: 'viewer' }, 'email'],
        ['con un email invalido', { email: 'no-es-un-email', role: 'viewer' }, 'email'],
    ])('responde 400 %s y no agrega a nadie', async (_caso, body, campo) => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);

        const response = await request(app)
            .post(`/boards/${boardId}/members`)
            .set('Authorization', `Bearer ${dueño.token}`)
            .send(body);

        expect(response.status).toBe(400);
        expect(response.body.fields).toHaveProperty(campo);
        expect(await db.select().from(boardMembers)).toHaveLength(1);
    });

    it('responde 400 sin body', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const boardId = await crearTablero(dueño.token);

        const response = await request(app)
            .post(`/boards/${boardId}/members`)
            .set('Authorization', `Bearer ${dueño.token}`);

        expect(response.status).toBe(400);
    });

    it.each(['abc', '0', '-1', '1.5', '99999999999'])(
        'responde 404 (no 500) si el id es %s',
        async (idInvalido) => {
            const { token } = await crearUsuarioYToken();

            const response = await request(app)
                .post(`/boards/${idInvalido}/members`)
                .set('Authorization', `Bearer ${token}`)
                .send({ email: 'ana@mail.com', role: 'viewer' });

            expect(response.status).toBe(404);
            expect(response.body).toEqual({ error: 'No encontrado' });
        },
    );

    it('responde 401 sin token', async () => {
        const response = await request(app)
            .post('/boards/1/members')
            .send({ email: 'ana@mail.com', role: 'viewer' });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });
});

describe('PATCH /boards/:id/members/:userId', () => {
    async function rolDe(boardId: number, userId: number) {
        const [fila] = await db
            .select({ role: boardMembers.role })
            .from(boardMembers)
            .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)));
        return fila?.role;
    }

    function cambiarRol(token: string, boardId: number | string, userId: number | string, body: object = { role: 'viewer' }) {
        return request(app)
            .patch(`/boards/${boardId}/members/${userId}`)
            .set('Authorization', `Bearer ${token}`)
            .send(body);
    }

    it('el owner cambia el rol de un miembro y el cambio se ve en GET /boards del miembro', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const miembro = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await db.insert(boardMembers).values({ boardId, userId: miembro.user.id, role: 'editor' });

        const response = await cambiarRol(dueño.token, boardId, miembro.user.id, { role: 'viewer' });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ id: miembro.user.id, name: 'Beto', email: 'beto@mail.com', role: 'viewer' });
        expect(JSON.stringify(response.body)).not.toMatch(/password/i);
        expect(await rolDe(boardId, miembro.user.id)).toBe('viewer');

        const lista = await request(app).get('/boards').set('Authorization', `Bearer ${miembro.token}`);
        expect(lista.body[0]).toMatchObject({ id: boardId, role: 'viewer' });
    });

    it('el owner puede promover a otro miembro a owner', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const miembro = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await db.insert(boardMembers).values({ boardId, userId: miembro.user.id, role: 'viewer' });

        const response = await cambiarRol(dueño.token, boardId, miembro.user.id, { role: 'owner' });

        expect(response.status).toBe(200);
        expect(await rolDe(boardId, miembro.user.id)).toBe('owner');
    });

    it('con dos owners, uno puede degradar al otro y tambien a si mismo', async () => {
        const ana = await crearUsuarioYToken('ana@mail.com');
        const beto = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(ana.token);
        await db.insert(boardMembers).values({ boardId, userId: beto.user.id, role: 'owner' });

        const aBeto = await cambiarRol(ana.token, boardId, beto.user.id, { role: 'editor' });
        expect(aBeto.status).toBe(200);

        // Ahora Ana es la unica owner: Beto ya no puede, pero otro owner si podria autodegradarse. Se prueba abajo.
        await db.update(boardMembers).set({ role: 'owner' }).where(eq(boardMembers.userId, beto.user.id));

        const aSiMisma = await cambiarRol(ana.token, boardId, ana.user.id, { role: 'viewer' });
        expect(aSiMisma.status).toBe(200);
        expect(await rolDe(boardId, ana.user.id)).toBe('viewer');
        expect(await rolDe(boardId, beto.user.id)).toBe('owner');
    });

    it('responde 409 si el unico owner intenta degradarse y sigue siendo owner', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const boardId = await crearTablero(dueño.token);

        const response = await cambiarRol(dueño.token, boardId, dueño.user.id, { role: 'editor' });

        expect(response.status).toBe(409);
        expect(response.body).toEqual({ error: 'El tablero debe tener al menos un owner' });
        expect(await rolDe(boardId, dueño.user.id)).toBe('owner');
    });

    it('el unico owner puede "cambiarse" a owner (no cambia nada) sin error', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const boardId = await crearTablero(dueño.token);

        const response = await cambiarRol(dueño.token, boardId, dueño.user.id, { role: 'owner' });

        expect(response.status).toBe(200);
        expect(response.body.role).toBe('owner');
    });

    it.each(['editor', 'viewer'] as const)('responde 403 si quien pide es %s y no cambia nada', async (rol) => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const solicitante = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await db.insert(boardMembers).values({ boardId, userId: solicitante.user.id, role: rol });

        // Intenta subirse a si mismo a owner.
        const response = await cambiarRol(solicitante.token, boardId, solicitante.user.id, { role: 'owner' });

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: 'Prohibido' });
        expect(await rolDe(boardId, solicitante.user.id)).toBe(rol);
    });

    it('responde 404 a quien no es miembro, igual que a un tablero inexistente', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const ajeno = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);

        const deAjeno = await cambiarRol(ajeno.token, boardId, dueño.user.id, { role: 'viewer' });
        const inexistente = await cambiarRol(ajeno.token, 999999, dueño.user.id, { role: 'viewer' });

        expect(deAjeno.status).toBe(404);
        expect(deAjeno.body).toEqual(inexistente.body);
        expect(await rolDe(boardId, dueño.user.id)).toBe('owner');
    });

    it('responde 404 si el usuario indicado no es miembro del tablero', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const otro = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);

        const response = await cambiarRol(dueño.token, boardId, otro.user.id, { role: 'editor' });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'Miembro no encontrado' });
        expect(await rolDe(boardId, otro.user.id)).toBeUndefined();
    });

    it.each([
        ['sin role', {}],
        ['con un role inexistente', { role: 'admin' }],
    ])('responde 400 %s y no cambia nada', async (_caso, body) => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const miembro = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await db.insert(boardMembers).values({ boardId, userId: miembro.user.id, role: 'editor' });

        const response = await cambiarRol(dueño.token, boardId, miembro.user.id, body);

        expect(response.status).toBe(400);
        expect(response.body.fields).toHaveProperty('role');
        expect(await rolDe(boardId, miembro.user.id)).toBe('editor');
    });

    it.each([
        ['abc', '1'],
        ['1', 'abc'],
        ['0', '1'],
        ['1', '0'],
        ['1', '-1'],
        ['1', '1.5'],
        ['1', '99999999999'],
    ])('responde 404 (no 500) con ids invalidos %s / %s', async (boardId, userId) => {
        const { token } = await crearUsuarioYToken();

        const response = await cambiarRol(token, boardId, userId);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'No encontrado' });
    });

    it('responde 401 sin token', async () => {
        const response = await request(app)
            .patch('/boards/1/members/1')
            .send({ role: 'viewer' });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });

    // Carrera determinista: una transaccion "A" (abierta a mano) bloquea las filas de los owners y degrada a Beto
    // SIN confirmar todavia. Mientras tanto Beto (aun owner para el mundo) pide degradar a Ana. Ese pedido tiene que
    // esperar el bloqueo y, cuando A confirma, volver a contar: ya hay un solo owner -> 409.
    // Sin el FOR UPDATE el pedido de Beto no espera, cuenta 2 owners y pasa: el tablero queda sin owner.
    it('un pedido que espera el bloqueo vuelve a contar los owners y no deja el tablero sin owner', async () => {
        const ana = await crearUsuarioYToken('ana@mail.com');
        const beto = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(ana.token);
        await db.insert(boardMembers).values({ boardId, userId: beto.user.id, role: 'owner' });

        const conexionA = await pool.connect();
        try {
            await conexionA.query('BEGIN');
            await conexionA.query(
                `SELECT user_id FROM board_members WHERE board_id = $1 AND role = 'owner' FOR UPDATE`,
                [boardId],
            );
            await conexionA.query(
                `UPDATE board_members SET role = 'editor' WHERE board_id = $1 AND user_id = $2`,
                [boardId, beto.user.id],
            );

            // .then() hace que supertest envie la request ahora, sin esperar la respuesta.
            const pedidoDeBeto = cambiarRol(beto.token, boardId, ana.user.id, { role: 'editor' }).then((r) => r);

            // Tiempo para que el pedido llegue al bloqueo (con el bloqueo sigue esperando; sin el, ya habria terminado).
            await new Promise((resolve) => setTimeout(resolve, 400));
            await conexionA.query('COMMIT');

            const respuesta = await pedidoDeBeto;

            expect(respuesta.status).toBe(409);
            expect(respuesta.body).toEqual({ error: 'El tablero debe tener al menos un owner' });
        } finally {
            await conexionA.query('ROLLBACK').catch(() => undefined);
            conexionA.release();
        }

        expect(await rolDe(boardId, ana.user.id)).toBe('owner');
        expect(await rolDe(boardId, beto.user.id)).toBe('editor');
    });
});

describe('DELETE /boards/:id/members/:userId', () => {
    async function esMiembro(boardId: number, userId: number) {
        const filas = await db
            .select()
            .from(boardMembers)
            .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)));
        return filas.length > 0;
    }

    function quitar(token: string, boardId: number | string, userId: number | string) {
        return request(app)
            .delete(`/boards/${boardId}/members/${userId}`)
            .set('Authorization', `Bearer ${token}`);
    }

    it('el owner quita a un miembro: 204 sin cuerpo y el miembro pierde el acceso', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const miembro = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await db.insert(boardMembers).values({ boardId, userId: miembro.user.id, role: 'editor' });

        const response = await quitar(dueño.token, boardId, miembro.user.id);

        expect(response.status).toBe(204);
        expect(response.text).toBe('');
        expect(await esMiembro(boardId, miembro.user.id)).toBe(false);

        const detalle = await request(app).get(`/boards/${boardId}`).set('Authorization', `Bearer ${miembro.token}`);
        expect(detalle.status).toBe(404);

        const lista = await request(app).get('/boards').set('Authorization', `Bearer ${miembro.token}`);
        expect(lista.body).toEqual([]);
    });

    it.each(['editor', 'viewer'] as const)('un %s puede salirse solo del tablero', async (rol) => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const miembro = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await db.insert(boardMembers).values({ boardId, userId: miembro.user.id, role: rol });

        const response = await quitar(miembro.token, boardId, miembro.user.id);

        expect(response.status).toBe(204);
        expect(await esMiembro(boardId, miembro.user.id)).toBe(false);
        expect(await esMiembro(boardId, dueño.user.id)).toBe(true);
    });

    it('con dos owners, uno puede quitar al otro y tambien salirse solo', async () => {
        const ana = await crearUsuarioYToken('ana@mail.com');
        const beto = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(ana.token);
        await db.insert(boardMembers).values({ boardId, userId: beto.user.id, role: 'owner' });

        const salida = await quitar(beto.token, boardId, beto.user.id);
        expect(salida.status).toBe(204);
        expect(await esMiembro(boardId, ana.user.id)).toBe(true);

        await db.insert(boardMembers).values({ boardId, userId: beto.user.id, role: 'owner' });

        const expulsion = await quitar(ana.token, boardId, beto.user.id);
        expect(expulsion.status).toBe(204);
        expect(await esMiembro(boardId, beto.user.id)).toBe(false);
    });

    it('responde 409 si el unico owner intenta salirse y sigue siendo miembro', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const boardId = await crearTablero(dueño.token);

        const response = await quitar(dueño.token, boardId, dueño.user.id);

        expect(response.status).toBe(409);
        expect(response.body).toEqual({ error: 'El tablero debe tener al menos un owner' });
        expect(await esMiembro(boardId, dueño.user.id)).toBe(true);
    });

    it.each(['editor', 'viewer'] as const)('responde 403 si un %s intenta quitar a otro miembro', async (rol) => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const solicitante = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await db.insert(boardMembers).values({ boardId, userId: solicitante.user.id, role: rol });

        const response = await quitar(solicitante.token, boardId, dueño.user.id);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: 'Prohibido' });
        expect(await esMiembro(boardId, dueño.user.id)).toBe(true);
    });

    it('responde 404 a quien no es miembro, igual que a un tablero inexistente, tanto al quitar a otro como a si mismo', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const ajeno = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);

        const aOtro = await quitar(ajeno.token, boardId, dueño.user.id);
        const aSiMismo = await quitar(ajeno.token, boardId, ajeno.user.id);
        const inexistente = await quitar(ajeno.token, 999999, dueño.user.id);

        expect(aOtro.status).toBe(404);
        expect(aOtro.body).toEqual(inexistente.body);
        expect(aSiMismo.status).toBe(404);
        expect(aSiMismo.body).toEqual(inexistente.body);
        expect(await esMiembro(boardId, dueño.user.id)).toBe(true);
    });

    it('responde 404 si el usuario indicado no es miembro del tablero', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const otro = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);

        const response = await quitar(dueño.token, boardId, otro.user.id);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'Miembro no encontrado' });
    });

    it.each([
        ['abc', '1'],
        ['1', 'abc'],
        ['1', '0'],
        ['1', '99999999999'],
    ])('responde 404 (no 500) con ids invalidos %s / %s', async (boardId, userId) => {
        const { token } = await crearUsuarioYToken();

        const response = await quitar(token, boardId, userId);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'No encontrado' });
    });

    it('responde 401 sin token', async () => {
        const response = await request(app).delete('/boards/1/members/1');

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });

    // Misma carrera determinista que en PATCH: la transaccion "A" (a mano) bloquea los owners y borra a Beto sin
    // confirmar. Beto (aun owner para el mundo) pide quitar a Ana: tiene que esperar, recontar y recibir 409.
    it('un pedido que espera el bloqueo vuelve a contar los owners y no deja el tablero sin owner', async () => {
        const ana = await crearUsuarioYToken('ana@mail.com');
        const beto = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(ana.token);
        await db.insert(boardMembers).values({ boardId, userId: beto.user.id, role: 'owner' });

        const conexionA = await pool.connect();
        try {
            await conexionA.query('BEGIN');
            await conexionA.query(
                `SELECT user_id FROM board_members WHERE board_id = $1 AND role = 'owner' FOR UPDATE`,
                [boardId],
            );
            await conexionA.query(
                `DELETE FROM board_members WHERE board_id = $1 AND user_id = $2`,
                [boardId, beto.user.id],
            );

            const pedidoDeBeto = quitar(beto.token, boardId, ana.user.id).then((r) => r);

            await new Promise((resolve) => setTimeout(resolve, 400));
            await conexionA.query('COMMIT');

            const respuesta = await pedidoDeBeto;

            expect(respuesta.status).toBe(409);
            expect(respuesta.body).toEqual({ error: 'El tablero debe tener al menos un owner' });
        } finally {
            await conexionA.query('ROLLBACK').catch(() => undefined);
            conexionA.release();
        }

        expect(await esMiembro(boardId, ana.user.id)).toBe(true);
        expect(await esMiembro(boardId, beto.user.id)).toBe(false);
    });
});

describe('PATCH /boards/:id', () => {
    async function crearTableroConDescripcion(token: string) {
        const boardId = await crearTablero(token, 'Original');
        await db.update(boards).set({ description: 'Descripcion original' }).where(eq(boards.id, boardId));
        return boardId;
    }

    async function leerTablero(boardId: number) {
        const [fila] = await db.select().from(boards).where(eq(boards.id, boardId));
        return fila;
    }

    function editar(token: string, boardId: number | string, body: object) {
        return request(app)
            .patch(`/boards/${boardId}`)
            .set('Authorization', `Bearer ${token}`)
            .send(body);
    }

    it('el owner cambia el nombre: 200 con el objeto plano, la descripcion queda igual y updatedAt avanza', async () => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTableroConDescripcion(token);
        const antes = await leerTablero(boardId);

        const response = await editar(token, boardId, { name: 'Nuevo nombre' });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            id: boardId,
            name: 'Nuevo nombre',
            description: 'Descripcion original',
            role: 'owner',
        });
        expect(response.body).not.toHaveProperty('board');

        const despues = await leerTablero(boardId);
        expect(despues?.name).toBe('Nuevo nombre');
        expect(despues?.description).toBe('Descripcion original');
        expect(despues!.updatedAt.getTime()).toBeGreaterThan(antes!.updatedAt.getTime());
    });

    it('un editor tambien puede editar y recibe su rol', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const editor = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await db.insert(boardMembers).values({ boardId, userId: editor.user.id, role: 'editor' });

        const response = await editar(editor.token, boardId, { name: 'Editado por Beto' });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ name: 'Editado por Beto', role: 'editor' });
    });

    it('cambia la descripcion y deja el nombre igual', async () => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTableroConDescripcion(token);

        const response = await editar(token, boardId, { description: 'Otra descripcion' });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ name: 'Original', description: 'Otra descripcion' });
    });

    it('description: null la borra (queda NULL en la base)', async () => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTableroConDescripcion(token);

        const response = await editar(token, boardId, { description: null });

        expect(response.status).toBe(200);
        expect(response.body.description).toBeNull();
        expect((await leerTablero(boardId))?.description).toBeNull();
        expect((await leerTablero(boardId))?.name).toBe('Original');
    });

    it('solo modifica el tablero indicado, no los demas', async () => {
        const ana = await crearUsuarioYToken('ana@mail.com');
        const beto = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const tableroDeAna = await crearTablero(ana.token, 'De Ana');
        const tableroDeBeto = await crearTablero(beto.token, 'De Beto');

        await editar(ana.token, tableroDeAna, { name: 'Editado' });

        expect((await leerTablero(tableroDeAna))?.name).toBe('Editado');
        expect((await leerTablero(tableroDeBeto))?.name).toBe('De Beto');
    });

    it('recorta los espacios del nombre', async () => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTablero(token);

        const response = await editar(token, boardId, { name: '   Con espacios   ' });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Con espacios');
    });

    it('ignora campos que no se pueden editar (id, createdAt)', async () => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTablero(token);
        const antes = await leerTablero(boardId);

        const response = await editar(token, boardId, { name: 'Ok', id: 999999, createdAt: '2000-01-01T00:00:00.000Z' });

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(boardId);
        const despues = await leerTablero(boardId);
        expect(despues?.id).toBe(boardId);
        expect(despues?.createdAt.getTime()).toBe(antes?.createdAt.getTime());
    });

    it('responde 403 a un viewer y no cambia nada', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const lector = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await db.insert(boardMembers).values({ boardId, userId: lector.user.id, role: 'viewer' });

        const response = await editar(lector.token, boardId, { name: 'Hackeado' });

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: 'Prohibido' });
        expect((await leerTablero(boardId))?.name).toBe('Mi tablero');
    });

    it('responde 404 a quien no es miembro, igual que a un tablero inexistente', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const ajeno = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);

        const deAjeno = await editar(ajeno.token, boardId, { name: 'Hackeado' });
        const inexistente = await editar(ajeno.token, 999999, { name: 'Hackeado' });

        expect(deAjeno.status).toBe(404);
        expect(deAjeno.body).toEqual(inexistente.body);
        expect((await leerTablero(boardId))?.name).toBe('Mi tablero');
    });

    it.each([
        ['un body vacio', {}],
        ['solo campos desconocidos', { id: 5 }],
        ['un nombre vacio', { name: '' }],
        ['un nombre de solo espacios', { name: '   ' }],
        ['un nombre de mas de 100 caracteres', { name: 'a'.repeat(101) }],
        ['una descripcion de mas de 500 caracteres', { description: 'a'.repeat(501) }],
        ['name: null (el nombre es obligatorio)', { name: null }],
    ])('responde 400 con %s y no cambia nada', async (_caso, body) => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTableroConDescripcion(token);

        const response = await editar(token, boardId, body);

        expect(response.status).toBe(400);
        const despues = await leerTablero(boardId);
        expect(despues?.name).toBe('Original');
        expect(despues?.description).toBe('Descripcion original');
    });

    it.each(['abc', '0', '99999999999'])('responde 404 (no 500) si el id es %s', async (idInvalido) => {
        const { token } = await crearUsuarioYToken();

        const response = await editar(token, idInvalido, { name: 'X' });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'No encontrado' });
    });

    it('responde 401 sin token', async () => {
        const response = await request(app).patch('/boards/1').send({ name: 'X' });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });
});

describe('DELETE /boards/:id', () => {
    function borrar(token: string, boardId: number | string) {
        return request(app)
            .delete(`/boards/${boardId}`)
            .set('Authorization', `Bearer ${token}`);
    }

    it('el owner borra el tablero: 204 sin cuerpo y desaparecen sus membresias, columnas y tarjetas', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const miembro = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await db.insert(boardMembers).values({ boardId, userId: miembro.user.id, role: 'editor' });
        const [columna] = await db.insert(columns).values({ boardId, title: 'Por hacer', position: 1000 }).returning();
        await db.insert(cards).values({ columnId: columna!.id, title: 'Una tarjeta', position: 1000 });

        const response = await borrar(dueño.token, boardId);

        expect(response.status).toBe(204);
        expect(response.text).toBe('');
        expect(await db.select().from(boards)).toHaveLength(0);
        expect(await db.select().from(boardMembers)).toHaveLength(0);
        expect(await db.select().from(columns)).toHaveLength(0);
        expect(await db.select().from(cards)).toHaveLength(0);

        // Los usuarios no se borran, solo su membresia.
        expect(await db.select().from(users)).toHaveLength(2);

        const detalle = await request(app).get(`/boards/${boardId}`).set('Authorization', `Bearer ${miembro.token}`);
        expect(detalle.status).toBe(404);
    });

    it('no toca los demas tableros', async () => {
        const ana = await crearUsuarioYToken('ana@mail.com');
        const beto = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const tableroDeAna = await crearTablero(ana.token, 'De Ana');
        const tableroDeBeto = await crearTablero(beto.token, 'De Beto');

        await borrar(ana.token, tableroDeAna);

        const restantes = await db.select().from(boards);
        expect(restantes).toHaveLength(1);
        expect(restantes[0]?.id).toBe(tableroDeBeto);
    });

    it.each(['editor', 'viewer'] as const)('responde 403 a un %s y el tablero sigue existiendo', async (rol) => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const miembro = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await db.insert(boardMembers).values({ boardId, userId: miembro.user.id, role: rol });

        const response = await borrar(miembro.token, boardId);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: 'Prohibido' });
        expect(await db.select().from(boards)).toHaveLength(1);
    });

    it('responde 404 a quien no es miembro, igual que a un tablero inexistente, y el tablero sigue existiendo', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const ajeno = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);

        const deAjeno = await borrar(ajeno.token, boardId);
        const inexistente = await borrar(ajeno.token, 999999);

        expect(deAjeno.status).toBe(404);
        expect(deAjeno.body).toEqual(inexistente.body);
        expect(await db.select().from(boards)).toHaveLength(1);
    });

    it.each(['abc', '0', '99999999999'])('responde 404 (no 500) si el id es %s', async (idInvalido) => {
        const { token } = await crearUsuarioYToken();

        const response = await borrar(token, idInvalido);

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'No encontrado' });
    });

    it('responde 401 sin token y no borra nada', async () => {
        const dueño = await crearUsuarioYToken();
        await crearTablero(dueño.token);

        const response = await request(app).delete('/boards/1');

        expect(response.status).toBe(401);
        expect(await db.select().from(boards)).toHaveLength(1);
    });
});

describe('assertBoardRole', () => {
    it('deja pasar si el rol alcanza y devuelve el rol', async () => {
        const { token, user } = await crearUsuarioYToken();
        const boardId = await crearTablero(token);

        await expect(assertBoardRole(user.id, boardId, 'owner')).resolves.toBe('owner');
        await expect(assertBoardRole(user.id, boardId, 'viewer')).resolves.toBe('owner');
    });

    it('lanza ForbiddenError si el rol no alcanza', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const lector = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);
        await db.insert(boardMembers).values({ boardId, userId: lector.user.id, role: 'viewer' });

        await expect(assertBoardRole(lector.user.id, boardId, 'editor')).rejects.toThrow(ForbiddenError);
        await expect(assertBoardRole(lector.user.id, boardId, 'owner')).rejects.toThrow(ForbiddenError);
        await expect(assertBoardRole(lector.user.id, boardId, 'viewer')).resolves.toBe('viewer');
    });

    it('lanza BoardNotFoundError si no es miembro o el tablero no existe', async () => {
        const dueño = await crearUsuarioYToken('ana@mail.com');
        const ajeno = await crearUsuarioYToken('beto@mail.com', 'Beto');
        const boardId = await crearTablero(dueño.token);

        await expect(assertBoardRole(ajeno.user.id, boardId, 'viewer')).rejects.toThrow(BoardNotFoundError);
        await expect(assertBoardRole(dueño.user.id, 999999, 'viewer')).rejects.toThrow(BoardNotFoundError);
    });
});
