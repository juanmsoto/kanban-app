import { z } from 'zod';

export const columnIdParamSchema = z.object({
    id: z.coerce.number().int().positive().max(2_147_483_647),
});

export const createColumnSchema = z.object({
    title: z.string().trim().min(1).max(100),
});

export const updateColumnSchema = z.object({
    title: z.string().trim().min(1).max(100),
});

export type CreateColumnInput = z.infer<typeof createColumnSchema>;
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;