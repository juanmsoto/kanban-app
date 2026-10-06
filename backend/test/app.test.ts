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

describe('rutas inexistentes', () => {
    it('responde 404 en JSON', async () => {
        const response = await request(app).get('/ruta-inexistente');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'No encontrado' });
    });
});