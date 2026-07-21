import express from 'express';
import { getConversations, createConversation, deleteConversation } from '../controllers/conversationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getConversations);
router.post('/', protect, createConversation);
router.delete('/:conversationId', protect, deleteConversation);

export default router;
