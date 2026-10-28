import { db } from "../../db/client.js";
import { boardMembers, boards, users } from "../../db/schema.js";
import type { AddMemberInput, CreateBoardInput, UpdateBoardInput, UpdateMemberInput } from "./boards.schemas.js";
import { boardRole } from '../../db/schema.js';
import { and, desc, asc, eq, DrizzleQueryError } from "drizzle-orm";
import { AlreadyMemberError, BoardNotFoundError, ForbiddenError, LastOwnerError, MemberNotFoundError, UserNotFoundError } from "../../errors.js";
import { DatabaseError } from "pg";

type BoardRole = (typeof boardRole.enumValues)[number];

const RANGOS: Record<BoardRole, number> = {
    viewer: 1,
    editor: 2,
    owner: 3,
};

function esMiembroDuplicado(error: unknown): boolean {
    return (
        error instanceof DrizzleQueryError &&
        error.cause instanceof DatabaseError &&
        error.cause.code === '23505' &&
        error.cause.constraint === 'board_members_pkey'
    );
}

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

export async function listMembers(userId: number, boardId: number) {
    await assertBoardRole(userId, boardId, 'viewer');

    return db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: boardMembers.role,
        })
        .from(boardMembers)
        .innerJoin(users, eq(boardMembers.userId, users.id))
        .where(eq(boardMembers.boardId, boardId))
        .orderBy(asc(boardMembers.createdAt), asc(users.id));
}

export async function addMember(userId: number, boardId: number, { email, role }: AddMemberInput) {
    await assertBoardRole(userId, boardId, 'owner');

    const [user] = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.email, email));

    if(!user) {
        throw new UserNotFoundError();
    }

    try {
        await db.insert(boardMembers).values({ boardId, userId: user.id, role });
    } catch(error) {
        if(esMiembroDuplicado(error)) {
            throw new AlreadyMemberError();
        }
        throw error;
    }

    return { id: user.id, name: user.name, email: user.email, role };
}

export async function updateMemberRole(
    userId: number,
    boardId: number,
    targetUserId: number,
    { role }: UpdateMemberInput,
) {
    await assertBoardRole(userId, boardId, 'owner');

    return db.transaction(async (tx) => {
        const owners = await tx
            .select({ userId: boardMembers.userId })
            .from(boardMembers)
            .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.role, 'owner')))
            .for('update');

        const [target] = await tx
            .select({ role: boardMembers.role })
            .from(boardMembers)
            .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, targetUserId)));

        if(!target) {
            throw new MemberNotFoundError();
        }

        if(target.role === 'owner' && role !== 'owner' && owners.length === 1) {
            throw new LastOwnerError();
        }

        await tx
            .update(boardMembers)
            .set({ role })
            .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, targetUserId)));

        const [member] = await tx
            .select({
                id: users.id,
                name: users.name,
                email: users.email,
                role: boardMembers.role,
            })
            .from(boardMembers)
            .innerJoin(users, eq(boardMembers.userId, users.id))
            .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, targetUserId)));

        return member;
    });
}

export async function removeMember(userId: number, boardId: number, targetUserId: number) {
    const minimo: BoardRole = targetUserId === userId ? 'viewer' : 'owner';
    await assertBoardRole(userId, boardId, minimo);

    await db.transaction(async (tx) => {
        const owners = await tx
            .select({ userId: boardMembers.userId })
            .from(boardMembers)
            .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.role, 'owner')))
            .for('update');

        const [target] = await tx
            .select({ role: boardMembers.role })
            .from(boardMembers)
            .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, targetUserId)));

        if(!target) {
            throw new MemberNotFoundError();
        }

        if(target.role === 'owner' && owners.length === 1) {
            throw new LastOwnerError();
        }

        await tx
            .delete(boardMembers)
            .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, targetUserId)));
    });
}

export async function updateBoard(userId: number, boardId: number, { name, description }: UpdateBoardInput) {
    const role = await assertBoardRole(userId, boardId, 'editor');

    const [board] = await db
        .update(boards)
        .set({ name, description })
        .where(eq(boards.id, boardId))
        .returning();

    if(!board) {
        throw new BoardNotFoundError();
    }

    return { ...board, role };
}

export async function deleteBoard(userId: number, boardId: number) {
    await assertBoardRole(userId, boardId, 'owner');

    await db.delete(boards).where(eq(boards.id, boardId));
}