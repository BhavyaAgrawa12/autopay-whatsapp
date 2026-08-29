import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import {
  getAllContactLists,
  createContactList,
  getContactListDetails,
  updateContactList,
  deleteContactList,
  addContactsToList,
  removeContactFromList,
} from '../controllers/contactList.controller.js';

const router = Router();

// Protect all contact list routes with admin JWT authentication
router.use(requireAuth);

router.get('/', getAllContactLists);
router.post('/', createContactList);
router.get('/:id', getContactListDetails);
router.patch('/:id', updateContactList);
router.delete('/:id', deleteContactList);
router.post('/:id/contacts', addContactsToList);
router.delete('/:id/contacts/:contactId', removeContactFromList);

export const contactListRoutes = router;
