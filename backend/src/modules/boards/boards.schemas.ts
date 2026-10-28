import { z } from 'zod';

import { boardRole } from '../../db/schema.js';

export const createBoardSchema = z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
});

export const boardIdParamSchema = z.object({
    id: z.coerce.number().int().positive().max(2_147_483_647),
});

export const addMemberSchema = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email()),
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
        name: z.string().trim().min(1).max(100).optional(),
        description: z.string().trim().max(500).nullable().optional(),
    })
    .refine((data) => data.name !== undefined || data.description !== undefined, {
        message: 'Hay que enviar al menos un campo',
    });

export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export type CreateBoardInput = z.infer<typeof createBoardSchema>;

export type AddMemberInput = z.infer<typeof addMemberSchema>;