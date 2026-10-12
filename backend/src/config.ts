import 'dotenv/config';

const JWT_SECRET_MIN_LENGTH = 32;

// Lee el .env una sola vez y falla al arrancar si falta algo, no en el primer login.
const secret = process.env.JWT_SECRET;

if(!secret) {
    throw new Error('Falta JWT_SECRET en el .env');
}

if(secret === 'CAMBIAR_SECRETO' || secret.length < JWT_SECRET_MIN_LENGTH) {
    throw new Error(
        `JWT_SECRET es debil (minimo ${JWT_SECRET_MIN_LENGTH} caracteres y distinto de la plantilla). ` +
        'Generá uno con: openssl rand -hex 32'
    );
}

export const jwtSecret: string = secret;