import { eq, max, asc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { cards, columns } from '../../db/schema.js';
import { BoardNotFoundError, InvalidMoveError  } from '../../errors.js';
import { assertBoardRole } from '../boards/boards.service.js';
import { assertBoardRoleForColumn } from '../columns/columns.service.js';
import { SEPARACION, posicionEntre } from '../../position.js';
import type { CreateCardInput, MoveCardInput, UpdateCardInput } from './cards.schemas.js';

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
    return fila.boardId;
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

export async function moveCard(userId: number, cardId: number, { columnId, afterId }: MoveCardInput) {
    const boardId = await assertBoardRoleForCard(userId, cardId, 'editor');

    return db.transaction(async (tx) => {
        const columnasDelTablero = await tx
            .select({ id: columns.id })
            .from(columns)
            .where(eq(columns.boardId, boardId))
            .for('update');

        if(!columnasDelTablero.some((c) => c.id === columnId)) {
            throw new InvalidMoveError();
        }

        const destino = await tx
            .select({ id: cards.id, position: cards.position })
            .from(cards)
            .where(eq(cards.columnId, columnId))
            .orderBy(asc(cards.position), asc(cards.id));

        const resto = destino.filter((c) => c.id !== cardId);
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
                await tx.update(cards).set({ position: lugar * SEPARACION }).where(eq(cards.id, c.id));
            }
            position = (indice + 2) * SEPARACION;
        }

        const [card] = await tx
            .update(cards)
            .set({ columnId, position })
            .where(eq(cards.id, cardId))
            .returning();

        if(!card) {
            throw new BoardNotFoundError();
        }

        return card;
    });
}