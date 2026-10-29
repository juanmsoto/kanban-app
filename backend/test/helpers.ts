import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app.js';
import { db } from '../src/db/client.js';
import { boardMembers, users } from '../src/db/schema.js';
import { jwtSecret } from '../src/config.js';

const PASSWORD = 'clave-segura-1';

// Hash barato (4 rondas), calculado una sola vez por archivo de tests. Los tests que no prueban el login
// solo necesitan una fila de usuario valida; las 10 rondas de produccion costarian ~60 ms por usuario.
const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4);

type UsuarioDeTest = { token: string; user: { id: number; name: string; email: string } };

// Crea el usuario directo en la base y firma su token igual que lo hace el login (sub = id, 1 h).
// No pasa por /auth: sirve para tests de otros modulos. El email debe venir ya en minusculas.
export async function crearUsuarioYToken(email = 'ana@mail.com', name = 'Ana'): Promise<UsuarioDeTest> {
    const [user] = await db
        .insert(users)
        .values({ name, email, passwordHash: PASSWORD_HASH })
        .returning({ id: users.id, name: users.name, email: users.email });

    if (!user) {
        throw new Error('El insert no devolvio el usuario creado');
    }

    const token = jwt.sign({ sub: String(user.id) }, jwtSecret, { expiresIn: '1h' });

    return { token, user };
}

// Crea un tablero por la API (el usuario del token queda como owner) y devuelve su id.
export async function crearTablero(token: string, name = 'Mi tablero') {
    const response = await request(app)
        .post('/boards')
        .set('Authorization', `Bearer ${token}`)
        .send({ name });
    return response.body.id as number;
}

// Agrega a un usuario a un tablero con el rol dado (directo en la base).
export async function agregarMiembro(boardId: number, userId: number, role: 'owner' | 'editor' | 'viewer') {
    await db.insert(boardMembers).values({ boardId, userId, role });
}

// Crea una columna por la API y devuelve su cuerpo.
export async function crearColumna(token: string, boardId: number, title = 'Por hacer') {
    const response = await request(app)
        .post(`/boards/${boardId}/columns`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title });
    return response.body as { id: number; boardId: number; title: string; position: number };
}

// Crea una tarjeta por la API y devuelve su cuerpo.
export async function crearTarjeta(token: string, columnId: number, title = 'Una tarjeta', description?: string) {
    const response = await request(app)
        .post(`/columns/${columnId}/cards`)
        .set('Authorization', `Bearer ${token}`)
        .send(description === undefined ? { title } : { title, description });
    return response.body as {
        id: number;
        columnId: number;
        title: string;
        description: string | null;
        position: number;
    };
}

// Flujo real por la API (registro + login con bcrypt de produccion). Usar solo cuando el test
// quiere comprobar de punta a punta que el token que entrega el login sirve para autenticarse.
export async function registrarYLoguear(email = 'ana@mail.com', name = 'Ana') {
    await request(app)
        .post('/auth/register')
        .send({ name, email, password: PASSWORD });

    const login = await request(app)
        .post('/auth/login')
        .send({ email, password: PASSWORD });

    return login.body as UsuarioDeTest;
}
