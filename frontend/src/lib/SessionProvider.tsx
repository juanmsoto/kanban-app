import { useState, type ReactNode } from 'react';
import { throwApiError } from './errors';
import type { User } from './types';
import { SessionContext, type Session } from './session';
import { clearToken, getToken, saveToken } from './token';

type MeResult = {
    user: User;
};

type SessionProviderProps = {
    children: ReactNode;
};

async function fetchMe(token: string): Promise<User> {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });

    await throwApiError(response);

    const data: MeResult = await response.json();
    return data.user;
}

function SessionProvider({ children }: SessionProviderProps) {
    const [session, setSession] = useState<Session>(
        getToken() === null ? { status: 'loggedOut' } : { status: 'checking' },
    );

    function login(token: string, user: User) {
        saveToken(token);
        setSession({ status: 'loggedIn', user });
    }

    function logout() {
        clearToken();
        setSession({ status: 'loggedOut' });
    }

    return (
        <SessionContext value={{ session, login, logout }}>
            {children}
        </SessionContext>
    );
}

export default SessionProvider;
