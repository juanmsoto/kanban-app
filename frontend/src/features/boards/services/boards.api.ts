import { apiFetch } from '../../../services/api';

export type Board = {
    id: number;
    name: string;
    description: string | null;
    role: 'owner' | 'editor' | 'viewer';
    createdAt: string;
    updatedAt: string;
};

export type Card = {
    id: number;
    columnId: number;
    title: string;
    description: string | null;
};

export type Column = {
    id: number;
    title: string;
    cards: Card[];
};

export type BoardDetail = Board & {
    columns: Column[];
};

export type BoardRole = Board['role'];

export type Member = {
    id: number;
    name: string;
    email: string;
    role: BoardRole;
};

export async function getBoards(): Promise<Board[]> {
    return apiFetch<Board[]>('/boards');
}

export async function createBoard(
    name: string,
    description: string,
): Promise<Board> {
    return apiFetch<Board>('/boards', {
        method: 'POST',
        body: { name, description: description || undefined },
    });
}

export async function getBoard(id: string): Promise<BoardDetail> {
    return apiFetch<BoardDetail>(`/boards/${id}`);
}

export async function updateBoard(
    boardId: number,
    name: string,
    description: string,
): Promise<Board> {
    return apiFetch<Board>(`/boards/${boardId}`, {
        method: 'PATCH',
        body: { name, description: description || null },
    });
}

export async function getMembers(boardId: number): Promise<Member[]> {
    return apiFetch<Member[]>(`/boards/${boardId}/members`);
}

export async function addMember(
    boardId: number,
    email: string,
    role: BoardRole,
): Promise<Member> {
    return apiFetch<Member>(`/boards/${boardId}/members`, {
        method: 'POST',
        body: { email, role },
    });
}

export async function updateMemberRole(
    boardId: number,
    userId: number,
    role: BoardRole,
): Promise<Member> {
    return apiFetch<Member>(`/boards/${boardId}/members/${userId}`, {
        method: 'PATCH',
        body: { role },
    });
}

export async function removeMember(
    boardId: number,
    userId: number,
): Promise<void> {
    return apiFetch<void>(`/boards/${boardId}/members/${userId}`, {
        method: 'DELETE',
    });
}

export async function deleteBoard(boardId: number): Promise<void> {
    return apiFetch<void>(`/boards/${boardId}`, {
        method: 'DELETE',
    });
}

export async function createColumn(
    boardId: number,
    title: string,
): Promise<Omit<Column, 'cards'>> {
    return apiFetch<Omit<Column, 'cards'>>(`/boards/${boardId}/columns`, {
        method: 'POST',
        body: { title },
    });
}

export async function updateColumn(
    columnId: number,
    title: string,
): Promise<Omit<Column, 'cards'>> {
    return apiFetch<Omit<Column, 'cards'>>(`/columns/${columnId}`, {
        method: 'PATCH',
        body: { title },
    });
}

export async function deleteColumn(columnId: number): Promise<void> {
    return apiFetch<void>(`/columns/${columnId}`, {
        method: 'DELETE',
    });
}

export async function moveColumn(
    columnId: number,
    afterId: number | null,
): Promise<Omit<Column, 'cards'>> {
    return apiFetch<Omit<Column, 'cards'>>(`/columns/${columnId}/move`, {
        method: 'PATCH',
        body: { afterId },
    });
}

export async function createCard(
    columnId: number,
    title: string,
    description: string,
) {
    return apiFetch<Card>(`/columns/${columnId}/cards`, {
        method: 'POST',
        body: { title, description: description || undefined },
    });
}

export async function updateCard(
    cardId: number,
    title: string,
    description: string,
): Promise<Card> {
    return apiFetch<Card>(`/cards/${cardId}`, {
        method: 'PATCH',
        body: { title, description: description || null },
    });
}

export async function deleteCard(cardId: number): Promise<void> {
    return apiFetch<void>(`/cards/${cardId}`, {
        method: 'DELETE',
    });
}

export async function moveCard(
    cardId: number,
    columnId: number,
    afterId: number | null,
): Promise<Card> {
    return apiFetch<Card>(`/cards/${cardId}/move`, {
        method: 'PATCH',
        body: { columnId, afterId },
    });
}
