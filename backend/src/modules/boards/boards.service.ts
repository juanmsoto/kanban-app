import { db } from "../../db/client.js";
import { boards, boardMembers } from "../../db/schema.js";
import type { CreateBoardInput } from "./boards.schemas.js";
import { boardRole } from '../../db/schema.js';
import { and, eq } from "drizzle-orm";
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
        
        return board;
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
    
    return { board, role };
}