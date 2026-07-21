import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { redisClient } from '../config/redis.js';
import { ONLINE_USERS_KEY } from '../utils/redisKeys.js';
import { getIO } from '../sockets/ioInstance.js';

const friendPopFields = 'username avatar friendKey isPrivate';

const emitNotification = async (userId, payload) => {
  const notification = await Notification.create({ user: userId, ...payload });
  await notification.populate('fromUser', 'username avatar');
  const io = getIO();
  io?.to(userId.toString()).emit('notification:new', notification);
  return notification;
};

export const getUsers = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).populate({ path: 'friends', select: friendPopFields });
    const onlineIds = await redisClient.smembers(ONLINE_USERS_KEY);

    const result = (me.friends || []).map((u) => ({
      ...u.toObject(),
      isOnline: onlineIds.includes(u._id.toString())
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const findTargetUser = async (identifier) => {
  if (!identifier) return null;
  let target = await User.findOne({ friendKey: identifier });
  if (!target) target = await User.findOne({ username: identifier });
  return target;
};

export const getMyProfile = async (req, res) => {
  try {
    const me = await User.findById(req.user._id)
      .select('-password')
      .populate({ path: 'blockedUsers', select: 'username avatar email' });
    if (!me) return res.status(404).json({ message: 'User not found' });
    res.json(me);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getFriendRequests = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).populate({ path: 'friendRequests', select: friendPopFields });
    res.json(me.friendRequests || []);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const sendFriendRequest = async (req, res) => {
  try {
    const { identifier } = req.body;
    const target = await findTargetUser(identifier);
    const requester = await User.findById(req.user._id);

    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target._id.equals(requester._id)) return res.status(400).json({ message: 'Cannot add yourself' });
    if (target.blockedUsers?.some((id) => id.equals(requester._id))) {
      return res.status(403).json({ message: 'Unable to send request to this user' });
    }
    if (requester.blockedUsers?.some((id) => id.equals(target._id))) {
      return res.status(403).json({ message: 'Unblock this user before sending a request' });
    }
    if (requester.friends.some((id) => id.equals(target._id))) return res.status(400).json({ message: 'Already friends' });
    if (target.friendRequests.some((id) => id.equals(requester._id))) return res.status(400).json({ message: 'Request already sent' });

    if (!target.isPrivate) {
      requester.friends.push(target._id);
      target.friends.push(requester._id);
      await requester.save();
      await target.save();

      await emitNotification(target._id, {
        type: 'friend_accept',
        content: `${requester.username} added you as a friend`,
        fromUser: requester._id
      });

      return res.json({ message: 'Friend added', accepted: true, friendId: target._id });
    }

    target.friendRequests.push(requester._id);
    await target.save();

    await emitNotification(target._id, {
      type: 'friend_request',
      content: `${requester.username} sent you a friend request`,
      fromUser: requester._id
    });

    res.json({ message: 'Friend request sent', accepted: false });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const acceptFriendRequest = async (req, res) => {
  try {
    const { requesterId } = req.body;
    const me = await User.findById(req.user._id);
    if (!me.friendRequests.some((id) => id.equals(requesterId))) {
      return res.status(400).json({ message: 'No pending request from this user' });
    }

    me.friendRequests = me.friendRequests.filter((id) => !id.equals(requesterId));
    if (!me.friends.some((id) => id.equals(requesterId))) me.friends.push(requesterId);
    await me.save();

    const other = await User.findById(requesterId);
    if (!other.friends.some((id) => id.equals(me._id))) {
      other.friends.push(me._id);
      await other.save();
    }

    await emitNotification(requesterId, {
      type: 'friend_accept',
      content: `${me.username} accepted your friend request`,
      fromUser: me._id
    });

    res.json({ message: 'Friend added' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const rejectFriendRequest = async (req, res) => {
  try {
    const { requesterId } = req.body;
    const me = await User.findById(req.user._id);
    me.friendRequests = me.friendRequests.filter((id) => !id.equals(requesterId));
    await me.save();
    res.json({ message: 'Friend request rejected' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const removeFriend = async (req, res) => {
  try {
    const { friendId } = req.body;
    const me = await User.findById(req.user._id);
    me.friends = me.friends.filter((id) => !id.equals(friendId));
    await me.save();

    const other = await User.findById(friendId);
    if (other) {
      other.friends = other.friends.filter((id) => !id.equals(me._id));
      await other.save();
    }

    res.json({ message: 'Friend removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const setPrivacy = async (req, res) => {
  try {
    const { isPrivate } = req.body;
    const me = await User.findById(req.user._id);
    me.isPrivate = Boolean(isPrivate);
    await me.save();
    res.json({ message: 'Privacy updated', isPrivate: me.isPrivate });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const blockUser = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'User ID is required' });

    const me = await User.findById(req.user._id);
    if (!me.blockedUsers.some((id) => id.equals(userId))) {
      me.blockedUsers.push(userId);
    }
    me.friends = me.friends.filter((id) => !id.equals(userId));
    me.friendRequests = me.friendRequests.filter((id) => !id.equals(userId));
    await me.save();

    const other = await User.findById(userId);
    if (other) {
      other.friends = other.friends.filter((id) => !id.equals(me._id));
      other.friendRequests = other.friendRequests.filter((id) => !id.equals(me._id));
      await other.save();
    }

    res.json({ message: 'User blocked', blockedUsers: me.blockedUsers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'User ID is required' });

    const me = await User.findById(req.user._id);
    me.blockedUsers = me.blockedUsers.filter((id) => !id.equals(userId));
    await me.save();

    res.json({ message: 'User unblocked', blockedUsers: me.blockedUsers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ message: 'Username is required' });
    }

    const trimmed = username.trim();
    const existing = await User.findOne({ username: trimmed, _id: { $ne: req.user._id } });
    if (existing) return res.status(400).json({ message: 'Username is already taken' });

    const me = await User.findById(req.user._id);
    me.username = trimmed;
    await me.save();

    res.json({
      id: me._id,
      username: me.username,
      email: me.email,
      avatar: me.avatar,
      friendKey: me.friendKey,
      isPrivate: me.isPrivate
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const me = await User.findById(req.user._id);
    const matches = await me.matchPassword(currentPassword);
    if (!matches) return res.status(401).json({ message: 'Current password is incorrect' });

    me.password = newPassword;
    await me.save();

    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Remove this user from other users' friends/requests/blocked lists
    await User.updateMany(
      {},
      {
        $pull: {
          friends: userId,
          friendRequests: userId,
          blockedUsers: userId
        }
      }
    );

    const conversations = await Conversation.find({ participants: userId });
    const conversationIds = conversations.map((c) => c._id);

    await Message.deleteMany({ conversation: { $in: conversationIds } });
    await Conversation.deleteMany({ _id: { $in: conversationIds } });
    await Notification.deleteMany({ $or: [{ user: userId }, { fromUser: userId }] });
    await User.findByIdAndDelete(userId);

    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};