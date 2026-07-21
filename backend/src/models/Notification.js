import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['message', 'mention', 'system', 'friend_request', 'friend_accept'],
      default: 'message'
    },
    content: { type: String },
    // The user who triggered this notification (sent the message / friend request / accepted it)
    fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    relatedConversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model('Notification', notificationSchema);
