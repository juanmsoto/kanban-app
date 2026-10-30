import { z } from 'zod';

export const cardIdParamSchema = z.object({
    id: z.coerce.number().int().positive().max(2_147_483_647),
});

export const createCardSchema = z.object({
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().max(2000).optional(),
});

export const updateCardSchema = z
    .object({
        title: z.string().trim().min(1).max(100).optional(),
        description: z.string().trim().max(2000).nullable().optional(),
    })
    .refine((data) => data.title !== undefined || data.description !== undefined, {
        message: 'Hay que enviar al menos un campo',
    });

export const moveCardSchema = z.object({
    columnId: z.number().int().positive().max(2_147_483_647),
    afterId: z.number().int().positive().max(2_147_483_647).nullable(),
});

export type MoveCardInput = z.infer<typeof moveCardSchema>;
export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;