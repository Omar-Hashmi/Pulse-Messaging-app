import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, default: '' },
    attachments: [
      {
        url: String,
        fileName: String,
        fileType: String,
        fileSize: Number
      }
    ],
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    editedAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        emoji: { type: String, required: true }
      }
    ]
  },
  { timestamps: true }
);

export default mongoose.model('Message', messageSchema);
