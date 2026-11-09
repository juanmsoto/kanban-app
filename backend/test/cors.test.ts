import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { corsOrigin } from '../src/config.js';

const ORIGEN_AJENO = 'http://sitio-malicioso.example';

describe('CORS', () => {
    it('autoriza al origen del frontend', async () => {
        const response = await request(app)
            .get('/health')
            .set('Origin', corsOrigin);

        expect(response.status).toBe(200);
        expect(response.headers['access-control-allow-origin']).toBe(corsOrigin);
    });

    it('no autoriza a un origen ajeno', async () => {
        const response = await request(app)
            .get('/health')
            .set('Origin', ORIGEN_AJENO);

        // La API igual responde, pero el header nombra al frontend permitido y no
        // a quien pregunta: el navegador de ese sitio descarta la respuesta.
        expect(response.headers['access-control-allow-origin']).not.toBe(ORIGEN_AJENO);
        expect(response.headers['access-control-allow-origin']).not.toBe('*');
    });

    it('responde el preflight con los metodos y el header Authorization', async () => {
        const response = await request(app)
            .options('/boards/1')
            .set('Origin', corsOrigin)
            .set('Access-Control-Request-Method', 'PATCH')
            .set('Access-Control-Request-Headers', 'authorization,content-type');

        expect(response.status).toBe(204);
        expect(response.headers['access-control-allow-origin']).toBe(corsOrigin);
        expect(response.headers['access-control-allow-methods']).toMatch(/PATCH/);
        expect(response.headers['access-control-allow-methods']).toMatch(/DELETE/);
        expect(response.headers['access-control-allow-headers']).toMatch(/authorization/i);
    });
});
