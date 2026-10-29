import { Router } from 'express';
import { requireAuth } from '../../middlewares/requireAuth.js';
import {
    createColumnController,
    deleteColumnController,
    listColumnsController,
    updateColumnController,
} from './columns.controller.js';

const router = Router();

router.get('/boards/:id/columns', requireAuth, listColumnsController);
router.post('/boards/:id/columns', requireAuth, createColumnController);
router.patch('/columns/:id', requireAuth, updateColumnController);
router.delete('/columns/:id', requireAuth, deleteColumnController);

export default router;