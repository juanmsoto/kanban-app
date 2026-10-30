import type { Request, Response } from 'express';
import { z } from 'zod';
import { columnIdParamSchema } from '../columns/columns.schemas.js';
import { cardIdParamSchema, createCardSchema, moveCardSchema, updateCardSchema } from './cards.schemas.js';
import { createCard, deleteCard, moveCard, updateCard } from './cards.service.js';

export async function createCardController(req: Request, res: Response) {
    if(!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }

    const parsedParams = columnIdParamSchema.safeParse(req.params);

    if(!parsedParams.success) {
        res.status(404).json({ error: 'No encontrado' });
        return;
    }

    const parsedBody = createCardSchema.safeParse(req.body);

    if(!parsedBody.success) {
        res.status(400).json({
            error: 'Datos invalidos',
            fields: z.flattenError(parsedBody.error).fieldErrors,
        });
        return;
    }

    const card = await createCard(req.user.id, parsedParams.data.id, parsedBody.data);

    res.status(201).json(card);
}

export async function updateCardController(req: Request, res: Response) {
    if(!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }

    const parsedParams = cardIdParamSchema.safeParse(req.params);

    if(!parsedParams.success) {
        res.status(404).json({ error: 'No encontrado' });
        return;
    }

    const parsedBody = updateCardSchema.safeParse(req.body);

    if(!parsedBody.success) {
        res.status(400).json({
            error: 'Datos invalidos',
            fields: z.flattenError(parsedBody.error).fieldErrors,
        });
        return;
    }

    const card = await updateCard(req.user.id, parsedParams.data.id, parsedBody.data);

    res.status(200).json(card);
}

export async function deleteCardController(req: Request, res: Response) {
    if(!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }

    const parsedParams = cardIdParamSchema.safeParse(req.params);

    if(!parsedParams.success) {
        res.status(404).json({ error: 'No encontrado' });
        return;
    }

    await deleteCard(req.user.id, parsedParams.data.id);

    res.status(204).send();
}

export async function moveCardController(req: Request, res: Response) {
    if(!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }

    const parsedParams = cardIdParamSchema.safeParse(req.params);

    if(!parsedParams.success) {
        res.status(404).json({ error: 'No encontrado' });
        return;
    }

    const parsedBody = moveCardSchema.safeParse(req.body);

    if(!parsedBody.success) {
        res.status(400).json({
            error: 'Datos invalidos',
            fields: z.flattenError(parsedBody.error).fieldErrors,
        });
        return;
    }

    const card = await moveCard(req.user.id, parsedParams.data.id, parsedBody.data);

    res.status(200).json(card);
}