import bcrypt from 'bcrypt';
import { DatabaseError } from 'pg';
import { DrizzleQueryError } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { users } from '../../db/schema.js';
import type { RegisterInput } from './auth.schemas.js';

const BCRYPT_ROUNDS = 10;

export class EmailAlreadyRegisteredError extends Error {}

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
