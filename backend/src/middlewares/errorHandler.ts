import type { Request, Response, NextFunction } from 'express';
import { DatabaseError } from 'pg';
import { DrizzleQueryError } from 'drizzle-orm';
import { AlreadyMemberError, BoardNotFoundError, ForbiddenError, LastOwnerError, MemberNotFoundError, UserNotFoundError } from '../errors.js';

// Loguea el error sin volcar los parametros de la consulta (traen el password_hash).
function logError(err: unknown) {
    if (err instanceof DrizzleQueryError) {
        if (err.cause instanceof DatabaseError) {
            // La base respondio con un error: solo campos seguros (detail trae valores).
            console.error('Error de base de datos', {
                message: err.cause.message,
                code: err.cause.code,
                constraint: err.cause.constraint,
            });
        } else {
            // Sin respuesta de la base (ej. conexion caida): SQL con marcadores, sin valores.
            console.error('Error de base de datos', {
                query: err.query,
                causa: err.cause instanceof Error ? err.cause.message : undefined,
            });
        }
        return;
    }
    console.error(err);
}

// Ninguna ruta anterior respondio: 404 en JSON (nada de vistas ni redirects).
export function notFound(_req: Request, res: Response) {
    res.status(404).json({ error: 'No encontrado' });
}

// Manejador de errores: Express lo reconoce por tener 4 parametros.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
    if(err instanceof BoardNotFoundError) {
        res.status(404).json({ error: 'No encontrado' });
        return;
    }

    if(err instanceof ForbiddenError) {
        res.status(403).json({ error: 'Prohibido' });
        return;
    }
    
    if(err instanceof UserNotFoundError) {
        res.status(404).json({ error: 'Usuario no encontrado' });
        return;
    }

    if(err instanceof AlreadyMemberError) {
        res.status(409).json({ error: 'El usuario ya es miembro del tablero' });
        return;
    }

    if(err instanceof MemberNotFoundError) {
        res.status(404).json({ error: 'Miembro no encontrado' });
        return;
    }

    if(err instanceof LastOwnerError) {
        res.status(409).json({ error: 'El tablero debe tener al menos un owner' });
        return;
    }

    const status =
        typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof err.status === 'number' &&
        err.status >= 400 &&
        err.status < 500
            ? err.status
            : 500;

    if (status === 500) {
        logError(err);
    }

    res.status(status).json({
        error: status === 500 ? 'Error interno del servidor' : 'Solicitud inválida',
    });
}
