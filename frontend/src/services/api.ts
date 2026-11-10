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
    let response: Response;

    try {
        response = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
            method: options.method,
            headers: {
                Authorization: `Bearer ${getToken()}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(options.body),
        });
    } catch {
        throw new Error(
            'No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.',
        );
    }

    await throwApiError(response);

    if (response.status === 204) {
        return undefined as T;
    }

    const data: T = await response.json();
    return data;
}
