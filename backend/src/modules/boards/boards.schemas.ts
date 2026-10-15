import { z } from 'zod';

export const createBoardSchema = z.object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).optional(),
});

export const boardIdParamSchema = z.object({
    id: z.coerce.number().int().positive().max(2_147_483_647),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;