import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import {
    createColumnController,
    deleteColumnController,
    listColumnsController,
    moveColumnController,
    updateColumnController,
} from './columns.controller.js';

const router = Router();

router.get('/boards/:id/columns', requireAuth, listColumnsController);
router.post('/boards/:id/columns', requireAuth, createColumnController);
router.patch('/columns/:id', requireAuth, updateColumnController);
router.delete('/columns/:id', requireAuth, deleteColumnController);
router.patch('/columns/:id/move', requireAuth, moveColumnController);

export default router;