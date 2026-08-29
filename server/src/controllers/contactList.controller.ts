import { Request, Response, NextFunction } from 'express';
import { ContactListService } from '../services/contactList.service.js';

export async function getAllContactLists(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const lists = await ContactListService.getAllLists();
    res.status(200).json({
      success: true,
      data: lists,
    });
  } catch (error) {
    next(error);
  }
}

export async function createContactList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, description } = req.body;
    const newList = await ContactListService.createList(name, description);
    res.status(201).json({
      success: true,
      data: {
        id: newList._id.toString(),
        name: newList.name,
        description: newList.description,
        memberCount: 0,
        createdAt: newList.createdAt,
        updatedAt: newList.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getContactListDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 25;
    const search = req.query.search as string;

    const result = await ContactListService.getListDetails(id, { page, limit, search });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateContactList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const updated = await ContactListService.updateList(id, name, description);
    res.status(200).json({
      success: true,
      data: {
        id: updated._id.toString(),
        name: updated.name,
        description: updated.description,
        memberCount: updated.contactIds.length,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteContactList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    await ContactListService.deleteList(id);
    res.status(200).json({
      success: true,
      data: { message: 'Contact list deleted successfully' },
    });
  } catch (error) {
    next(error);
  }
}

export async function addContactsToList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { contactIds } = req.body;
    const result = await ContactListService.addContactsToList(id, contactIds || []);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeContactFromList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id, contactId } = req.params;
    const result = await ContactListService.removeContactFromList(id, contactId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
