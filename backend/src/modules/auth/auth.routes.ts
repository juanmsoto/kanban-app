import { Router } from 'express';
import { login, me, register } from './auth.controller.js';
import { requireAuth } from '../../middlewares/requireAuth.js';
import { loginLimiter, registerLimiter } from '../../middlewares/rateLimit.js';

const router = Router();

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);
router.get('/me', requireAuth, me);

export default router;
