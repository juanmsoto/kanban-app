import { createContext, useContext } from 'react';
import type { User } from './types';

export type Session =
    | { status: 'checking' }
    | { status: 'loggedOut' }
    | { status: 'loggedIn'; user: User };

type SessionContextValue = {
    session: Session;
    login: (token: string, user: User) => void;
    logout: () => void;
};

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
    const value = useContext(SessionContext);

    if (value === null) {
        throw new Error(
            'useSession tiene que usarse dentro de SessionProvider',
        );
    }

    return value;
}
