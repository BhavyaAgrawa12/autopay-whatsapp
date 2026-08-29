import mongoose, { Schema, Document } from 'mongoose';

export interface IContactList extends Document {
  name: string;
  description?: string;
  contactIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ContactListSchema = new Schema<IContactList>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    contactIds: [{ type: Schema.Types.ObjectId, ref: 'Contact', index: true }],
  },
  {
    timestamps: true,
  }
);

export const ContactList = mongoose.model<IContactList>('ContactList', ContactListSchema);
