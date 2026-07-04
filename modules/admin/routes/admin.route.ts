import { Router } from "express";
import { getDashboardMetrics } from "../controller/admin.controller.js";
import { protect, authorizeRoles } from "../../../middlewares/authMiddleware.js";
import { UserSchema } from "../../../utils/User.js";

const router = Router();

// Protect all admin routes
router.use(protect, authorizeRoles(UserSchema.ADMIN, UserSchema.HOD));

router.get("/dashboard-metrics", getDashboardMetrics);

export default router;
