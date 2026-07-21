import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

export const getConversations = async (req, res) => {
  const conversations = await Conversation.find({ participants: req.user._id })
    .populate('participants', 'username avatar isOnline')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });
  res.json(conversations);
};

export const createConversation = async (req, res) => {
  const { participantId } = req.body;

  let conversation = await Conversation.findOne({
    isGroup: false,
    participants: { $all: [req.user._id, participantId], $size: 2 }
  });

  if (!conversation) {
    conversation = await Conversation.create({ participants: [req.user._id, participantId] });
  }

  res.json(conversation);
};

export const deleteConversation = async (req, res) => {
  const { conversationId } = req.params;
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
  if (!conversation.participants.some((p) => p.toString() === req.user._id.toString())) {
    return res.status(403).json({ message: 'Not authorized to delete this conversation' });
  }

  await Message.deleteMany({ conversation: conversationId });
  await Conversation.findByIdAndDelete(conversationId);
  res.json({ message: 'Conversation deleted' });
};
