import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { pubClient, subClient } from '../config/redis.js';
import { socketAuth } from './socketAuth.js';
import { handleConnection, handleDisconnection } from './presenceHandlers.js';
import { handleTyping } from './typingHandlers.js';
import { handleChat } from './chatHandlers.js';
import { setIO } from './ioInstance.js';

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL, credentials: true }
  });

  // Redis adapter lets Socket.IO broadcast across multiple Node instances,
  // which is required as soon as you run more than one backend process.
  io.adapter(createAdapter(pubClient, subClient));

  io.use(socketAuth);

  // Make this io instance available to REST controllers (e.g. friend request notifications)
  setIO(io);

  io.on('connection', async (socket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.user.username})`);

    await handleConnection(io, socket);
    handleTyping(io, socket);
    handleChat(io, socket);

    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      await handleDisconnection(io, socket);
    });
  });

  return io;
};
