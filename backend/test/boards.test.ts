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
        expect(response.body.board.name).toBe('Mi tablero');

        const filasBoards = await db.select().from(boards);
        expect(filasBoards).toHaveLength(1);

        const membresias = await db
            .select()
            .from(boardMembers)
            .where(eq(boardMembers.boardId, response.body.board.id));

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
    return response.body.board.id as number;
}

describe('GET /boards/:id', () => {
    it('devuelve el tablero y el rol al owner', async () => {
        const { token } = await crearUsuarioYToken();
        const boardId = await crearTablero(token);

        const response = await request(app)
            .get(`/boards/${boardId}`)
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.board).toMatchObject({ id: boardId, name: 'Mi tablero' });
        expect(response.body.role).toBe('owner');
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
        expect(deAjeno.body).not.toHaveProperty('board');
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
