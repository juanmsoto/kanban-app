import { asc, eq, max } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { columns } from '../../db/schema.js';
import { BoardNotFoundError } from '../../errors.js';
import { assertBoardRole } from '../boards/boards.service.js';
import type { CreateColumnInput, UpdateColumnInput } from './columns.schemas.js';

const SEPARACION = 1000;

// Resuelve columna -> tablero y comprueba el rol del usuario en ESE tablero (la columna no tiene roles propios).
// Columna inexistente y columna de un tablero ajeno responden igual (404).
export async function assertBoardRoleForColumn(userId: number, columnId: number, minimo: 'viewer' | 'editor' | 'owner') {
    const [column] = await db
        .select({ boardId: columns.boardId })
        .from(columns)
        .where(eq(columns.id, columnId));

    if(!column) {
        throw new BoardNotFoundError();
    }

    await assertBoardRole(userId, column.boardId, minimo);
}

export async function listColumns(userId: number, boardId: number) {
    await assertBoardRole(userId, boardId, 'viewer');

    return db
        .select()
        .from(columns)
        .where(eq(columns.boardId, boardId))
        .orderBy(asc(columns.position), asc(columns.id));
}

export async function createColumn(userId: number, boardId: number, { title }: CreateColumnInput) {
    await assertBoardRole(userId, boardId, 'editor');

    return db.transaction(async (tx) => {
        const [ultima] = await tx
            .select({ position: max(columns.position) })
            .from(columns)
            .where(eq(columns.boardId, boardId));

        const position = (ultima?.position ?? 0) + SEPARACION;

        const [column] = await tx
            .insert(columns)
            .values({ boardId, title, position })
            .returning();

        if(!column) {
            throw new Error('El insert no devolvio la columna creada');
        }

        return column;
    });
}

export async function updateColumn(userId: number, columnId: number, { title }: UpdateColumnInput) {
    await assertBoardRoleForColumn(userId, columnId, 'editor');

    const [column] = await db
        .update(columns)
        .set({ title })
        .where(eq(columns.id, columnId))
        .returning();

    if(!column) {
        throw new BoardNotFoundError();
    }

    return column;
}

export async function deleteColumn(userId: number, columnId: number) {
    await assertBoardRoleForColumn(userId, columnId, 'editor');

    await db.delete(columns).where(eq(columns.id, columnId));
}