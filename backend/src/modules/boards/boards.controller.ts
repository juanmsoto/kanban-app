import type { Request, Response } from 'express';
import { z } from 'zod';
import { boardIdParamSchema, createBoardSchema } from './boards.schemas.js';
import { createBoard, getBoard, listBoards } from './boards.service.js';


export async function createBoardController(req: Request, res: Response) { 
    if(!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }

    const parsed = createBoardSchema.safeParse(req.body)

    if(!parsed.success) {
        res.status(400).json({
            error: 'Datos invalidos',
            fields: z.flattenError(parsed.error).fieldErrors,
        });
        return;
    }

    const board = await createBoard(req.user.id, parsed.data);
    res.status(201).json(board);
}

export async function getBoardController(req: Request, res: Response) {
    if(!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }

    const parsed = boardIdParamSchema.safeParse(req.params);

    if(!parsed.success) {
        res.status(404).json({
            error: 'No encontrado'
        });
        return;
    }

    const result = await getBoard(req.user.id, parsed.data.id);

    res.status(200).json(result);
}

export async function listBoardsController(req: Request, res: Response) {
    if(!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }

    const boards = await listBoards(req.user.id);

    res.status(200).json(boards);
}