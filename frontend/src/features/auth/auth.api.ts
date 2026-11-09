import { throwApiError } from '../../lib/errors';
import type { User } from '../../lib/types';

type LoginResult = {
    token: string;
    user: User;
};

type RegisterResult = {
    user: User;
};

export async function login(
    email: string,
    password: string,
): Promise<LoginResult> {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    await throwApiError(response);

    const data: LoginResult = await response.json();
    return data;
}

export async function register(
    name: string,
    email: string,
    password: string,
): Promise<RegisterResult> {
    const response = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/register`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
        },
    );

    await throwApiError(response);

    const data: RegisterResult = await response.json();
    return data;
}
