import { ipKeyGenerator, MemoryStore, rateLimit } from 'express-rate-limit';

export const loginStore = new MemoryStore();
export const registerStore = new MemoryStore();
export const addMemberStore = new MemoryStore();

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

// Agregar un miembro por email revela si ese email está registrado (404 o 201).
// Contar por usuario (no por IP) frena a quien prueba emails en masa desde una cuenta.
// Va después de requireAuth, así que req.user existe; la IP queda solo como respaldo.
export const addMemberLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: addMemberStore,
    keyGenerator: (req) =>
        req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip ?? ''),
    message: { error: 'Demasiados intentos de agregar miembros, proba de nuevo mas tarde' },
});
