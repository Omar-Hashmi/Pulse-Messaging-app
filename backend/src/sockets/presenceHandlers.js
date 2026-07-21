import { redisClient } from '../config/redis.js';
import { ONLINE_USERS_KEY, USER_SOCKETS_KEY } from '../utils/redisKeys.js';
import User from '../models/User.js';

// Tracks a per-user socket count in Redis so a user with multiple tabs/devices
// is only marked offline once ALL of their sockets disconnect.
export const handleConnection = async (io, socket) => {
  const userId = socket.user._id.toString();
  socket.join(userId); // personal room, used for direct notifications/DMs

  await redisClient.sadd(ONLINE_USERS_KEY, userId);
  await redisClient.hincrby(USER_SOCKETS_KEY, userId, 1);
  await User.findByIdAndUpdate(userId, { isOnline: true });

  const onlineUsers = await redisClient.smembers(ONLINE_USERS_KEY);
  io.emit('presence:online-users', onlineUsers);
};

export const handleDisconnection = async (io, socket) => {
  const userId = socket.user._id.toString();
  const remaining = await redisClient.hincrby(USER_SOCKETS_KEY, userId, -1);

  if (remaining <= 0) {
    await redisClient.hdel(USER_SOCKETS_KEY, userId);
    await redisClient.srem(ONLINE_USERS_KEY, userId);
    await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: new Date() });

    const onlineUsers = await redisClient.smembers(ONLINE_USERS_KEY);
    io.emit('presence:online-users', onlineUsers);
  }
};
