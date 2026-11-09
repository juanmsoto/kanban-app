import { throwApiError } from './errors';
import { getToken } from './token';

type ApiFetchOptions = {
    method?: 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
};

export async function apiFetch<T>(
    path: string,
    options: ApiFetchOptions = {},
): Promise<T> {
    const response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
        method: options.method,
        headers: {
            Authorization: `Bearer ${getToken()}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(options.body),
    });

    await throwApiError(response);

    const data: T = await response.json();
    return data;
}
