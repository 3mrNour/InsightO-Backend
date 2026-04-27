import { Router } from 'express';
import { authorizeRoles, protect } from '../../../middlewares/authMiddleware.js';
import {
  createDepartment,
  deleteDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
} from '../controller/departmentController.js';

const router = Router();

router.use(protect, authorizeRoles('ADMIN'));

router.post('/', createDepartment);
router.get('/', getAllDepartments);
router.get('/:id', getDepartmentById);
router.patch('/:id', updateDepartment);
router.delete('/:id', deleteDepartment);

export default router;
