import express from 'express';
import {
  getUsers,
  getMyProfile,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  setPrivacy,
  getFriendRequests,
  blockUser,
  unblockUser,
  updateProfile,
  changePassword,
  deleteAccount
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getUsers);
router.get('/me', protect, getMyProfile);
router.get('/me/requests', protect, getFriendRequests);
router.patch('/', protect, updateProfile);
router.patch('/password', protect, changePassword);
router.delete('/', protect, deleteAccount);
router.post('/request', protect, sendFriendRequest);
router.post('/request/accept', protect, acceptFriendRequest);
router.post('/request/reject', protect, rejectFriendRequest);
router.post('/remove', protect, removeFriend);
router.patch('/privacy', protect, setPrivacy);
router.post('/block', protect, blockUser);
router.post('/unblock', protect, unblockUser);

export default router;
