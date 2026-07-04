import { Router } from 'express';
import { authorizeRoles, protect } from '../../../middlewares/authMiddleware.js';
import {
  createDepartment,
  deleteDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  getDepartmentInsights,
  getGlobalAnalytics,
  getDepartmentAnalytics,
} from '../controller/departmentController.js';

const router = Router();

router.use(protect, authorizeRoles('ADMIN'));

router.get('/analytics/global', getGlobalAnalytics);
router.post('/', createDepartment);
router.get('/', getAllDepartments);
router.get('/:id', getDepartmentById);
router.patch('/:id', updateDepartment);
router.delete('/:id', deleteDepartment);
router.get('/:id/insights', getDepartmentInsights);
router.get('/:id/analytics', getDepartmentAnalytics);

export default router;
