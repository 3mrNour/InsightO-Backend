import { Router } from 'express';
import { protect, authorizeRoles } from '../../../middlewares/authMiddleware.js';
import {
  deleteAdminUser,
  getAdminUserById,
  listAdminUsers,
  updateAdminUser,
} from '../controller/adminUserController.js';

const router = Router();

router.use(protect, authorizeRoles('ADMIN'));

router.get('/', listAdminUsers);
router.get('/:id', getAdminUserById);
router.patch('/:id', updateAdminUser);
router.delete('/:id', deleteAdminUser);

export default router;
