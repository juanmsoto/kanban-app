import { apiFetch } from '../../lib/api';

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
