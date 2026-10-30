import { asc, eq, max } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { columns } from '../../db/schema.js';
import { BoardNotFoundError, InvalidMoveError } from '../../errors.js';
import { assertBoardRole } from '../boards/boards.service.js';
import { SEPARACION, posicionEntre } from '../../position.js';
import type { CreateColumnInput, MoveColumnInput, UpdateColumnInput } from './columns.schemas.js';

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
    return column.boardId;
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

export async function moveColumn(userId: number, columnId: number, { afterId }: MoveColumnInput) {
    const boardId = await assertBoardRoleForColumn(userId, columnId, 'editor');

    return db.transaction(async (tx) => {
        const bloqueadas = await tx
            .select({ id: columns.id, position: columns.position })
            .from(columns)
            .where(eq(columns.boardId, boardId))
            .for('update');

        const todas = bloqueadas.sort((x, y) => x.position - y.position || x.id - y.id);

        if(!todas.some((c) => c.id === columnId)) {
            throw new BoardNotFoundError();
        }

        const resto = todas.filter((c) => c.id !== columnId);
        const indice = afterId === null ? -1 : resto.findIndex((c) => c.id === afterId);

        if(afterId !== null && indice === -1) {
            throw new InvalidMoveError();
        }

        const anterior = resto[indice] ?? null;
        const siguiente = resto[indice + 1] ?? null;
        let position = posicionEntre(anterior?.position ?? null, siguiente?.position ?? null);

        if(position === null) {
            for(const [i, c] of resto.entries()) {
                const lugar = i <= indice ? i + 1 : i + 2;
                await tx.update(columns).set({ position: lugar * SEPARACION }).where(eq(columns.id, c.id));
            }
            position = (indice + 2) * SEPARACION;
        }

        const [column] = await tx
            .update(columns)
            .set({ position })
            .where(eq(columns.id, columnId))
            .returning();

        if(!column) {
            throw new BoardNotFoundError();
        }

        return column;
    });
}