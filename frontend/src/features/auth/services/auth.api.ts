import { apiFetch } from '../../../services/api';
import type { User } from '../../../services/types';

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
    return apiFetch<LoginResult>('/auth/login', {
        method: 'POST',
        body: { email, password },
    });
}

export async function register(
    name: string,
    email: string,
    password: string,
): Promise<RegisterResult> {
    return apiFetch<RegisterResult>('/auth/register', {
        method: 'POST',
        body: { name, email, password },
    });
}
