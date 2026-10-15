import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from 'jsonwebtoken';
import app from "../src/app.js";
import { db } from "../src/db/client.js";
import { users } from "../src/db/schema.js";
import { jwtSecret } from "../src/config.js";
import { crearUsuarioYToken } from "./helpers.js";

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

describe('POST /auth/login', () => {
    it('login correcto', async () => {
        await request(app).post('/auth/register').send(datosValidos);

        const response = await request(app)
            .post('/auth/login')
            .send({ email: datosValidos.email, password: datosValidos.password });
        
        

        expect(response.status).toBe(200);
        expect(response.body.token).toBeTypeOf('string');
        
        const payload = jwt.verify(response.body.token, process.env.JWT_SECRET as string);
        expect(payload).toHaveProperty('sub', String(response.body.user.id));
        expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('responde 401 si la contraseña es incorrecta', async () => {
        await request(app).post('/auth/register').send(datosValidos);

        const response = await request(app)
            .post('/auth/login')
            .send({ email: datosValidos.email, password: 'otra-clave-incorrecta' });

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'Credenciales invalidas' });
        expect(response.body).not.toHaveProperty('token');
    });

    it('responde 401 con el mismo cuerpo si el email no existe', async () => {
        await request(app).post('/auth/register').send(datosValidos);

        const passwordIncorrecta = await request(app)
            .post('/auth/login')
            .send({ email: datosValidos.email, password: 'otra-clave-incorrecta' });

        const emailInexistente = await request(app)
            .post('/auth/login')
            .send({ email: 'nadie@mail.com', password: datosValidos.password });

        expect(emailInexistente.status).toBe(401);
        expect(emailInexistente.status).toBe(passwordIncorrecta.status);
        expect(emailInexistente.body).toEqual(passwordIncorrecta.body);
    });

    it('responde 400 si falta la contraseña', async () => {
        const response = await request(app)
            .post('/auth/login')
            .send({ email: datosValidos.email });

        expect(response.status).toBe(400);
        expect(response.body.fields).toHaveProperty('password');
    });

    it('acepta el email con otra capitalización', async () => {
        await request(app).post('/auth/register').send(datosValidos);

        const response = await request(app)
            .post('/auth/login')
            .send({ email: ' ANA@Mail.COM ', password: datosValidos.password });

        expect(response.status).toBe(200);
        expect(response.body.token).toBeTypeOf('string');
    });
});

describe('GET /auth/me', () => {
    it('devuelve el usuario con un token válido', async () => {
        const { token, user } = await crearUsuarioYToken();

        const response = await request(app)
            .get('/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(response.body.user).toEqual({
            id: user.id,
            name: datosValidos.name,
            email: datosValidos.email,
        });
        expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('responde 401 sin header Authorization', async () => {
        const response = await request(app).get('/auth/me');

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });

    it('responde 401 si el header no es Bearer', async () => {
        const { token } = await crearUsuarioYToken();

        const response = await request(app)
            .get('/auth/me')
            .set('Authorization', `Basic ${token}`);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });

    it('responde 401 si Bearer viene sin token', async () => {
        const response = await request(app)
            .get('/auth/me')
            .set('Authorization', 'Bearer');

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });

    it('responde 401 si el token es basura', async () => {
        const response = await request(app)
            .get('/auth/me')
            .set('Authorization', 'Bearer esto-no-es-un-jwt');

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });

    it('responde 401 si el token está firmado con otro secreto', async () => {
        const { user } = await crearUsuarioYToken();
        const falso = jwt.sign({ sub: String(user.id) }, 'otro-secreto-distinto', { expiresIn: '1h' });

        const response = await request(app)
            .get('/auth/me')
            .set('Authorization', `Bearer ${falso}`);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });

    it('responde 401 si el token está vencido', async () => {
        const { user } = await crearUsuarioYToken();
        const haceDiezSegundos = Math.floor(Date.now() / 1000) - 10;
        const vencido = jwt.sign({ sub: String(user.id), exp: haceDiezSegundos }, jwtSecret);

        const response = await request(app)
            .get('/auth/me')
            .set('Authorization', `Bearer ${vencido}`);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });

    it('responde 401 si el token no tiene firma (alg none)', async () => {
        const { user } = await crearUsuarioYToken();
        const sinFirma = jwt.sign({ sub: String(user.id) }, '', { algorithm: 'none' });

        const response = await request(app)
            .get('/auth/me')
            .set('Authorization', `Bearer ${sinFirma}`);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });

    it('responde 401 si el usuario del token ya no existe', async () => {
        const { token } = await crearUsuarioYToken();
        await db.delete(users);

        const response = await request(app)
            .get('/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({ error: 'No autenticado' });
    });
});
