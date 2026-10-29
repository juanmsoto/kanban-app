import type { Request, Response } from 'express';
import { z } from 'zod';
import { boardIdParamSchema } from '../boards/boards.schemas.js';
import { columnIdParamSchema, createColumnSchema, updateColumnSchema } from './columns.schemas.js';
import { createColumn, deleteColumn, listColumns, updateColumn } from './columns.service.js';

export async function listColumnsController(req: Request, res: Response) {
    if(!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }

    const parsedParams = boardIdParamSchema.safeParse(req.params);

    if(!parsedParams.success) {
        res.status(404).json({ error: 'No encontrado' });
        return;
    }

    const columns = await listColumns(req.user.id, parsedParams.data.id);

    res.status(200).json(columns);
}

export async function createColumnController(req: Request, res: Response) {
    if(!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }

    const parsedParams = boardIdParamSchema.safeParse(req.params);

    if(!parsedParams.success) {
        res.status(404).json({ error: 'No encontrado' });
        return;
    }

    const parsedBody = createColumnSchema.safeParse(req.body);

    if(!parsedBody.success) {
        res.status(400).json({
            error: 'Datos invalidos',
            fields: z.flattenError(parsedBody.error).fieldErrors,
        });
        return;
    }

    const column = await createColumn(req.user.id, parsedParams.data.id, parsedBody.data);

    res.status(201).json(column);
}

export async function updateColumnController(req: Request, res: Response) {
    if(!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }

    const parsedParams = columnIdParamSchema.safeParse(req.params);

    if(!parsedParams.success) {
        res.status(404).json({ error: 'No encontrado' });
        return;
    }

    const parsedBody = updateColumnSchema.safeParse(req.body);

    if(!parsedBody.success) {
        res.status(400).json({
            error: 'Datos invalidos',
            fields: z.flattenError(parsedBody.error).fieldErrors,
        });
        return;
    }

    const column = await updateColumn(req.user.id, parsedParams.data.id, parsedBody.data);

    res.status(200).json(column);
}

export async function deleteColumnController(req: Request, res: Response) {
    if(!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }

    const parsedParams = columnIdParamSchema.safeParse(req.params);

    if(!parsedParams.success) {
        res.status(404).json({ error: 'No encontrado' });
        return;
    }

    await deleteColumn(req.user.id, parsedParams.data.id);

    res.status(204).send();
}