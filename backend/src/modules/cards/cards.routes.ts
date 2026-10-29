import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import {
    createCardController,
    deleteCardController,
    updateCardController,
} from './cards.controller.js';

const router = Router();

router.post('/columns/:id/cards', requireAuth, createCardController);
router.patch('/cards/:id', requireAuth, updateCardController);
router.delete('/cards/:id', requireAuth, deleteCardController);

export default router;