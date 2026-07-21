import express from 'express';
import {
  getMessages,
  sendMessage,
  markAsRead,
  updateMessage,
  deleteMessage
} from '../controllers/messageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/:conversationId', protect, getMessages);
router.post('/', protect, sendMessage);
router.patch('/read', protect, markAsRead);
router.patch('/:messageId', protect, updateMessage);
router.delete('/:messageId', protect, deleteMessage);

export default router;
