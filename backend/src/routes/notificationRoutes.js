import express from 'express';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteReadNotifications,
  deleteAllNotifications
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getNotifications);
router.patch('/read-all', protect, markAllNotificationsRead);
router.patch('/:notificationId/read', protect, markNotificationRead);
router.delete('/read', protect, deleteReadNotifications);
router.delete('/all', protect, deleteAllNotifications);
router.delete('/:notificationId', protect, deleteNotification);

export default router;
