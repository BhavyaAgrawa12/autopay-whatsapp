import mongoose from 'mongoose';
import { ContactList, IContactList } from '../models/ContactList.model.js';
import { Contact } from '../models/Contact.model.js';
import { AppError, NotFoundError, ValidationError } from '../utils/errors.js';

export interface ContactListSummary {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ContactListService {
  public static async getAllLists(): Promise<ContactListSummary[]> {
    const lists = await ContactList.find().sort({ createdAt: -1 }).lean();
    
    // Fetch all active contact IDs to calculate real member count
    const activeContacts = await Contact.find({}, '_id').lean();
    const activeContactIdSet = new Set(activeContacts.map((c) => c._id.toString()));

    return lists.map((list) => {
      const rawIds = Array.isArray(list.contactIds) ? list.contactIds : [];
      const activeMemberIds = rawIds.filter((cid) => activeContactIdSet.has(cid.toString()));
      return {
        id: list._id.toString(),
        name: list.name,
        description: list.description,
        memberCount: activeMemberIds.length,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
      };
    });
  }

  public static async createList(name: string, description?: string): Promise<IContactList> {
    const trimmedName = name ? name.trim() : '';
    if (!trimmedName) {
      throw new ValidationError('Contact list name is required.');
    }

    const existing = await ContactList.findOne({ name: { $regex: `^${trimmedName}$`, $options: 'i' } });
    if (existing) {
      throw new ValidationError(`A contact list named '${trimmedName}' already exists.`);
    }

    const newList = await ContactList.create({
      name: trimmedName,
      description: description ? description.trim() : '',
      contactIds: [],
    });

    return newList;
  }

  public static async getListDetails(
    id: string,
    options: { page?: number; limit?: number; search?: string } = {}
  ): Promise<{
    list: ContactListSummary;
    contacts: any[];
    pagination: { page: number; limit: number; totalPages: number; totalItems: number };
  }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Contact list not found');
    }

    const list = await ContactList.findById(id).lean();
    if (!list) {
      throw new NotFoundError('Contact list not found');
    }

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(Math.max(1, options.limit || 25), 100);
    const skip = (page - 1) * limit;

    const memberIds = list.contactIds || [];
    const query: any = { _id: { $in: memberIds } };

    if (options.search && options.search.trim().length > 0) {
      const searchRegex = new RegExp(options.search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { company: searchRegex },
      ];
    }

    const [contacts, totalItems] = await Promise.all([
      Contact.find(query).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Contact.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      list: {
        id: list._id.toString(),
        name: list.name,
        description: list.description,
        memberCount: totalItems,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
      },
      contacts: contacts.map((c: any) => ({
        id: c._id.toString(),
        name: c.name,
        phone: c.phoneNormalized || c.phoneRaw,
        email: c.email,
        company: c.company,
        status: 'ACTIVE',
        optInStatus: c.marketingOptIn || 'OPTED_IN',
        createdAt: c.createdAt,
      })),
      pagination: { page, limit, totalPages, totalItems },
    };
  }

  public static async updateList(id: string, name?: string, description?: string): Promise<IContactList> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Contact list not found');
    }

    const list = await ContactList.findById(id);
    if (!list) {
      throw new NotFoundError('Contact list not found');
    }

    if (typeof name !== 'undefined') {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new ValidationError('Contact list name cannot be empty.');
      }
      const existing = await ContactList.findOne({ _id: { $ne: id }, name: { $regex: `^${trimmed}$`, $options: 'i' } });
      if (existing) {
        throw new ValidationError(`Another contact list named '${trimmed}' already exists.`);
      }
      list.name = trimmed;
    }

    if (typeof description !== 'undefined') {
      list.description = description.trim();
    }

    await list.save();
    return list;
  }

  public static async deleteList(id: string): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Contact list not found');
    }
    const result = await ContactList.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundError('Contact list not found');
    }
  }

  public static async addContactsToList(
    id: string,
    contactIds: string[]
  ): Promise<{ addedCount: number; alreadyMemberCount: number; totalMembers: number }> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Contact list not found');
    }

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      throw new ValidationError('No contact IDs provided.');
    }

    const validObjectIds = contactIds
      .filter((cid) => cid && mongoose.Types.ObjectId.isValid(String(cid)))
      .map((cid) => new mongoose.Types.ObjectId(String(cid)));

    if (validObjectIds.length === 0) {
      throw new ValidationError('No valid contact IDs provided.');
    }

    const listBefore = await ContactList.findById(id).lean();
    if (!listBefore) {
      throw new NotFoundError('Contact list not found');
    }

    const existingMemberSet = new Set((listBefore.contactIds || []).map((m) => m.toString()));
    let addedCount = 0;
    let alreadyMemberCount = 0;

    validObjectIds.forEach((objId) => {
      const idStr = objId.toString();
      if (existingMemberSet.has(idStr)) {
        alreadyMemberCount++;
      } else {
        addedCount++;
      }
    });

    const updated = await ContactList.findByIdAndUpdate(
      id,
      { $addToSet: { contactIds: { $each: validObjectIds } } },
      { returnDocument: 'after' }
    );

    if (!updated) {
      throw new NotFoundError('Contact list not found');
    }

    return {
      addedCount,
      alreadyMemberCount,
      totalMembers: updated.contactIds.length,
    };
  }

  public static async removeContactFromList(id: string, contactId: string): Promise<{ totalMembers: number }> {
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(contactId)) {
      throw new ValidationError('Invalid list or contact ID.');
    }

    const updated = await ContactList.findByIdAndUpdate(
      id,
      { $pull: { contactIds: new mongoose.Types.ObjectId(contactId) } },
      { new: true }
    );

    if (!updated) {
      throw new NotFoundError('Contact list not found');
    }

    return { totalMembers: updated.contactIds.length };
  }
}
