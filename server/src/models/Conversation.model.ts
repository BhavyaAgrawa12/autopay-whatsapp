import mongoose, { Schema, Document } from 'mongoose';

export interface IConversation extends Document {
  contactId?: mongoose.Types.ObjectId | null;
  phoneNumber: string; // Normalized phone string (unique, indexed)
  phoneRaw: string;
  displayName: string;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
  messagingWindowExpiresAt?: Date | null;
  lastInboundAt?: Date | null;
  lastOutboundAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    contactId: { type: Schema.Types.ObjectId, ref: 'Contact', default: null, index: true },
    phoneNumber: { type: String, required: true, unique: true, index: true, trim: true },
    phoneRaw: { type: String, required: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    lastMessage: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    unreadCount: { type: Number, default: 0, min: 0 },
    messagingWindowExpiresAt: { type: Date, default: null },
    lastInboundAt: { type: Date, default: null },
    lastOutboundAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for sorting and lookup
ConversationSchema.index({ lastMessageAt: -1 });
ConversationSchema.index({ displayName: 'text', phoneNumber: 'text', lastMessage: 'text' });

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);
