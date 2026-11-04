import { z } from 'zod';

export const cardIdParamSchema = z.object({
    id: z.coerce.number().int().positive().max(2_147_483_647),
});

export const createCardSchema = z.object({
    title: z
        .string()
        .trim()
        .min(1, 'El titulo es obligatorio')
        .max(100, 'El titulo no puede superar los 100 caracteres'),
    description: z
        .string()
        .trim()
        .max(2000, 'La descripcion no puede superar los 2000 caracteres')
        .optional(),
});

export const updateCardSchema = z
    .object({
        title: z
            .string()
            .trim()
            .min(1, 'El titulo es obligatorio')
            .max(100, 'El titulo no puede superar los 100 caracteres')
            .optional(),
        description: z
            .string()
            .trim()
            .max(2000, 'La descripcion no puede superar los 2000 caracteres')
            .nullable()
            .optional(),
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