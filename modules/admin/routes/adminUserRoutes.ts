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

router.use(protect);

router.post('/', authorizeRoles('ADMIN'), validate(createAdminUserSchema), createAdminUser);
router.get('/', authorizeRoles('ADMIN', 'HOD', 'INSTRUCTOR'), listAdminUsers);
router.get('/:id', authorizeRoles('ADMIN', 'HOD', 'INSTRUCTOR'), getAdminUserById);
router.patch('/:id', authorizeRoles('ADMIN'), updateAdminUser);
router.delete('/:id', authorizeRoles('ADMIN'), deleteAdminUser);

export default router;
