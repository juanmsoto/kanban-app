import { eq, max } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { cards, columns } from '../../db/schema.js';
import { BoardNotFoundError } from '../../errors.js';
import { assertBoardRole } from '../boards/boards.service.js';
import { assertBoardRoleForColumn } from '../columns/columns.service.js';
import { SEPARACION } from '../../position.js';
import type { CreateCardInput, UpdateCardInput } from './cards.schemas.js';

async function assertBoardRoleForCard(userId: number, cardId: number, minimo: 'viewer' | 'editor' | 'owner') {
    const [fila] = await db
        .select({ boardId: columns.boardId })
        .from(cards)
        .innerJoin(columns, eq(cards.columnId, columns.id))
        .where(eq(cards.id, cardId));

    if(!fila) {
        throw new BoardNotFoundError();
    }

    await assertBoardRole(userId, fila.boardId, minimo);
}

export async function createCard(userId: number, columnId: number, { title, description }: CreateCardInput) {
    await assertBoardRoleForColumn(userId, columnId, 'editor');

    return db.transaction(async (tx) => {
        const [ultima] = await tx
            .select({ position: max(cards.position) })
            .from(cards)
            .where(eq(cards.columnId, columnId));

        const position = (ultima?.position ?? 0) + SEPARACION;

        const [card] = await tx
            .insert(cards)
            .values({ columnId, title, description, position })
            .returning();

        if(!card) {
            throw new Error('El insert no devolvio la tarjeta creada');
        }

        return card;
    });
}

export async function updateCard(userId: number, cardId: number, { title, description }: UpdateCardInput) {
    await assertBoardRoleForCard(userId, cardId, 'editor');

    const [card] = await db
        .update(cards)
        .set({ title, description })
        .where(eq(cards.id, cardId))
        .returning();

    if(!card) {
        throw new BoardNotFoundError();
    }

    return card;
}

export async function deleteCard(userId: number, cardId: number) {
    await assertBoardRoleForCard(userId, cardId, 'editor');

    await db.delete(cards).where(eq(cards.id, cardId));
}