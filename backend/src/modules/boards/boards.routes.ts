import { Router } from "express";
import { requireAuth } from "../../middlewares/requireAuth.js";
import { addMemberController, createBoardController, deleteBoardController, getBoardController, listBoardsController, listMembersController, removeMemberController, updateBoardController, updateMemberController } from "./boards.controller.js";

const router = Router();

router.post('/', requireAuth, createBoardController);
router.get('/', requireAuth, listBoardsController)
router.get('/:id', requireAuth, getBoardController);
router.get('/:id/members', requireAuth, listMembersController);
router.post('/:id/members', requireAuth, addMemberController);
router.patch('/:id/members/:userId', requireAuth, updateMemberController);
router.delete('/:id/members/:userId', requireAuth, removeMemberController);
router.patch('/:id', requireAuth, updateBoardController);
router.delete('/:id', requireAuth, deleteBoardController);

export default router;