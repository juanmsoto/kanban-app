import { z } from 'zod';

export const columnIdParamSchema = z.object({
    id: z.coerce.number().int().positive().max(2_147_483_647),
});

export const createColumnSchema = z.object({
    title: z
        .string()
        .trim()
        .min(1, 'El titulo es obligatorio')
        .max(100, 'El titulo no puede superar los 100 caracteres'),
});

export const updateColumnSchema = z.object({
    title: z
        .string()
        .trim()
        .min(1, 'El titulo es obligatorio')
        .max(100, 'El titulo no puede superar los 100 caracteres'),
});

export const moveColumnSchema = z.object({
    afterId: z.number().int().positive().max(2_147_483_647).nullable(),
});

export type MoveColumnInput = z.infer<typeof moveColumnSchema>;
export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;