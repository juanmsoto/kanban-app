import { z } from 'zod';

import { boardRole } from '../../db/schema.js';

export const createBoardSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, 'El nombre es obligatorio')
        .max(100, 'El nombre no puede superar los 100 caracteres'),
    description: z
        .string()
        .trim()
        .max(500, 'La descripcion no puede superar los 500 caracteres')
        .optional(),
});

export const boardIdParamSchema = z.object({
    id: z.coerce.number().int().positive().max(2_147_483_647),
});

export const addMemberSchema = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email('El email no es valido')),
    role: z.enum(boardRole.enumValues),
});

export const memberParamSchema = z.object({
    id: z.coerce.number().int().positive().max(2_147_483_647),
    userId: z.coerce.number().int().positive().max(2_147_483_647),
});

export const updateMemberSchema = z.object({
    role: z.enum(boardRole.enumValues),
});

export const updateBoardSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, 'El nombre es obligatorio')
            .max(100, 'El nombre no puede superar los 100 caracteres')
            .optional(),
        description: z
            .string()
            .trim()
            .max(500, 'La descripcion no puede superar los 500 caracteres')
            .nullable()
            .optional(),
    })
    .refine((data) => data.name !== undefined || data.description !== undefined, {
        message: 'Hay que enviar al menos un campo',
    });

export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export type CreateBoardInput = z.infer<typeof createBoardSchema>;

export type AddMemberInput = z.infer<typeof addMemberSchema>;