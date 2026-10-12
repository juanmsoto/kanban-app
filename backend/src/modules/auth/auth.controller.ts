import type { Request, Response } from 'express';
import { z } from 'zod';
import { loginSchema, registerSchema } from './auth.schemas.js';
import { registerUser, EmailAlreadyRegisteredError, loginUser, InvalidCredentialsError } from './auth.service.js';

export async function register(req: Request, res: Response) {
    const parsed = registerSchema.safeParse(req.body);

    if(!parsed.success) {
        res.status(400).json({
            error: 'Datos invalidos',
            fields: z.flattenError(parsed.error).fieldErrors,
        });
        return;
    }
    
    try {
        const user = await registerUser(parsed.data);
        res.status(201).json({ user });
    } catch(error) {
        if(error instanceof EmailAlreadyRegisteredError) {
            res.status(409).json({ error: 'El email ya esta registrado' });
            return;
        }
        throw error;
    }
}

export async function login(req: Request, res: Response) {
    const parsed = loginSchema.safeParse(req.body);

    if(!parsed.success) {
        res.status(400).json({
            error: 'Datos invalidos',
            fields: z.flattenError(parsed.error).fieldErrors,
        });
        return;
    }

    try {
        const result = await loginUser(parsed.data);
        res.status(200).json(result);
    } catch(err) {
        if(err instanceof InvalidCredentialsError) {
            res.status(401).json({ error: 'Credenciales invalidas' });
            return;
        }
        throw err;
     }
}

export function me(req: Request, res: Response) {
    res.status(200).json({ user: req.user });
}


