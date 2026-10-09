import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { db } from "../src/db/client.js";
import { users } from "../src/db/schema.js";
import { error } from "console";

const datosValidos = {
    name: 'Ana',
    email: 'ana@mail.com',
    password: 'clave-segura-1',
}

describe('POST /auth/register', () => {
    it('registra un usuario y no expone la contraseña', async ()=> {
        const response = await request(app)
            .post('/auth/register')
            .send(datosValidos);

        expect(response.status).toBe(201);
        expect(response.body.user.email).toBe('ana@mail.com');
        expect(response.body.user).not.toHaveProperty('passwordHash');

        const filas = await db.select().from(users);
        expect(filas).toHaveLength(1);
        expect(filas[0]?.passwordHash).not.toBe(datosValidos.password);
        expect(filas[0]?.passwordHash).toMatch(/^\$2[aby]\$10\$/);
    });

    it('guarda el email en minúsculas y sin espacios', async ()=> {
        const response = await request(app)
            .post('/auth/register')
            .send({ ...datosValidos, email: 'ANA@Mail.COM' });

        expect(response.status).toBe(201);
        expect(response.body.user.email).toBe('ana@mail.com');
    });

    it('responde 409 si el email ya existe, aunque cambien las mayúsculas', async ()=> {
        await request(app).post('/auth/register').send(datosValidos);

        const response = await request(app)
            .post('/auth/register')
            .send({ ...datosValidos, email: 'ANA@Mail.COM' });

        expect(response.status).toBe(409);
        expect(response.body).toEqual({ error: 'El email ya esta registrado' });
    });

    it('responde 400 con datos inválidos y no crea el usuario', async ()=> {
        const response = await request(app)
            .post('/auth/register')
            .send({ name: '', email: 'no-es-email', password: '123' });

        expect(response.status).toBe(400);
        expect(response.body.fields).toHaveProperty('name');
        expect(response.body.fields).toHaveProperty('email');
        expect(response.body.fields).toHaveProperty('password');
    });

    it('rechaza contraseñas de más de 72 bytes (límite de bcrypt)', async () => {
        const response = await request(app)
            .post('/auth/register')
            .send({ ...datosValidos, password: 'ñ'.repeat(40) });

        expect(response.status).toBe(400);
        expect(response.body.fields).toHaveProperty('password');
    });
});
