import { db } from "../../db/client.js";
import { boardMembers, boards } from "../../db/schema.js";
import type { CreateBoardInput } from "./boards.schemas.js";
import { boardRole } from '../../db/schema.js';
import { and, desc, eq } from "drizzle-orm";
import { BoardNotFoundError, ForbiddenError } from "../../errors.js";

type BoardRole = (typeof boardRole.enumValues)[number];

const RANGOS: Record<BoardRole, number> = {
    viewer: 1,
    editor: 2,
    owner: 3,
};

export async function createBoard(userId: number, { name, description }: CreateBoardInput) {
    return db.transaction(async (tx) => {
        const [board] = await tx
            .insert(boards)
            .values({ name, description })
            .returning();

        if(!board) {
            throw new Error('El insert no devolvio el tablero creado');
        }

        await tx.insert(boardMembers).values({
                boardId: board.id,
                userId,
                role: 'owner'
            })
        
        return { ...board, role: 'owner' as const };
    });
}

export async function assertBoardRole(userId: number, boardId: number, minimo: BoardRole) {
    const [membership] = await db
        .select({ role: boardMembers.role})
        .from(boardMembers)
        .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)));
    
    if(!membership) {
        throw new BoardNotFoundError();
    }

    if(RANGOS[membership.role] < RANGOS[minimo]) {
        throw new ForbiddenError();
    }

    return membership.role;
}

export async function getBoard(userId: number, boardId: number) {
    const role = await assertBoardRole(userId, boardId, 'viewer');

    const [board] = await db
        .select()
        .from(boards)
        .where(eq(boards.id, boardId));
    
    if(!board) {
        throw new BoardNotFoundError();
    }
    
    return { ...board, role };
}

export async function listBoards(userId: number) {
    return db
        .select({
            id: boards.id,
            name: boards.name,
            description: boards.description,
            createdAt: boards.createdAt,
            updatedAt: boards.updatedAt,
            role: boardMembers.role,
        })
        .from(boardMembers)
        .innerJoin(boards, eq(boardMembers.boardId, boards.id))
        .where(eq(boardMembers.userId, userId))
        .orderBy(desc(boards.createdAt), desc(boards.id));
}