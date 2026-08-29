import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middlewares/auth.js';
import {
  getContacts,
  importContacts,
  updateContactOptIn,
  deleteContact,
} from '../controllers/contact.controller.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(requireAuth);

router.get('/', getContacts);
router.post('/import', upload.single('file'), importContacts);
router.patch('/:id/opt-in', updateContactOptIn);
router.delete('/:id', deleteContact);

export const contactRoutes = router;
