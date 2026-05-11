import { Router } from 'express';
import { protect, authorizeRoles } from '../../../middlewares/authMiddleware.js';
import {
  createAdminUser,
  deleteAdminUser,
  getAdminUserById,
  listAdminUsers,
  updateAdminUser,
} from '../controller/adminUserController.js';
import { validate } from '../../../middlewares/validateMiddleware.js';
import { createAdminUserSchema } from '../validation/adminUserValidation.js';

const router = Router();

router.use(protect, authorizeRoles('ADMIN'));

router.post('/', validate(createAdminUserSchema), createAdminUser);
router.get('/', listAdminUsers);
router.get('/:id', getAdminUserById);
router.patch('/:id', updateAdminUser);
router.delete('/:id', deleteAdminUser);

export default router;
