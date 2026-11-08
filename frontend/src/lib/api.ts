import { throwApiError } from './errors';
import { getToken } from './token';

export async function apiFetch<T>(path: string): Promise<T> {
    const response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
    });

    await throwApiError(response);

    const data: T = await response.json();
    return data;
}
