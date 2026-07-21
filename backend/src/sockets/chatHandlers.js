import mongoose from 'mongoose';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

// Marks the given messages as delivered to this socket's user and tells the
// room, so senders see "Delivered" without needing a page refresh.
const markDelivered = async (io, socket, messageIds, conversationId) => {
  const validIds = (messageIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!validIds.length) return;
  await Message.updateMany(
    { _id: { $in: validIds } },
    { $addToSet: { deliveredTo: socket.user._id } }
  );
  io.to(conversationId).emit('message:delivered', {
    messageIds: validIds,
    deliveredTo: socket.user._id
  });
};

export const handleChat = (io, socket) => {
  // Client joins a conversation "room" so it receives message:new events for it
  socket.on('conversation:join', async (conversationId) => {
    const cid = conversationId?.toString();
    if (!cid) return;
    socket.join(cid);

    // Catch-up delivery: anything sent to this user while they weren't in
    // the room (e.g. app closed, or just hadn't opened this chat yet).
    const undelivered = await Message.find({
      conversation: cid,
      sender: { $ne: socket.user._id },
      deliveredTo: { $ne: socket.user._id }
    }).select('_id');

    if (undelivered.length) {
      await markDelivered(io, socket, undelivered.map((m) => m._id.toString()), cid);
    }
  });

  socket.on('conversation:leave', (conversationId) => {
    socket.leave(conversationId?.toString());
  });

  socket.on('message:send', async ({ conversationId, text, attachments, replyTo, tempId }) => {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return;

    const recipients = conversation.participants.filter(
      (p) => p.toString() !== socket.user._id.toString()
    );

    // Prevent sending if either side has blocked the other (1:1 chats)
    if (!conversation.isGroup && recipients.length === 1) {
      const recipient = await User.findById(recipients[0]);
      const sender = await User.findById(socket.user._id);
      const blocked =
        recipient?.blockedUsers?.some((id) => id.toString() === socket.user._id.toString()) ||
        sender?.blockedUsers?.some((id) => id.toString() === recipients[0].toString());
      if (blocked) {
        socket.emit('message:error', { message: 'Unable to send message to this user', tempId });
        return;
      }
    }

    const message = await Message.create({
      conversation: conversationId,
      sender: socket.user._id,
      text,
      attachments: attachments || [],
      replyTo,
      deliveredTo: [socket.user._id]
    });

    await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });
    await message.populate('sender', 'username avatar');
    await message.populate({ path: 'replyTo', populate: { path: 'sender', select: 'username' } });

    const messagePayload = message.toObject();
    // Echo the tempId back to the sender only, so their client can replace
    // the optimistic "Sending..." bubble instead of appending a duplicate.
    socket.emit('message:new', { ...messagePayload, tempId });
    socket.to(conversationId).emit('message:new', messagePayload);

    // Notify every participant's personal room (joined on connection, see
    // presenceHandlers.js) so sidebars/conversation lists update live even
    // without that specific chat window open — the room emit above only
    // reaches sockets that have actually joined this conversation's room.
    const lastMessageSummary = {
      _id: messagePayload._id,
      text: messagePayload.text,
      attachments: messagePayload.attachments,
      isDeleted: messagePayload.isDeleted,
      sender: messagePayload.sender,
      createdAt: messagePayload.createdAt
    };
    conversation.participants.forEach((participantId) => {
      io.to(participantId.toString()).emit('conversation:updated', {
        conversationId,
        lastMessage: lastMessageSummary
      });
    });

    for (const recipientId of recipients) {
      const notification = await Notification.create({
        user: recipientId,
        type: 'message',
        content: text?.trim()
          ? `${socket.user.username} sent you a message`
          : `${socket.user.username} sent an attachment`,
        fromUser: socket.user._id,
        relatedConversation: conversationId
      });
      await notification.populate('fromUser', 'username avatar');
      io.to(recipientId.toString()).emit('notification:new', notification);
    }
  });

  socket.on('message:edit', async ({ messageId, text }) => {
    const message = await Message.findById(messageId);
    if (!message) return;
    if (message.sender.toString() !== socket.user._id.toString()) return;
    const age = Date.now() - new Date(message.createdAt).getTime();
    if (age > 15 * 60 * 1000) return;

    message.text = text;
    message.editedAt = Date.now();
    await message.save();

    await message.populate('sender', 'username avatar');
    await message.populate({ path: 'replyTo', populate: { path: 'sender', select: 'username' } });
    io.to(message.conversation.toString()).emit('message:updated', message);
  });

  socket.on('message:delete', async ({ messageId }) => {
    const message = await Message.findById(messageId);
    if (!message) return;
    if (message.sender.toString() !== socket.user._id.toString()) return;

    message.isDeleted = true;
    message.text = '';
    message.attachments = [];
    await message.save();

    await message.populate('sender', 'username avatar');
    await message.populate({ path: 'replyTo', populate: { path: 'sender', select: 'username' } });
    io.to(message.conversation.toString()).emit('message:deleted', message);
  });

  // Toggle an emoji reaction on a message. Clicking the same emoji again removes it;
  // clicking a different emoji replaces the user's previous reaction on that message.
  socket.on('message:react', async ({ messageId, emoji }) => {
    if (!messageId || !emoji) return;
    const message = await Message.findById(messageId);
    if (!message) return;

    const userId = socket.user._id.toString();
    const existingIndex = message.reactions.findIndex((r) => r.user.toString() === userId);

    if (existingIndex !== -1 && message.reactions[existingIndex].emoji === emoji) {
      message.reactions.splice(existingIndex, 1);
    } else if (existingIndex !== -1) {
      message.reactions[existingIndex].emoji = emoji;
    } else {
      message.reactions.push({ user: socket.user._id, emoji });
    }

    await message.save();
    await message.populate('sender', 'username avatar');
    await message.populate({ path: 'replyTo', populate: { path: 'sender', select: 'username' } });
    io.to(message.conversation.toString()).emit('message:updated', message);
  });

  socket.on('conversation:delete', async ({ conversationId }) => {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return;
    if (!conversation.participants.some((p) => p.toString() === socket.user._id.toString())) return;

    await Message.deleteMany({ conversation: conversationId });
    await Conversation.findByIdAndDelete(conversationId);
    io.to(conversationId).emit('conversation:deleted', { conversationId });
  });

  socket.on('message:delivered', async ({ messageIds, conversationId }) => {
    await markDelivered(io, socket, messageIds, conversationId);
  });

  socket.on('message:read', async ({ messageIds, conversationId }) => {
    const validIds = (messageIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!validIds.length) return;
    await Message.updateMany(
      { _id: { $in: validIds } },
      { $addToSet: { readBy: socket.user._id, deliveredTo: socket.user._id } }
    );
    io.to(conversationId).emit('message:read', {
      messageIds: validIds,
      readerId: socket.user._id
    });
  });
};