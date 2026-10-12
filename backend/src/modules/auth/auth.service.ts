import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { DatabaseError } from 'pg';
import { DrizzleQueryError, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { jwtSecret } from '../../config.js';
import { users } from '../../db/schema.js';
import type { RegisterInput, LoginInput } from './auth.schemas.js';

const BCRYPT_ROUNDS = 10;
const JWT_EXPIRES_IN = '1h';

// Hash de relleno: si el email no existe igual hacemos un compare, para que
// "email inexistente" y "contrasena incorrecta" tarden lo mismo.
const DUMMY_HASH = bcrypt.hashSync('relleno', BCRYPT_ROUNDS);

export class EmailAlreadyRegisteredError extends Error {}
export class InvalidCredentialsError extends Error {}

function esEmailDuplicado(error: unknown): boolean {
    return (
        error instanceof DrizzleQueryError &&
        error.cause instanceof DatabaseError &&
        error.cause.code === '23505' &&
        error.cause.constraint === 'users_email_key'
    );
}

export async function registerUser({ name, email, password }: RegisterInput) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    try {
        const [user] = await db
        .insert(users)
        .values({ name, email, passwordHash })
        .returning({
            id: users.id,
            name: users.name,
            email: users.email,
            createdAt: users.createdAt
        });

        if(!user) {
            throw new Error('El insert no devolvio el usuario creado');
        }

        return user;
    } catch(error) {
        if(esEmailDuplicado(error)){
            throw new EmailAlreadyRegisteredError();
        }
        throw error;
    }
}

export async function loginUser({ email, password }: LoginInput) {
    const [user] = await db.select().from(users).where(eq(users.email, email));

    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

    if(!user || !passwordOk) {
        throw new InvalidCredentialsError();
    }

    const token = jwt.sign({ sub: String(user.id) }, jwtSecret, {
        expiresIn: JWT_EXPIRES_IN,
    });

    return {
        token,
        user: { id: user.id, name: user.name, email: user.email },
    };
}
