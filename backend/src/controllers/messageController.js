import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';

export const getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const messages = await Message.find({ conversation: conversationId })
    .populate('sender', 'username avatar')
    .populate({ path: 'replyTo', populate: { path: 'sender', select: 'username' } })
    .sort({ createdAt: 1 });
  res.json(messages);
};

// REST fallback for sending messages (primary path is the message:send socket event)
export const sendMessage = async (req, res) => {
  const { conversationId, text, attachments, replyTo } = req.body;

  const message = await Message.create({
    conversation: conversationId,
    sender: req.user._id,
    text,
    attachments: attachments || [],
    replyTo,
    deliveredTo: [req.user._id]
  });

  await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });
  const populated = await message
    .populate('sender', 'username avatar')
    .populate({ path: 'replyTo', populate: { path: 'sender', select: 'username' } });
  res.status(201).json(populated);
};

export const updateMessage = async (req, res) => {
  const { messageId } = req.params;
  const { text } = req.body;

  const message = await Message.findById(messageId);
  if (!message) return res.status(404).json({ message: 'Message not found' });
  if (message.sender.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized to edit this message' });
  }

  const age = Date.now() - new Date(message.createdAt).getTime();
  if (age > 15 * 60 * 1000) {
    return res.status(400).json({ message: 'Message can only be edited within 15 minutes' });
  }

  message.text = text;
  message.editedAt = Date.now();
  await message.save();

  const populated = await message
    .populate('sender', 'username avatar')
    .populate({ path: 'replyTo', populate: { path: 'sender', select: 'username' } });
  res.json(populated);
};

export const deleteMessage = async (req, res) => {
  const { messageId } = req.params;
  const message = await Message.findById(messageId);
  if (!message) return res.status(404).json({ message: 'Message not found' });
  if (message.sender.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Not authorized to delete this message' });
  }

  message.isDeleted = true;
  message.text = '';
  message.attachments = [];
  await message.save();

  const populated = await message
    .populate('sender', 'username avatar')
    .populate({ path: 'replyTo', populate: { path: 'sender', select: 'username' } });
  res.json(populated);
};

export const markAsRead = async (req, res) => {
  const { messageIds } = req.body;
  await Message.updateMany({ _id: { $in: messageIds } }, { $addToSet: { readBy: req.user._id } });
  res.json({ success: true });
};
