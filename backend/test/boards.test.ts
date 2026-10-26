import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import app from '../src/app.js';
import { db } from '../src/db/client.js';
import { boards, boardMembers } from '../src/db/schema.js';
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
