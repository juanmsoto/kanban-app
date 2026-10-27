import type { Request, Response } from 'express';
import { z } from 'zod';
import { addMemberSchema, boardIdParamSchema, createBoardSchema, memberParamSchema, updateMemberSchema } from './boards.schemas.js';
import { addMember, createBoard, getBoard, listBoards, listMembers, updateMemberRole } from './boards.service.js';


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

export async function listMembersController(req: Request, res: Response) {
    if(!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }

    const parsed = boardIdParamSchema.safeParse(req.params);

    if(!parsed.success) {
        res.status(404).json({ error: 'No encontrado' });
        return;
    }

    const members = await listMembers(req.user.id, parsed.data.id);

    res.status(200).json(members);
}

export async function addMemberController(req: Request, res: Response) {
    if(!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }

    const parsedParams = boardIdParamSchema.safeParse(req.params);

    if(!parsedParams.success) {
        res.status(404).json({ error: 'No encontrado' });
        return;
    }

    const parsedBody = addMemberSchema.safeParse(req.body);

    if(!parsedBody.success) {
        res.status(400).json({
            error: 'Datos invalidos',
            fields: z.flattenError(parsedBody.error).fieldErrors,
        });
        return;
    }

    const member = await addMember(req.user.id, parsedParams.data.id, parsedBody.data);

    res.status(201).json(member);
}

export async function updateMemberController(req: Request, res: Response) {
    if(!req.user) {
        res.status(401).json({ error: 'No autenticado' });
        return;
    }

    const parsedParams = memberParamSchema.safeParse(req.params);

    if(!parsedParams.success) {
        res.status(404).json({ error: 'No encontrado' });
        return;
    }

    const parsedBody = updateMemberSchema.safeParse(req.body);

    if(!parsedBody.success) {
        res.status(400).json({
            error: 'Datos invalidos',
            fields: z.flattenError(parsedBody.error).fieldErrors,
        });
        return;
    }

    const { id, userId } = parsedParams.data;
    const member = await updateMemberRole(req.user.id, id, userId, parsedBody.data);

    res.status(200).json(member);
}