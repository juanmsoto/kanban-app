import request from 'supertest';
import app from '../src/app.js';

const PASSWORD = 'clave-segura-1';

// Registra un usuario, lo loguea y devuelve su token y sus datos.
export async function crearUsuarioYToken(email = 'ana@mail.com', name = 'Ana') {
    await request(app)
        .post('/auth/register')
        .send({ name, email, password: PASSWORD });

    const login = await request(app)
        .post('/auth/login')
        .send({ email, password: PASSWORD });

    return login.body as { token: string; user: { id: number; name: string; email: string } };
}
