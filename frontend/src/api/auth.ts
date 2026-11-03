export type ErrorResponse = {
    error: string;
    fields?: Record<string, string[]>;
};

export type User = {
    id: number;
    name: string;
    email: string;
};

export type LoginResult = {
    token: string;
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

    if (!response.ok) {
        const errorBody: ErrorResponse = await response.json();
        throw new Error(errorBody.error);
    }

    const data: LoginResult = await response.json();
    return data;
}
