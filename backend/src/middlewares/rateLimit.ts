import { MemoryStore, rateLimit } from 'express-rate-limit';

export const loginStore = new MemoryStore();
export const registerStore = new MemoryStore();

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: loginStore,
    message: { error: 'Demasiados intentos, proba de nuevo mas tarde' },
});

export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: registerStore,
    message: { error: 'Demasiados registros, proba de nuevo mas tarde' },
});
