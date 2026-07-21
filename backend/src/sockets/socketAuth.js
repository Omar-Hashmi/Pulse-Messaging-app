import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Runs once per new socket connection, before 'connection' fires
export const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication error'));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return next(new Error('Authentication error'));

    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
};
