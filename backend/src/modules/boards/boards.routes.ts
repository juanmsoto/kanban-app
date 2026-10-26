import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { createBoardController, getBoardController, listBoardsController, listMembersController } from "./boards.controller.js";

const router = Router();

router.post('/', requireAuth, createBoardController);
router.get('/', requireAuth, listBoardsController)
router.get('/:id', requireAuth, getBoardController);
router.get('/:id/members', requireAuth, listMembersController);

export default router;