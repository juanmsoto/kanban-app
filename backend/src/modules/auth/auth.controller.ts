import type { Request, Response } from 'express';
import { z } from 'zod';
import { registerSchema } from './auth.schemas.js';
import { registerUser, EmailAlreadyRegisteredError } from './auth.service.js';

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

