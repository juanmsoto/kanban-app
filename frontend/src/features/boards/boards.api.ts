import { apiFetch } from '../../lib/api';

export type Board = {
    id: number;
    name: string;
    description: string | null;
    role: 'owner' | 'editor' | 'viewer';
    createdAt: string;
    updatedAt: string;
};

export async function getBoards(): Promise<Board[]> {
    return apiFetch<Board[]>('/boards');
}
