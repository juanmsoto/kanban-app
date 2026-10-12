import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { jwtSecret } from '../config.js';

function noAutenticado(res: Response) {
    res.status(401).json({ error: 'No autenticado' });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;

    if(!header) {
        noAutenticado(res);
        return;
    }

    const [ type, token, ...sobrante ] = header.split(' ');

    if(type !== 'Bearer' || !token || sobrante.length > 0) {
        noAutenticado(res);
        return;
    }

    let id: number;

    try {
        const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });

        if(typeof payload === 'string' || typeof payload.sub !== 'string') {
            noAutenticado(res);
            return;
        }

        id = Number(payload.sub);
    } catch {
        noAutenticado(res);
        return;
    }

    if(!Number.isInteger(id)) {
        noAutenticado(res);
        return;
    }

    const [user] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, id));
    
    if(!user) {
        noAutenticado(res);
        return;
    }

    req.user = user;
    next();
}