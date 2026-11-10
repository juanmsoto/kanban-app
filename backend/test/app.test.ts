import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('GET /health', () => {
    it('Devuelve 200 solo si la API puede conectarse a la base', async () => {
        const response = await request(app).get('/health');
        
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok' });
    });
});

describe('headers de seguridad', () => {
    it('no revela que el servidor usa Express', async () => {
        const response = await request(app).get('/health');

        expect(response.headers).not.toHaveProperty('x-powered-by');
    });

    it('agrega los headers de seguridad de helmet', async () => {
        const response = await request(app).get('/health');

        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
        expect(response.headers['content-security-policy']).toContain(
            "frame-ancestors 'self'",
        );
    });

    it('también los agrega en los errores', async () => {
        const response = await request(app).get('/ruta-inexistente');

        expect(response.status).toBe(404);
        expect(response.headers).not.toHaveProperty('x-powered-by');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
});

describe('rutas inexistentes', () => {
    it('responde 404 en JSON', async () => {
        const response = await request(app).get('/ruta-inexistente');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'No encontrado' });
    });
});