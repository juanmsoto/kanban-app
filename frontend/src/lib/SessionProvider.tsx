import { useState, useEffect, type ReactNode } from 'react';
import { ApiError } from './errors';
import { apiFetch } from './api';
import type { User } from './types';
import { SessionContext, type Session } from './session';
import { clearToken, getToken, saveToken } from './token';

type MeResult = {
    user: User;
};

type SessionProviderProps = {
    children: ReactNode;
};

async function fetchMe(): Promise<User> {
    const data = await apiFetch<MeResult>('/auth/me');
    return data.user;
}

function SessionProvider({ children }: SessionProviderProps) {
    const [session, setSession] = useState<Session>(
        getToken() === null ? { status: 'loggedOut' } : { status: 'checking' },
    );

    useEffect(() => {
        async function checkSession() {
            const token = getToken();

            if (token === null) {
                return;
            }

            try {
                const user = await fetchMe();
                setSession({ status: 'loggedIn', user });
            } catch (err) {
                if (err instanceof ApiError && err.status === 401) {
                    clearToken();
                }

                setSession({ status: 'loggedOut' });
            }
        }

        checkSession();
    }, []);

    function startSession(token: string, user: User) {
        saveToken(token);
        setSession({ status: 'loggedIn', user });
    }

    function endSession() {
        clearToken();
        setSession({ status: 'loggedOut' });
    }

    return (
        <SessionContext value={{ session, startSession, endSession }}>
            {children}
        </SessionContext>
    );
}

export default SessionProvider;
