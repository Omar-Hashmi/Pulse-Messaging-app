export const handleTyping = (io, socket) => {
  socket.on('typing:start', ({ conversationId }) => {
    socket.to(conversationId).emit('typing:start', {
      conversationId,
      userId: socket.user._id
    });
  });

  socket.on('typing:stop', ({ conversationId }) => {
    socket.to(conversationId).emit('typing:stop', {
      conversationId,
      userId: socket.user._id
    });
  });
};
